/**
 * VTON (Virtual Try-On) API 客户端
 *
 * 支持多个 VTON 提供商：
 * - SiliconFlow (默认)
 * - Replicate
 * - 自建服务
 */

export interface VTONRequest {
  productImageUrl: string;
  modelImageUrl?: string; // 可选的模特图，不提供则使用默认模特
  category?: 'upper_body' | 'lower_body' | 'dresses' | 'full_body';
}

export interface VTONResponse {
  success: boolean;
  taskId?: string;
  imageUrl?: string;
  error?: string;
}

export interface VTONTaskStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  imageUrl?: string;
  error?: string;
}

// ============================================
// 环境变量验证
// ============================================

function getVTONConfig() {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing SILICONFLOW_API_KEY environment variable. Get one at https://siliconflow.cn'
    );
  }

  return { apiKey };
}

// ============================================
// SiliconFlow VTON API
// ============================================

const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

/**
 * 提交 VTON 生成任务
 */
export async function submitVTONTask(request: VTONRequest): Promise<VTONResponse> {
  const { apiKey } = getVTONConfig();

  try {
    const response = await fetch(`${SILICONFLOW_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'Kolors-Virtual-Try-On', // 快手 Kolors VTON 模型
        human_image: request.modelImageUrl || getDefaultModelImage(),
        cloth_image: request.productImageUrl,
        // 可选参数
        num_inference_steps: 50,
        guidance_scale: 2.5,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[VTON] API Error:', errorData);
      return {
        success: false,
        error: `API Error: ${response.status} - ${errorData.message || 'Unknown error'}`,
      };
    }

    const data = await response.json();

    // SiliconFlow 可能返回同步结果或异步任务 ID
    if (data.images && data.images.length > 0) {
      // 同步返回结果
      return {
        success: true,
        imageUrl: data.images[0].url,
      };
    } else if (data.task_id) {
      // 异步任务
      return {
        success: true,
        taskId: data.task_id,
      };
    } else {
      return {
        success: false,
        error: 'Unexpected API response format',
      };
    }
  } catch (error) {
    console.error('[VTON] Request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

/**
 * 查询 VTON 任务状态
 */
export async function getVTONTaskStatus(taskId: string): Promise<VTONTaskStatus> {
  const { apiKey } = getVTONConfig();

  try {
    const response = await fetch(`${SILICONFLOW_BASE_URL}/async-tasks/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return {
        status: 'failed',
        error: `Failed to get task status: ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.status === 'SUCCESS' || data.status === 'completed') {
      return {
        status: 'completed',
        imageUrl: data.result?.images?.[0]?.url || data.output_url,
        progress: 100,
      };
    } else if (data.status === 'FAILED' || data.status === 'failed') {
      return {
        status: 'failed',
        error: data.error || 'Task failed',
      };
    } else if (data.status === 'PENDING') {
      return {
        status: 'pending',
        progress: 0,
      };
    } else {
      return {
        status: 'processing',
        progress: data.progress || 50,
      };
    }
  } catch (error) {
    console.error('[VTON] Status check failed:', error);
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Status check failed',
    };
  }
}

/**
 * 获取默认模特图
 * 可以换成你自己的模特图 URL
 */
function getDefaultModelImage(): string {
  // 使用一个公开的模特图作为默认值
  // 生产环境应该换成自己的素材
  return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=512&h=768&fit=crop';
}

// ============================================
// Mock 实现 (开发测试用)
// ============================================

export async function submitVTONTaskMock(_request: VTONRequest): Promise<VTONResponse> {
  // 模拟 API 延迟
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return {
    success: true,
    taskId: `mock-task-${Date.now()}`,
  };
}

export async function getVTONTaskStatusMock(taskId: string): Promise<VTONTaskStatus> {
  // 模拟处理进度
  const elapsed = Date.now() - parseInt(taskId.split('-').pop() || '0');
  const processingTime = 5000; // 5 秒模拟处理时间

  if (elapsed < processingTime) {
    return {
      status: 'processing',
      progress: Math.min(90, Math.floor((elapsed / processingTime) * 100)),
    };
  }

  return {
    status: 'completed',
    progress: 100,
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=512&h=768&fit=crop',
  };
}
