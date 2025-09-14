import { ModelInfo, Model, SettingsData } from '@common/types';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

interface GroqModel {
  id: string;
}

interface GroqApiResponse {
  data: GroqModel[];
}

export const loadGroqModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[] | undefined> => {
  const apiKey = settings.llmProviders?.groq?.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('GROQ_API_KEY', undefined, settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    logger.debug('Groq API key is required. Please set it in Providers settings or via GROQ_API_KEY environment variable.');
    return undefined;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });

    if (!response.ok) {
      logger.error('Groq models API response failed:', {
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const data: GroqApiResponse = await response.json();
    const models =
      data.data
        ?.filter((model: GroqModel) => {
          // Filter out models that don't have pricing information
          return modelsInfo[model.id];
        })
        .map((model: GroqModel) => {
          const info = modelsInfo[model.id];
          return { id: model.id, ...info };
        }) || [];

    logger.info(`Loaded ${models.length} Groq models`);
    return models;
  } catch (error) {
    logger.error('Error loading Groq models:', error);
    return [];
  }
};
