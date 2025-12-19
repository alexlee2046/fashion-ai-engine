import { createOpenAI } from '@ai-sdk/openai';

// 环境变量验证
function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing OPENROUTER_API_KEY environment variable. Get one at https://openrouter.ai/keys'
    );
  }

  return { apiKey };
}

// Create an OpenAI-compatible provider for OpenRouter
export const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'Fashion AI Engine',
  },
});

// 获取默认模型（带验证）
export function getDefaultModel() {
  getOpenRouterConfig(); // 验证 API Key 存在
  return openrouter('google/gemini-2.0-flash-exp:free');
}

// 模型配置
export const MODEL_CONFIG = {
  primary: 'google/gemini-3-flash-preview',
} as const;

// 默认模型: Gemini 3 Flash
export const defaultModel = openrouter('google/gemini-3-flash-preview');
