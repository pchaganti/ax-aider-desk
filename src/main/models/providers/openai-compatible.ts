import { Model, ModelInfo, SettingsData } from '@common/types';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadOpenaiCompatibleModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[] | undefined> => {
  const config = settings.llmProviders?.['openai-compatible'];
  const apiKey = config?.apiKey || '';
  const baseUrl = config?.baseUrl;

  const apiKeyEnv = getEffectiveEnvironmentVariable('OPENAI_API_KEY', undefined, settings);
  const baseUrlEnv = getEffectiveEnvironmentVariable('OPENAI_API_BASE', undefined, settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value;

  if (!(effectiveApiKey && effectiveBaseUrl)) {
    return undefined;
  }

  try {
    const response = await fetch(`${effectiveBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });
    if (!response.ok) {
      logger.debug('OpenAI-compatible models API response failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const models =
      data.data?.map((model: { id: string }) => {
        const info = modelsInfo[model.id];
        return { id: model.id, ...info };
      }) || [];

    logger.info(`Loaded ${models.length} OpenAI-compatible models`);
    return models;
  } catch (error) {
    logger.warn('Failed to fetch OpenAI-compatible models via API:', error);
    return [];
  }
};
