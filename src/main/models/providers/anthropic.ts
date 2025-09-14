import { Model, ModelInfo, SettingsData } from '@common/types';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadAnthropicModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[] | undefined> => {
  const apiKey = settings.llmProviders?.anthropic?.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', undefined, settings);

  if (!apiKey && !apiKeyEnv?.value) {
    return undefined;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey || apiKeyEnv?.value || '',
        'anthropic-version': '2023-06-01',
      },
    });
    if (!response.ok) {
      logger.error('Anthropic models API response failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const models =
      data.data?.map((m: { id: string }) => {
        const info = modelsInfo[m.id];
        return { id: m.id, ...info };
      }) || [];

    logger.info(`Loaded ${models.length} Anthropic models`);
    return models;
  } catch (error) {
    logger.error('Error loading Anthropic models:', error);
    return [];
  }
};
