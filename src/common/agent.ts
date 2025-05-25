import { AgentProfile, SettingsData, ToolApprovalState } from '@common/types';
import {
  TOOL_GROUP_NAME_SEPARATOR,
  AIDER_TOOL_ADD_CONTEXT_FILE,
  AIDER_TOOL_DROP_CONTEXT_FILE,
  AIDER_TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_SEMANTIC_SEARCH,
  POWER_TOOL_BASH,
} from '@common/tools';

export type LlmProviderName = 'openai' | 'anthropic' | 'gemini' | 'bedrock' | 'deepseek' | 'openai-compatible' | 'ollama' | 'openrouter';

export interface LlmProviderBase {
  name: LlmProviderName;
  model: string;
}

export interface OllamaProvider extends LlmProviderBase {
  name: 'ollama';
  baseUrl: string;
}

export const AVAILABLE_PROVIDERS: LlmProviderName[] = ['anthropic', 'bedrock', 'deepseek', 'gemini', 'ollama', 'openai', 'openai-compatible', 'openrouter'];

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
}
export const isOpenAiCompatibleProvider = (provider: LlmProviderBase): provider is OpenAiCompatibleProvider => provider.name === 'openai-compatible';

export const isOllamaProvider = (provider: LlmProviderBase): provider is OllamaProvider => provider.name === 'ollama';

export interface OpenRouterProvider extends LlmProviderBase {
  name: 'openrouter';
  apiKey: string;
}
export const isOpenRouterProvider = (provider: LlmProviderBase): provider is OpenRouterProvider => provider.name === 'openrouter';

export type LlmProvider =
  | OpenAiProvider
  | AnthropicProvider
  | GeminiProvider
  | BedrockProvider
  | DeepseekProvider
  | OpenAiCompatibleProvider
  | OllamaProvider
  | OpenRouterProvider;

// prices in dollars per million tokens
export const PROVIDER_MODELS: Partial<Record<LlmProviderName, { models: Record<string, { inputCost: number; outputCost: number; maxInputTokens?: number }> }>> =
  {
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
          maxInputTokens: 200_000,
        },
        'claude-3-7-sonnet-20250219': {
          inputCost: 3.0,
          outputCost: 15.0,
          maxInputTokens: 200_000,
        },
        'claude-3-5-haiku-20241022': {
          inputCost: 0.8,
          outputCost: 4.0,
          maxInputTokens: 200_000,
        },
      },
    },
    gemini: {
      models: {
        'gemini-2.5-pro-preview-05-06': {
          inputCost: 1.25,
          outputCost: 10,
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
};

export const getLlmProviderConfig = (providerName: LlmProviderName, settings: SettingsData | null): LlmProvider => {
  let provider = settings?.llmProviders[providerName] || null;

  if (!provider) {
    const baseConfig: LlmProviderBase = {
      name: providerName,
      model: Object.keys(PROVIDER_MODELS[providerName]?.models || {})[0] || '',
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
        provider = { ...baseConfig, apiKey: '', baseUrl: '' } as OpenAiCompatibleProvider;
        break;
      case 'ollama':
        provider = { ...baseConfig, baseUrl: 'http://localhost:11434/api' } as OllamaProvider;
        break;
      case 'openrouter':
        provider = { ...baseConfig, apiKey: '' } as OpenRouterProvider;
        break;
      default:
        // For any other provider, create a base structure. This might need more specific handling if new providers are added.
        provider = {
          ...baseConfig,
        } as LlmProvider;
    }
  }

  return provider;
};
