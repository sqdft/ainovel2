import { Provider } from '../types';

export const MODELS_BY_PROVIDER: Record<Provider, string[]> = {
  gemini: ['gemini-3.1-pro-preview', 'gemini-3.0-pro', 'gemini-2.5-pro', 'gemini-2.0-pro', 'gemini-1.5-pro'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  zhipu: ['glm-4', 'glm-3-turbo', 'glm-4-plus'],
  moonshot: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  custom: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
  kilo: [],
  free: ['Qwen3.5', 'Qwen2.5', 'Qwen2'],
};

export function getModelsByProvider(provider: Provider): string[] {
  return MODELS_BY_PROVIDER[provider] || [];
}

export function getDefaultModel(provider: Provider): string {
  const models = getModelsByProvider(provider);
  return models.length > 0 ? models[0] : '';
}
