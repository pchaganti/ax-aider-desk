import { Model, ModelInfo, SettingsData } from '@common/types';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadOpenrouterModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[] | undefined> => {
  const apiKey = settings.llmProviders?.openrouter?.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('OPENROUTER_API_KEY', undefined, settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    return undefined;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
      },
    });
    if (!response.ok) {
      logger.error('OpenRouter models API response failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const models =
      data.data?.map((model: { id: string }) => {
        const info = modelsInfo[model.id];
        return { id: model.id, ...info };
      }) || [];

    logger.info(`Loaded ${models.length} OpenRouter models`);
    return models;
  } catch (error) {
    logger.error('Error loading OpenRouter models:', error);
    return [];
  }
};
