// ============================================
// 核心业务类型定义
// ============================================

// 平台类型
export type Platform = 'douyin' | 'red' | 'tiktok';

// 营销脚本结构
export interface ScriptSchema {
  title: string;
  hook: string;
  body: string;
  callToAction: string;
  hashtags: string[];
}

// 生成任务类型
export type GenerationType = 'image_model' | 'video_marketing';

// 任务状态
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Campaign 状态
export type CampaignStatus = 'draft' | 'script_generated' | 'image_generated' | 'video_generated' | 'completed';

// ============================================
// API 响应类型
// ============================================

// 统一的 API 响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 脚本生成响应
export interface GenerateScriptResponse extends ApiResponse<ScriptSchema> {
  campaignId?: string;
}

// 图片生成响应
export interface GenerateImageResponse extends ApiResponse<{ imageUrl: string }> {
  taskId?: string;
}

// 任务状态响应
export interface TaskStatusResponse extends ApiResponse<{
  status: TaskStatus;
  resultUrl?: string;
  progress?: number;
}> {
  taskId: string;
}

// ============================================
// 数据库实体类型
// ============================================

export interface Campaign {
  id: string;
  created_at: string;
  user_id?: string;
  product_description: string;
  platform: Platform;
  script_data?: ScriptSchema;
  status: CampaignStatus;
}

export interface Generation {
  id: string;
  created_at: string;
  campaign_id: string;
  type: GenerationType;
  status: TaskStatus;
  prompt_used?: string;
  result_url?: string;
  provider_id?: string;
  input_image_url?: string;
  model_params?: Record<string, unknown>;
}

// ============================================
// 输入验证常量
// ============================================

export const VALIDATION = {
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 2000,
  PLATFORMS: ['douyin', 'red', 'tiktok'] as const,
} as const;
