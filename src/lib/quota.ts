import { createClient } from '@/lib/supabase/server'

// ============================================
// 配额限制常量
// ============================================

export const QUOTA_LIMITS = {
  DAILY_SCRIPT: 10,
  DAILY_IMAGE: 3,
} as const

export type QuotaType = 'script' | 'image'

// ============================================
// 类型定义
// ============================================

export interface QuotaStatus {
  used: number
  limit: number
  remaining: number
  canUse: boolean
}

export interface QuotaCheckResult {
  success: boolean
  quota?: QuotaStatus
  error?: string
}

// ============================================
// 配额检查
// ============================================

/**
 * 检查用户配额
 * @param userId 用户 ID
 * @param type 配额类型 ('script' | 'image')
 * @returns 配额状态
 */
export async function checkQuota(
  userId: string,
  type: QuotaType
): Promise<QuotaCheckResult> {
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    // 获取今日配额记录
    const { data: quotaRecord, error } = await supabase
      .from('user_quotas')
      .select('script_count, image_count')
      .eq('user_id', userId)
      .eq('date', today)
      .single()

    // PGRST116 = no rows found (正常情况，用户今天还没用过)
    if (error && error.code !== 'PGRST116') {
      console.error('[Quota] Check error:', error)
      return { success: false, error: '查询配额失败' }
    }

    const used = quotaRecord
      ? type === 'script'
        ? quotaRecord.script_count
        : quotaRecord.image_count
      : 0

    const limit =
      type === 'script' ? QUOTA_LIMITS.DAILY_SCRIPT : QUOTA_LIMITS.DAILY_IMAGE
    const remaining = Math.max(0, limit - used)

    return {
      success: true,
      quota: {
        used,
        limit,
        remaining,
        canUse: remaining > 0,
      },
    }
  } catch (error) {
    console.error('[Quota] Unexpected error:', error)
    return { success: false, error: '配额检查失败' }
  }
}

// ============================================
// 配额增加
// ============================================

/**
 * 增加配额使用计数
 * @param userId 用户 ID
 * @param type 配额类型 ('script' | 'image')
 * @returns 操作结果
 */
export async function incrementQuota(
  userId: string,
  type: QuotaType
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    // 使用 RPC 函数进行原子更新
    const { error } = await supabase.rpc('increment_quota', {
      p_user_id: userId,
      p_date: today,
      p_type: type,
    })

    if (error) {
      console.error('[Quota] Increment error:', error)
      return { success: false, error: '更新配额失败' }
    }

    return { success: true }
  } catch (error) {
    console.error('[Quota] Unexpected error:', error)
    return { success: false, error: '配额更新失败' }
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取配额不足的错误消息
 */
export function getQuotaExceededMessage(type: QuotaType, quota: QuotaStatus): string {
  const typeName = type === 'script' ? '脚本生成' : '模特图生成'
  return `今日${typeName}次数已用完 (${quota.used}/${quota.limit})，请明天再试`
}
