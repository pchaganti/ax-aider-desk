import { ModelInfo, Model, SettingsData } from '@common/types';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadOpenAiModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[]> => {
  const apiKey = settings.llmProviders?.openai?.apiKey || '';
  const environmentVariable = getEffectiveEnvironmentVariable('OPENAI_API_KEY', undefined, settings);
  const effectiveApiKey = apiKey || environmentVariable?.value || '';

  if (!effectiveApiKey) {
    return [];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });
    if (!response.ok) {
      logger.error('OpenAI models API response failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const filteredModels =
      data.data?.filter((model: { id: string }) => {
        const id = model.id;
        if (id.startsWith('dall-e') || id.startsWith('gpt-image') || id.startsWith('chatgpt') || id.startsWith('codex')) {
          return false;
        }
        if (id.includes('embedding')) {
          return false;
        }
        if (id.includes('-audio') || id.includes('-realtime')) {
          return false;
        }
        if (id.startsWith('davinci') || id.startsWith('babbage')) {
          return false;
        }
        if (id.startsWith('tts-') || id.startsWith('whisper-')) {
          return false;
        }
        if (id.includes('transcribe') || id.includes('tts') || id.includes('moderation') || id.includes('search')) {
          return false;
        }
        return true;
      }) || [];
    const models =
      filteredModels.map((model: { id: string }) => {
        const info = modelsInfo[model.id];
        return { id: model.id, ...info };
      }) || [];

    logger.info(`Loaded ${models.length} OpenAI models`);
    return models;
  } catch (error) {
    logger.error('Error loading OpenAI models:', error);
    return [];
  }
};
