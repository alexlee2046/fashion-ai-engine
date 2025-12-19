'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { defaultModel } from '@/lib/ai-config';
import { createClient } from '@/lib/supabase/server';
import {
  checkQuota,
  incrementQuota,
  getQuotaExceededMessage,
} from '@/lib/quota';
import type {
  Platform,
  ScriptSchema,
  GenerateScriptResponse,
} from '@/types';

// ============================================
// Schema 定义
// ============================================

const scriptSchema = z.object({
  title: z.string().describe('A catchy title for the video'),
  hook: z.string().describe('The first 3 seconds of the video to grab attention'),
  body: z.string().describe('The main content describing the product features and benefits'),
  callToAction: z.string().describe('The closing line to drive sales'),
  hashtags: z.array(z.string()).describe('List of relevant hashtags for social media'),
});

// ============================================
// 输入验证
// ============================================

const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 2000;
const VALID_PLATFORMS: Platform[] = ['douyin', 'red', 'tiktok'];

function validateInput(
  productDescription: string,
  platform: string
): { valid: true } | { valid: false; error: string } {
  if (!productDescription || typeof productDescription !== 'string') {
    return { valid: false, error: '产品描述不能为空' };
  }

  const trimmed = productDescription.trim();

  if (trimmed.length < DESCRIPTION_MIN_LENGTH) {
    return { valid: false, error: `产品描述至少需要 ${DESCRIPTION_MIN_LENGTH} 个字符` };
  }

  if (trimmed.length > DESCRIPTION_MAX_LENGTH) {
    return { valid: false, error: `产品描述不能超过 ${DESCRIPTION_MAX_LENGTH} 个字符` };
  }

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return { valid: false, error: `无效的平台，支持: ${VALID_PLATFORMS.join(', ')}` };
  }

  return { valid: true };
}

// ============================================
// 营销脚本生成
// ============================================

export async function generateMarketingScript(
  productDescription: string,
  platform: Platform = 'douyin'
): Promise<GenerateScriptResponse> {
  // 1. 输入验证
  const validation = validateInput(productDescription, platform);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const supabase = await createClient();

  // 2. 用户认证检查
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '请先登录' };
  }

  // 3. 配额检查
  const quotaCheck = await checkQuota(user.id, 'script');
  if (!quotaCheck.success) {
    return { success: false, error: quotaCheck.error || '配额检查失败' };
  }
  if (!quotaCheck.quota?.canUse) {
    return {
      success: false,
      error: getQuotaExceededMessage('script', quotaCheck.quota!),
    };
  }

  const systemPrompt = `You are an expert fashion marketing copywriter for the Chinese market.
  Create a high-conversion video script for the following product.
  Platform: ${platform}.
  Tone: Energetic, persuasive, and trend-aware.
  Language: Chinese (Simplified).`;

  try {
    // 4. Generate content via AI
    const { object } = await generateObject({
      model: defaultModel,
      schema: scriptSchema,
      system: systemPrompt,
      prompt: `Product Description: ${productDescription.trim()}`,
    });

    const scriptData = object as ScriptSchema;

    // 5. 增加配额使用计数
    await incrementQuota(user.id, 'script');

    // 6. Save to Supabase DB (添加 user_id)
    const { data: campaign, error: dbError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        product_description: productDescription.trim(),
        platform: platform,
        script_data: scriptData,
        status: 'script_generated',
      })
      .select()
      .single();

    if (dbError) {
      // 记录错误但不阻断流程，返回 AI 结果
      console.error('[DB Error] Failed to save campaign:', dbError.message);
    }

    return {
      success: true,
      data: scriptData,
      campaignId: campaign?.id,
    };
  } catch (error) {
    console.error('[AI Error] Failed to generate script:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '生成脚本失败，请稍后重试',
    };
  }
}

// ============================================
// 完整工作流 (Phase 3 实现)
// ============================================

export async function runFullWorkflow(
  imageUrl: string,
  platform: Platform = 'douyin'
): Promise<GenerateScriptResponse> {
  // Phase 3: 完整流水线
  // 1. Vision Analysis -> 获取商品描述
  // 2. Script Generation -> 生成营销脚本
  // 3. Image Gen -> 生成模特图
  // 4. Video Gen -> 生成营销视频

  // 当前仅实现脚本生成部分
  const mockDescription = 'A stylish floral summer dress, lightweight, breathable.';

  const scriptResult = await generateMarketingScript(mockDescription, platform);

  if (!scriptResult.success || !scriptResult.data) {
    return { success: false, error: scriptResult.error || '脚本生成失败' };
  }

  return {
    success: true,
    data: scriptResult.data,
    campaignId: scriptResult.campaignId,
  };
}
