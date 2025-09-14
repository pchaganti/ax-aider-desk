import { ModelInfo, Model, SettingsData } from '@common/types';
import { v1beta1 } from '@google-cloud/aiplatform';
import { GoogleAuth } from 'google-auth-library';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadVertexAIModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[] | undefined> => {
  const vertexAiConfig = settings.llmProviders?.['vertex-ai'];

  const projectEnv = getEffectiveEnvironmentVariable('VERTEXAI_PROJECT', undefined, settings);
  const locationEnv = getEffectiveEnvironmentVariable('VERTEXAI_LOCATION', undefined, settings);
  const credentialsEnv = getEffectiveEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', undefined, settings);

  const project = vertexAiConfig?.project || projectEnv?.value || '';
  const location = vertexAiConfig?.location || locationEnv?.value || 'global';
  const googleCloudCredentialsJson = vertexAiConfig?.googleCloudCredentialsJson || credentialsEnv?.value || '';

  if (!project) {
    logger.debug('Vertex AI project ID is required. Please set it in Providers settings or via VERTEXAI_PROJECT environment variable.');
    return undefined;
  }

  if (!location) {
    logger.debug('Vertex AI location is required. Please set it in Providers settings or via VERTEXAI_LOCATION environment variable.');
    return undefined;
  }

  try {
    let auth: GoogleAuth;
    if (googleCloudCredentialsJson) {
      // Use provided credentials JSON
      auth = new GoogleAuth({
        credentials: JSON.parse(googleCloudCredentialsJson),
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    } else {
      // Use default credentials (e.g., gcloud, environment variables, or service account)
      auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    }

    const clientOptions = {
      apiEndpoint: 'aiplatform.googleapis.com',
      auth,
    };

    const modelGardenServiceClient = new v1beta1.ModelGardenServiceClient(clientOptions);
    const [response] = await modelGardenServiceClient.listPublisherModels({
      parent: 'publishers/google',
    });

    const models = response
      .map((model) => {
        const modelId = model.name?.split('/').pop();
        const info = modelsInfo[modelId || ''];

        return {
          id: modelId,
          ...info,
        };
      })
      .filter((model) => model.id) as Model[];

    logger.info(`Loaded ${models.length} Vertex AI models for project ${project} in location ${location}`);
    return models;
  } catch (error) {
    logger.error(`Error loading Vertex AI models for project ${project} in location ${location}:`, error);
    return [];
  }
};
