import { ModelInfo, Model, SettingsData } from '@common/types';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadOllamaModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[] | undefined> => {
  const baseUrl = settings.llmProviders?.ollama?.baseUrl || '';
  const environmentVariable = getEffectiveEnvironmentVariable('OLLAMA_API_BASE', undefined, settings);
  const effectiveBaseUrl = baseUrl || environmentVariable?.value || '';

  if (!effectiveBaseUrl) {
    return undefined;
  }

  try {
    let normalized = effectiveBaseUrl.replace(/\/+$/, ''); // Remove all trailing slashes
    if (!normalized.endsWith('/api')) {
      normalized = `${normalized}/api`;
    }
    const response = await fetch(`${normalized}/tags`);
    if (!response.ok) {
      logger.warn('Ollama models API response failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const models =
      data?.models?.map((m: { name: string }) => {
        const modelParts = m.name.split('/');
        const info = modelsInfo[modelParts[modelParts.length - 1]];
        return {
          id: m.name,
          ...info, // Merge with existing model info if available
        };
      }) || [];
    logger.info(`Loaded ${models.length} Ollama models from ${effectiveBaseUrl}`);
    return models;
  } catch (error) {
    logger.error('Error loading Ollama models:', error);
    return [];
  }
};
