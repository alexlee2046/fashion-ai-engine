'use server';

import { createClient } from '@/lib/supabase/server';
import {
  submitVTONTask,
  getVTONTaskStatus,
  submitVTONTaskMock,
  getVTONTaskStatusMock,
  type VTONRequest,
} from '@/lib/vton';
import {
  checkQuota,
  incrementQuota,
  getQuotaExceededMessage,
} from '@/lib/quota';
import type { ApiResponse, TaskStatus, GenerationType } from '@/types';

// ============================================
// 配置
// ============================================

// 开发模式使用 Mock API
const USE_MOCK = process.env.NODE_ENV === 'development' && !process.env.SILICONFLOW_API_KEY;

// 文件大小限制 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 允许的文件类型
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ============================================
// 类型定义
// ============================================

export interface UploadImageResponse extends ApiResponse<{ url: string }> {
  path?: string;
}

export interface GenerateModelImageResponse extends ApiResponse<{ taskId: string }> {
  generationId?: string;
}

export type TaskStatusResponse = ApiResponse<{
  status: TaskStatus;
  progress: number;
  resultUrl?: string;
}>;

// ============================================
// 图片上传
// ============================================

export async function uploadProductImage(formData: FormData): Promise<UploadImageResponse> {
  const file = formData.get('file') as File | null;

  if (!file) {
    return { success: false, error: '请选择文件' };
  }

  // 验证文件大小
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: '文件大小不能超过 10MB' };
  }

  // 验证文件类型
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: '只支持 JPG、PNG、WebP 格式' };
  }

  try {
    const supabase = await createClient();

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `products/${fileName}`;

    // 上传到 Supabase Storage
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('[Storage] Upload error:', error);
      return { success: false, error: '上传失败，请重试' };
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path);

    return {
      success: true,
      data: { url: urlData.publicUrl },
      path: data.path,
    };
  } catch (error) {
    console.error('[Storage] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '上传失败',
    };
  }
}

// ============================================
// 模特图生成
// ============================================

export async function generateModelImage(
  productImageUrl: string,
  campaignId?: string
): Promise<GenerateModelImageResponse> {
  if (!productImageUrl) {
    return { success: false, error: '商品图片 URL 不能为空' };
  }

  try {
    const supabase = await createClient();

    // 1. 用户认证检查
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: '请先登录' };
    }

    // 2. 配额检查
    const quotaCheck = await checkQuota(user.id, 'image');
    if (!quotaCheck.success) {
      return { success: false, error: quotaCheck.error || '配额检查失败' };
    }
    if (!quotaCheck.quota?.canUse) {
      return {
        success: false,
        error: getQuotaExceededMessage('image', quotaCheck.quota!),
      };
    }

    // 3. 创建 generation 记录
    const { data: generation, error: dbError } = await supabase
      .from('generations')
      .insert({
        campaign_id: campaignId || null,
        type: 'image_model' as GenerationType,
        status: 'pending' as TaskStatus,
        input_image_url: productImageUrl,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('[DB] Failed to create generation:', dbError);
      return { success: false, error: '创建任务失败' };
    }

    // 4. 调用 VTON API
    const vtonRequest: VTONRequest = {
      productImageUrl,
      category: 'upper_body', // 默认上装
    };

    const submitFn = USE_MOCK ? submitVTONTaskMock : submitVTONTask;
    const vtonResult = await submitFn(vtonRequest);

    if (!vtonResult.success) {
      // 更新状态为失败
      await supabase
        .from('generations')
        .update({
          status: 'failed' as TaskStatus,
          error_message: vtonResult.error,
        })
        .eq('id', generation.id);

      return { success: false, error: vtonResult.error };
    }

    // 5. 增加配额使用计数 (API调用成功后)
    await incrementQuota(user.id, 'image');

    // 6. 处理结果
    if (vtonResult.imageUrl) {
      // 同步返回结果
      await supabase
        .from('generations')
        .update({
          status: 'completed' as TaskStatus,
          result_url: vtonResult.imageUrl,
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', generation.id);

      return {
        success: true,
        data: { taskId: generation.id },
        generationId: generation.id,
      };
    } else if (vtonResult.taskId) {
      // 异步任务，保存 provider_id
      await supabase
        .from('generations')
        .update({
          status: 'processing' as TaskStatus,
          provider_id: vtonResult.taskId,
          progress: 10,
        })
        .eq('id', generation.id);

      return {
        success: true,
        data: { taskId: generation.id },
        generationId: generation.id,
      };
    }

    return { success: false, error: '未知错误' };
  } catch (error) {
    console.error('[VTON] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '生成失败',
    };
  }
}

// ============================================
// 任务状态查询
// ============================================

export async function getGenerationStatus(generationId: string): Promise<TaskStatusResponse> {
  if (!generationId) {
    return { success: false, error: '任务 ID 不能为空' };
  }

  try {
    const supabase = await createClient();

    // 1. 获取 generation 记录
    const { data: generation, error: dbError } = await supabase
      .from('generations')
      .select('*')
      .eq('id', generationId)
      .single();

    if (dbError || !generation) {
      return { success: false, error: '任务不存在' };
    }

    // 2. 如果已完成或失败，直接返回
    if (generation.status === 'completed') {
      return {
        success: true,
        data: {
          status: 'completed',
          progress: 100,
          resultUrl: generation.result_url,
        },
      };
    }

    if (generation.status === 'failed') {
      return {
        success: true,
        data: {
          status: 'failed',
          progress: 0,
        },
      };
    }

    // 3. 如果正在处理，查询外部 API 状态
    if (generation.provider_id) {
      const statusFn = USE_MOCK ? getVTONTaskStatusMock : getVTONTaskStatus;
      const externalStatus = await statusFn(generation.provider_id);

      // 更新数据库状态
      if (externalStatus.status === 'completed' && externalStatus.imageUrl) {
        await supabase
          .from('generations')
          .update({
            status: 'completed',
            result_url: externalStatus.imageUrl,
            progress: 100,
            completed_at: new Date().toISOString(),
          })
          .eq('id', generationId);

        return {
          success: true,
          data: {
            status: 'completed',
            progress: 100,
            resultUrl: externalStatus.imageUrl,
          },
        };
      } else if (externalStatus.status === 'failed') {
        await supabase
          .from('generations')
          .update({
            status: 'failed',
            error_message: externalStatus.error,
          })
          .eq('id', generationId);

        return {
          success: true,
          data: {
            status: 'failed',
            progress: 0,
          },
        };
      } else {
        // 更新进度
        await supabase
          .from('generations')
          .update({
            progress: externalStatus.progress || generation.progress,
          })
          .eq('id', generationId);

        return {
          success: true,
          data: {
            status: externalStatus.status as TaskStatus,
            progress: externalStatus.progress || generation.progress || 0,
          },
        };
      }
    }

    // 默认返回当前状态
    return {
      success: true,
      data: {
        status: generation.status as TaskStatus,
        progress: generation.progress || 0,
      },
    };
  } catch (error) {
    console.error('[Status] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '查询失败',
    };
  }
}
