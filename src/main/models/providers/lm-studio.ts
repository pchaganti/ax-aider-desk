import { ModelInfo, Model, SettingsData } from '@common/types';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadLmStudioModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[]> => {
  const baseUrl = settings.llmProviders?.lmstudio?.baseUrl || '';
  const environmentVariable = getEffectiveEnvironmentVariable('LMSTUDIO_API_BASE', undefined, settings);
  const effectiveBaseUrl = baseUrl || environmentVariable?.value || '';

  if (!effectiveBaseUrl) {
    return [];
  }

  try {
    const normalized = effectiveBaseUrl.replace(/\/+$/g, ''); // Remove all trailing slashes
    const response = await fetch(`${normalized}/models`);
    if (!response.ok) {
      logger.warn('LM Studio models API response failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const models =
      data?.data?.map((m: { id: string }) => {
        const modelParts = m.id.split('/');
        const info = modelsInfo[modelParts[modelParts.length - 1]];
        return {
          id: m.id,
          ...info, // Merge with existing model info if available
        };
      }) || [];
    logger.info(`Loaded ${models.length} LM Studio models from ${effectiveBaseUrl}`);
    return models;
  } catch (error) {
    logger.error('Error loading LM Studio models:', error);
    return [];
  }
};
