import { Provider } from '../types';

export const PROVIDERS: Record<Provider, { label: string, baseUrl: string, model: string }> = {
  gemini: { label: 'Google Gemini', baseUrl: '', model: 'gemini-3.1-pro-preview' },
  deepseek: { label: 'DeepSeek (深度求索)', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  zhipu: { label: '智谱清言 (Zhipu)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4' },
  moonshot: { label: 'Kimi (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  custom: { label: '自定义 (OpenAI 兼容)', baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo' },
  kilo: { label: '自定义代理', baseUrl: '', model: '' },
  free: { label: '免费模型 ', baseUrl: 'https://api-ai.7e.ink/v1', model: 'Qwen3.5' },
};

export function getProviderConfig(provider: Provider) {
  return PROVIDERS[provider];
}
