import { ModelInfo, Model, SettingsData } from '@common/types';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadGeminiModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[] | undefined> => {
  const apiKey = settings.llmProviders?.gemini?.apiKey || '';
  const baseUrl = settings.llmProviders?.gemini?.customBaseUrl || 'https://generativelanguage.googleapis.com';

  const apiKeyEnv = getEffectiveEnvironmentVariable('GEMINI_API_KEY', undefined, settings);
  const baseUrlEnv = getEffectiveEnvironmentVariable('GEMINI_API_BASE_URL', undefined, settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value || 'https://generativelanguage.googleapis.com';

  if (!effectiveApiKey) {
    return undefined;
  }

  try {
    const url = `${effectiveBaseUrl}/v1beta/models?key=${effectiveApiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      logger.error('Gemini models API response failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const models =
      data.models
        ?.filter((model: { supportedGenerationMethods?: string[] }) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model: { name: string; inputTokenLimit?: number; outputTokenLimit?: number; supportedGenerationMethods?: string[] }) => {
          const modelId = model.name.replace('models/', '');
          const info = modelsInfo[modelId];
          return {
            ...info,
            id: modelId,
            maxInputTokens: model.inputTokenLimit,
            maxOutputTokens: model.outputTokenLimit,
          };
        }) || [];

    logger.info(`Loaded ${models.length} Gemini models`);
    return models;
  } catch (error) {
    logger.error('Error loading Gemini models:', error);
    return [];
  }
};
