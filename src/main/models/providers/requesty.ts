import { ModelInfo, Model, SettingsData } from '@common/types';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadRequestyModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[]> => {
  const apiKey = settings.llmProviders?.requesty?.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('REQUESTY_API_KEY', undefined, settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    return [];
  }

  try {
    const response = await fetch('https://router.requesty.ai/v1/models', {
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
      },
    });
    if (!response.ok) {
      logger.error('Requesty models API response failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const models =
      data.data?.map((model: { id: string }) => {
        const info = modelsInfo[model.id];
        return { id: model.id, ...info };
      }) || [];
    logger.info(`Loaded ${models.length} Requesty models`);
    return models;
  } catch (error) {
    logger.warn('Failed to fetch Requesty models via API:', error);
    return [];
  }
};
