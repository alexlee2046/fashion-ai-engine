// ============================================
// 错误类型分类
// ============================================

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTH = 'AUTH',
  QUOTA = 'QUOTA',
  API_TIMEOUT = 'API_TIMEOUT',
  API_ERROR = 'API_ERROR',
  DB_ERROR = 'DB_ERROR',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN',
}

// ============================================
// 错误消息映射 (中文)
// ============================================

export const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.VALIDATION]: '输入验证失败',
  [ErrorType.AUTH]: '认证失败，请重新登录',
  [ErrorType.QUOTA]: '今日使用次数已达上限',
  [ErrorType.API_TIMEOUT]: '服务响应超时，请稍后重试',
  [ErrorType.API_ERROR]: '服务暂时不可用，请稍后重试',
  [ErrorType.DB_ERROR]: '数据保存失败',
  [ErrorType.NETWORK]: '网络连接失败，请检查网络',
  [ErrorType.UNKNOWN]: '发生未知错误，请稍后重试',
}

// ============================================
// 错误包装器
// ============================================

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public userMessage: string = ERROR_MESSAGES[type],
    public originalError?: unknown
  ) {
    super(userMessage)
    this.name = 'AppError'
  }

  toJSON() {
    return {
      type: this.type,
      message: this.userMessage,
    }
  }
}

// ============================================
// 带重试的 fetch
// ============================================

export interface FetchWithRetryConfig {
  maxRetries?: number
  timeout?: number
  retryDelay?: number
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: FetchWithRetryConfig = {}
): Promise<Response> {
  const { maxRetries = 3, timeout = 30000, retryDelay = 1000 } = config

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      // 成功或客户端错误 (4xx) 直接返回
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response
      }

      // 5xx 服务端错误，最后一次尝试也返回
      if (attempt === maxRetries) {
        return response
      }

      // 重试前等待
      console.warn(
        `[Fetch] Attempt ${attempt} failed with status ${response.status}, retrying...`
      )
      await new Promise((r) => setTimeout(r, retryDelay * attempt))
    } catch (error) {
      clearTimeout(timeoutId)

      // 最后一次尝试抛出错误
      if (attempt === maxRetries) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new AppError(ErrorType.API_TIMEOUT)
        }
        throw new AppError(ErrorType.NETWORK, undefined, error)
      }

      // 重试前等待
      console.warn(`[Fetch] Attempt ${attempt} failed, retrying...`, error)
      await new Promise((r) => setTimeout(r, retryDelay * attempt))
    }
  }

  // 理论上不会到达这里
  throw new AppError(ErrorType.UNKNOWN)
}

// ============================================
// 环境变量检查
// ============================================

export function validateEnvVars(vars: string[]): void {
  const missing = vars.filter((v) => !process.env[v])
  if (missing.length > 0) {
    throw new Error(`缺少必要的环境变量: ${missing.join(', ')}`)
  }
}

// ============================================
// 错误处理辅助函数
// ============================================

/**
 * 将任意错误转换为用户友好的消息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage
  }

  if (error instanceof Error) {
    // 检查常见错误模式
    if (error.message.includes('timeout') || error.name === 'AbortError') {
      return ERROR_MESSAGES[ErrorType.API_TIMEOUT]
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return ERROR_MESSAGES[ErrorType.NETWORK]
    }
    return error.message
  }

  return ERROR_MESSAGES[ErrorType.UNKNOWN]
}

/**
 * 安全地执行异步操作并返回结果
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.error('[SafeAsync] Error:', error)
    return fallback
  }
}
