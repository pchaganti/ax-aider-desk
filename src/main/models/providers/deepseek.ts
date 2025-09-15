import { ModelInfo, Model, SettingsData } from '@common/types';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadDeepseekModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[] | undefined> => {
  const apiKey = settings.llmProviders?.deepseek?.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('DEEPSEEK_API_KEY', undefined, settings);

  if (!apiKey && !apiKeyEnv?.value) {
    return undefined;
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey || apiKeyEnv?.value || ''}` },
    });
    if (!response.ok) {
      logger.error('DeepSeek models API response failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const models =
      data.data?.map((m: { id: string }) => {
        const info = modelsInfo[m.id];
        return { id: m.id, ...info };
      }) || [];

    logger.info(`Loaded ${models.length} DeepSeek models`);
    return models;
  } catch (error) {
    logger.error('Error loading DeepSeek models:', error);
    return [];
  }
};
