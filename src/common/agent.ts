import { AgentProfile, ReasoningEffort, SettingsData, ToolApprovalState } from '@common/types';
import {
  AIDER_TOOL_ADD_CONTEXT_FILE,
  AIDER_TOOL_DROP_CONTEXT_FILE,
  AIDER_TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_BASH,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';

import type { JSONValue } from 'ai';

export type LlmProviderName = 'openai' | 'anthropic' | 'gemini' | 'bedrock' | 'deepseek' | 'openai-compatible' | 'ollama' | 'openrouter' | 'requesty';

export interface LlmProviderBase {
  name: LlmProviderName;
}

export interface OllamaProvider extends LlmProviderBase {
  name: 'ollama';
  baseUrl: string;
}

export const AVAILABLE_PROVIDERS: LlmProviderName[] = [
  'anthropic',
  'bedrock',
  'deepseek',
  'gemini',
  'ollama',
  'openai',
  'openai-compatible',
  'openrouter',
  'requesty',
];

export interface OpenAiProvider extends LlmProviderBase {
  name: 'openai';
  apiKey: string;
}
export const isOpenAiProvider = (provider: LlmProviderBase): provider is OpenAiProvider => provider.name === 'openai';

export interface AnthropicProvider extends LlmProviderBase {
  name: 'anthropic';
  apiKey: string;
}
export const isAnthropicProvider = (provider: LlmProviderBase): provider is AnthropicProvider => provider.name === 'anthropic';

export interface GeminiProvider extends LlmProviderBase {
  name: 'gemini';
  apiKey: string;
}
export const isGeminiProvider = (provider: LlmProviderBase): provider is GeminiProvider => provider.name === 'gemini';

export interface DeepseekProvider extends LlmProviderBase {
  name: 'deepseek';
  apiKey: string;
}
export const isDeepseekProvider = (provider: LlmProviderBase): provider is DeepseekProvider => provider.name === 'deepseek';

export interface BedrockProvider extends LlmProviderBase {
  name: 'bedrock';
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}
export const isBedrockProvider = (provider: LlmProviderBase): provider is BedrockProvider => provider.name === 'bedrock';

export interface OpenAiCompatibleProvider extends LlmProviderBase {
  name: 'openai-compatible';
  apiKey: string;
  baseUrl?: string;
  models: string[];
}
export const isOpenAiCompatibleProvider = (provider: LlmProviderBase): provider is OpenAiCompatibleProvider => provider.name === 'openai-compatible';

export const isOllamaProvider = (provider: LlmProviderBase): provider is OllamaProvider => provider.name === 'ollama';

export interface OpenRouterProvider extends LlmProviderBase {
  name: 'openrouter';
  apiKey: string;
  models: string[];
}
export const isOpenRouterProvider = (provider: LlmProviderBase): provider is OpenRouterProvider => provider.name === 'openrouter';

export interface RequestyProvider extends LlmProviderBase {
  name: 'requesty';
  apiKey: string;
  models: string[];
  useAutoCache: boolean;
  reasoningEffort: ReasoningEffort;
}
export const isRequestyProvider = (provider: LlmProviderBase): provider is RequestyProvider => provider.name === 'requesty';

export type LlmProvider =
  | OpenAiProvider
  | AnthropicProvider
  | GeminiProvider
  | BedrockProvider
  | DeepseekProvider
  | OpenAiCompatibleProvider
  | OllamaProvider
  | OpenRouterProvider
  | RequestyProvider;

// prices in dollars per million tokens
export const PROVIDER_MODELS: Partial<
  Record<
    LlmProviderName,
    {
      models: Record<
        string,
        {
          inputCost: number;
          outputCost: number;
          cacheCreationInputCost?: number;
          cacheReadInputCost?: number;
          maxInputTokens?: number;
        }
      >;
    }
  >
> = {
  openai: {
    models: {
      'gpt-4o-mini': {
        inputCost: 0.15,
        outputCost: 0.6,
        maxInputTokens: 128_000,
      },
      'o4-mini': {
        inputCost: 1.1,
        outputCost: 4.4,
        maxInputTokens: 200_000,
      },
      'gpt-4.1': {
        inputCost: 2,
        outputCost: 8,
        maxInputTokens: 1_047_576,
      },
      'gpt-4.1-mini': {
        inputCost: 0.4,
        outputCost: 1.6,
        maxInputTokens: 1_047_576,
      },
    },
  },
  anthropic: {
    models: {
      'claude-sonnet-4-20250514': {
        inputCost: 3.0,
        outputCost: 15.0,
        cacheCreationInputCost: 3.75,
        cacheReadInputCost: 0.3,
        maxInputTokens: 200_000,
      },
      'claude-3-7-sonnet-20250219': {
        inputCost: 3.0,
        outputCost: 15.0,
        cacheCreationInputCost: 3.75,
        cacheReadInputCost: 0.3,
        maxInputTokens: 200_000,
      },
      'claude-3-5-haiku-20241022': {
        inputCost: 0.8,
        outputCost: 4.0,
        cacheCreationInputCost: 1,
        cacheReadInputCost: 0.08,
        maxInputTokens: 200_000,
      },
    },
  },
  gemini: {
    models: {
      'gemini-2.5-pro-preview-05-06': {
        inputCost: 1.25,
        outputCost: 10,
        maxInputTokens: 1_048_576,
      },
      'gemini-2.5-flash-preview-05-20': {
        inputCost: 0.15,
        outputCost: 0.6,
        maxInputTokens: 1_048_576,
      },
      'gemini-2.0-flash': {
        inputCost: 0.1,
        outputCost: 0.4,
        maxInputTokens: 1_048_576,
      },
      'gemini-2.5-pro-exp-03-25': {
        inputCost: 0,
        outputCost: 0,
        maxInputTokens: 1_048_576,
      },
      'gemini-2.0-flash-exp': {
        inputCost: 0,
        outputCost: 0,
        maxInputTokens: 1_048_576,
      },
    },
  },
  deepseek: {
    models: {
      'deepseek-chat': {
        inputCost: 0.27,
        outputCost: 1.1,
        maxInputTokens: 163_840,
      },
    },
  },
  bedrock: {
    models: {
      'us.anthropic.claude-3-7-sonnet-20250219-v1:0': {
        inputCost: 3.0,
        outputCost: 15.0,
        maxInputTokens: 200_000,
      },
      'anthropic.claude-3-7-sonnet-20250219-v1:0': {
        inputCost: 3.0,
        outputCost: 15.0,
        maxInputTokens: 200_000,
      },
    },
  },
};

const DEFAULT_AGENT_PROFILE_ID = 'default';

export const DEFAULT_AGENT_PROFILE: AgentProfile = {
  id: DEFAULT_AGENT_PROFILE_ID,
  name: 'Default',
  provider: 'anthropic',
  model: Object.keys(PROVIDER_MODELS.anthropic!.models)[0],
  maxIterations: 20,
  maxTokens: 2000,
  minTimeBetweenToolCalls: 0,
  toolApprovals: {
    // aider tools
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_GET_CONTEXT_FILES}`]: ToolApprovalState.Always,
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_ADD_CONTEXT_FILE}`]: ToolApprovalState.Always,
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_DROP_CONTEXT_FILE}`]: ToolApprovalState.Always,
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`]: ToolApprovalState.Ask,
    // power tools
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Ask,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_READ}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Ask,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GLOB}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GREP}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_SEMANTIC_SEARCH}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Ask,
  },
  includeContextFiles: true,
  includeRepoMap: true,
  usePowerTools: false,
  useAiderTools: true,
  customInstructions: '',
  enabledServers: [],
  autoApprove: false,
};

export const getLlmProviderConfig = (providerName: LlmProviderName, settings: SettingsData | null): LlmProvider => {
  let provider = settings?.llmProviders[providerName] || null;

  if (!provider) {
    const baseConfig: LlmProviderBase = {
      name: providerName,
    };

    switch (providerName) {
      case 'openai':
        provider = { ...baseConfig, apiKey: '' } as OpenAiProvider;
        break;
      case 'anthropic':
        provider = { ...baseConfig, apiKey: '' } as AnthropicProvider;
        break;
      case 'gemini':
        provider = { ...baseConfig, apiKey: '' } as GeminiProvider;
        break;
      case 'deepseek':
        provider = { ...baseConfig, apiKey: '' } as DeepseekProvider;
        break;
      case 'bedrock':
        provider = {
          ...baseConfig,
          accessKeyId: '',
          secretAccessKey: '',
          region: 'us-east-1', // Default region
        } as BedrockProvider;
        break;
      case 'openai-compatible':
        provider = {
          ...baseConfig,
          apiKey: '',
          baseUrl: '',
          models: [],
        } as OpenAiCompatibleProvider;
        break;
      case 'ollama':
        provider = {
          ...baseConfig,
          baseUrl: 'http://localhost:11434/api',
        } as OllamaProvider;
        break;
      case 'openrouter':
        provider = {
          ...baseConfig,
          apiKey: '',
          models: [],
        } as OpenRouterProvider;
        break;
      case 'requesty':
        provider = {
          ...baseConfig,
          apiKey: '',
          models: [],
          useAutoCache: true,
          reasoningEffort: ReasoningEffort.None,
        } as RequestyProvider;
        break;
      default:
        // For any other provider, create a base structure. This might need more specific handling if new providers are added.
        provider = {
          ...baseConfig,
        } as LlmProvider;
    }

    return provider;
  } else {
    return {
      ...provider,
    };
  }
};

export const getCacheControl = (profile: AgentProfile): Record<string, Record<string, JSONValue>> => {
  if (profile.provider === 'anthropic') {
    return {
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    };
  } else if (profile.provider === 'openrouter' || profile.provider === 'requesty') {
    if (profile.model.startsWith('anthropic/')) {
      return {
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      };
    }
  }

  return {};
};

type AnthropicMetadata = {
  anthropic: {
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
};

export const calculateCost = (profile: AgentProfile, sentTokens: number, receivedTokens: number, providerMetadata?: AnthropicMetadata | unknown) => {
  const providerModels = PROVIDER_MODELS[profile.provider];
  if (!providerModels) {
    return 0;
  }

  // Get the model name directly from the provider
  const model = profile.model;
  if (!model) {
    return 0;
  }

  // Find the model cost configuration
  const modelCost = providerModels.models[model];
  if (!modelCost) {
    return 0;
  }

  // Calculate cost in dollars (costs are per million tokens)
  const inputCost = (sentTokens * modelCost.inputCost) / 1_000_000;
  const outputCost = (receivedTokens * modelCost.outputCost) / 1_000_000;
  let cacheCost = 0;

  if (profile.provider === 'anthropic') {
    const anthropicMetadata = providerMetadata as AnthropicMetadata;
    const cacheCreationInputTokens = anthropicMetadata.anthropic?.cacheCreationInputTokens ?? 0;
    const cacheReadInputTokens = anthropicMetadata?.anthropic?.cacheReadInputTokens ?? 0;
    const cacheCreationCost = (cacheCreationInputTokens * (modelCost.cacheCreationInputCost ?? 0)) / 1_000_000;
    const cacheReadCost = (cacheReadInputTokens * (modelCost.cacheReadInputCost ?? 0)) / 1_000_000;

    cacheCost = cacheCreationCost + cacheReadCost;
  }

  return inputCost + outputCost + cacheCost;
};
