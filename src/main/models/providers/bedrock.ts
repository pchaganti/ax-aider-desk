import { ModelInfo, Model, SettingsData } from '@common/types';
import { BedrockClient, ListInferenceProfilesCommand, GetFoundationModelAvailabilityCommand, type InferenceProfileSummary } from '@aws-sdk/client-bedrock';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadBedrockModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[]> => {
  const bedrockConfig = settings.llmProviders?.bedrock;
  const regionEnv = getEffectiveEnvironmentVariable('AWS_REGION', undefined, settings);
  const region = bedrockConfig?.region || regionEnv?.value || '';
  const accessKeyIdEnv = getEffectiveEnvironmentVariable('AWS_ACCESS_KEY_ID', undefined, settings);
  const accessKeyId = bedrockConfig?.accessKeyId || accessKeyIdEnv?.value || '';
  const secretAccessKeyEnv = getEffectiveEnvironmentVariable('AWS_SECRET_ACCESS_KEY', undefined, settings);
  const secretAccessKey = bedrockConfig?.secretAccessKey || secretAccessKeyEnv?.value || '';
  const sessionTokenEnv = getEffectiveEnvironmentVariable('AWS_SESSION_TOKEN', undefined, settings);
  const sessionToken = bedrockConfig?.sessionToken || sessionTokenEnv?.value || '';
  const profileEnv = getEffectiveEnvironmentVariable('AWS_PROFILE', undefined, settings);

  if (!region) {
    logger.debug('AWS region is required for Bedrock. Please set it in Providers settings or via AWS_REGION environment variable.');
    return [];
  }

  // Check if we have explicit keys or if AWS_PROFILE is set in the main process env
  if (!accessKeyId && !secretAccessKey && !profileEnv?.value) {
    logger.debug(
      'AWS credentials (accessKeyId/secretAccessKey) or AWS_PROFILE must be provided for Bedrock in Providers settings or Aider environment variables.',
    );
    return [];
  }

  try {
    const client = new BedrockClient({
      region,
      ...(accessKeyId &&
        secretAccessKey && {
          credentials: {
            accessKeyId,
            secretAccessKey,
            sessionToken: sessionToken || undefined,
          },
        }),
    });

    const allActiveProfiles: InferenceProfileSummary[] = [];
    let nextToken: string | undefined;

    do {
      const command = new ListInferenceProfilesCommand({
        maxResults: 50,
        nextToken,
      });

      const response = await client.send(command);
      nextToken = response.nextToken; // Will be undefined if no more pages

      // Collect active profiles
      const pageActiveProfiles = response.inferenceProfileSummaries?.filter((profile) => profile.status === 'ACTIVE') || [];
      allActiveProfiles.push(...pageActiveProfiles);
    } while (nextToken);

    // Now, prepare availability checks in parallel
    const availabilityPromises = allActiveProfiles.map(async (profile) => {
      if (!profile.inferenceProfileId || !profile.models || profile.models.length === 0) {
        logger.warn('Profile missing inferenceProfileId or models, skipping');
        return Promise.reject(new Error('Invalid profile'));
      }

      // Extract modelId from the first model's modelArn
      const firstModelArn = profile.models[0].modelArn;
      const modelId = firstModelArn ? firstModelArn.split('/').pop() : undefined;

      if (!modelId) {
        logger.warn('Unable to extract modelId from profile, skipping');
        return Promise.reject(new Error('Invalid modelId'));
      }

      const availabilityCommand = new GetFoundationModelAvailabilityCommand({
        modelId,
      });

      try {
        const response = await client.send(availabilityCommand);
        return { profile, modelId, response };
      } catch (error) {
        logger.error(`Error checking availability for profile ${profile.inferenceProfileId!} with model ${modelId!}:`, error);
        return null;
      }
    });

    const availabilityResults = await Promise.all(availabilityPromises);

    const availableProfiles: Model[] = [];
    for (const result of availabilityResults) {
      if (!result) {
        continue;
      }

      const { profile, modelId, response } = result;

      // Check if the model is authorized and available
      if (response.authorizationStatus === 'AUTHORIZED' && response.entitlementAvailability === 'AVAILABLE' && response.regionAvailability === 'AVAILABLE') {
        const info = modelsInfo[modelId];
        if (info) {
          availableProfiles.push({ id: profile.inferenceProfileId!, ...info });
        } else {
          availableProfiles.push({ id: profile.inferenceProfileId! });
        }
        logger.debug(`Profile ${profile.inferenceProfileId!} with model ${modelId!} is available and authorized`);
      } else {
        logger.debug(`Profile ${profile.inferenceProfileId!} with model ${modelId!} is not available or not authorized`, {
          authorizationStatus: response.authorizationStatus,
          entitlementAvailability: response.entitlementAvailability,
          regionAvailability: response.regionAvailability,
        });
      }
    }

    logger.info(`Loaded ${availableProfiles.length} available Bedrock inference profiles`);
    return availableProfiles;
  } catch (error) {
    logger.error('Error loading Bedrock models:', error);
    return [];
  }
};
