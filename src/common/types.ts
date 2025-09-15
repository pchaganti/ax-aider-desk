import {
  AnthropicProvider,
  BedrockProvider,
  DeepseekProvider,
  GeminiProvider,
  GroqProvider,
  LlmProviderName,
  LmStudioProvider,
  OllamaProvider,
  OpenAiCompatibleProvider,
  OpenAiProvider,
  OpenRouterProvider,
  RequestyProvider,
  VertexAiProvider,
} from '@common/agent';
import { z } from 'zod';

import type { AssistantContent, ToolContent, UserContent } from 'ai';
import type { JsonSchema } from '@n8n/json-schema-to-zod';

export type LocalizedString = {
  key: string;
  params?: Record<string, unknown>;
};

export type Mode = 'code' | 'ask' | 'architect' | 'context' | 'agent';

export type EditFormat = 'diff' | 'diff-fenced' | 'whole' | 'udiff' | 'udiff-simple' | 'patch';

export enum ReasoningEffort {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Minimal = 'minimal',
  None = 'none',
}

export enum ContextMemoryMode {
  Off = 'off',
  FullContext = 'full-context',
  LastMessage = 'last-message',
}

export interface ResponseChunkData {
  messageId: string;
  baseDir: string;
  chunk: string;
  reflectedMessage?: string;
  promptContext?: PromptContext;
}

export interface ResponseCompletedData {
  messageId: string;
  baseDir: string;
  content: string;
  reflectedMessage?: string;
  editedFiles?: string[];
  commitHash?: string;
  commitMessage?: string;
  diff?: string;
  usageReport?: UsageReportData;
  sequenceNumber?: number;
  promptContext?: PromptContext;
}

export interface CommandOutputData {
  baseDir: string;
  command: string;
  output: string;
}

export type LogLevel = 'info' | 'warning' | 'error' | 'loading';

export interface LogData {
  baseDir: string;
  level: LogLevel;
  message?: string;
  finished?: boolean;
  promptContext?: PromptContext;
}

export interface ToolData {
  baseDir: string;
  id: string;
  serverName: string;
  toolName: string;
  args?: Record<string, unknown>;
  response?: string;
  usageReport?: UsageReportData;
  promptContext?: PromptContext;
}

export interface ContextFilesUpdatedData {
  baseDir: string;
  files: ContextFile[];
}

export interface CustomCommandsUpdatedData {
  baseDir: string;
  commands: CustomCommand[];
}

export interface AutocompletionData {
  baseDir: string;
  words: string[];
  allFiles: string[];
  models: string[];
}

export interface SessionData {
  name: string;
  messages?: number;
  files?: number;
}

export interface Answer {
  text: string;
  shortkey: string;
}

export interface QuestionData {
  baseDir: string;
  text: string;
  subject?: string;
  isGroupQuestion?: boolean;
  answers?: Answer[];
  defaultAnswer: string;
  internal?: boolean;
  key?: string;
}

export type ContextFileSourceType = 'companion' | 'aider' | 'app' | string;

export enum OS {
  Windows = 'windows',
  Linux = 'linux',
  MacOS = 'macos',
}

export interface CloudflareTunnelStatus {
  isRunning: boolean;
  url?: string;
}

export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
}

// Base interface for all context messages with usage reporting
interface BaseContextMessage {
  id: string;
  usageReport?: UsageReportData;
  promptContext?: PromptContext;
}

// User message with usage report
export interface ContextUserMessage extends BaseContextMessage {
  role: 'user';
  content: UserContent;
}

// Assistant message with full response metadata
export interface ContextAssistantMessage extends BaseContextMessage {
  role: 'assistant';
  content: AssistantContent;
  reflectedMessage?: string;
  editedFiles?: string[];
  commitHash?: string;
  commitMessage?: string;
  diff?: string;
}

// Tool message with usage report
export interface ContextToolMessage extends BaseContextMessage {
  role: 'tool';
  content: ToolContent;
}

// Union type for enhanced context messages
export type ContextMessage = ContextUserMessage | ContextAssistantMessage | ContextToolMessage;

export interface ContextFile {
  path: string;
  readOnly?: boolean;
}

export interface WindowState {
  width: number;
  height: number;
  x: number | undefined;
  y: number | undefined;
  isMaximized: boolean;
}

export const ProjectSettingsSchema = z.object({
  mainModel: z.string(),
  weakModel: z.string().nullable().optional(),
  architectModel: z.string().nullable().optional(),
  agentProfileId: z.string(),
  modelEditFormats: z.record(z.string(), z.enum(['diff', 'diff-fenced', 'whole', 'udiff', 'udiff-simple', 'patch'])),
  reasoningEffort: z.string().optional(),
  thinkingTokens: z.string().optional(),
  currentMode: z.enum(['code', 'ask', 'architect', 'context', 'agent']),
  renderMarkdown: z.boolean(),
});

export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

export interface ProjectData {
  active: boolean;
  baseDir: string;
  settings: ProjectSettings;
}

export interface RawModelInfo {
  max_input_tokens: number;
  max_output_tokens: number;
  input_cost_per_token: number;
  output_cost_per_token: number;
  supports_function_calling: boolean;
  supports_tool_choice: boolean;
  litellm_provider: string;
}

export interface ModelsData {
  baseDir: string;
  mainModel: string;
  weakModel?: string | null;
  architectModel?: string | null;
  reasoningEffort?: string;
  thinkingTokens?: string;
  editFormat?: EditFormat;
  info?: RawModelInfo;
  error?: string;
}

export enum ToolApprovalState {
  Always = 'always',
  Never = 'never',
  Ask = 'ask',
}

export enum StartupMode {
  Empty = 'empty',
  Last = 'last',
}

export enum SuggestionMode {
  Automatically = 'automatically',
  OnTab = 'onTab',
  MentionAtSign = 'mentionAtSign',
}

export interface PromptBehavior {
  suggestionMode: SuggestionMode;
  suggestionDelay: number;
  requireCommandConfirmation: {
    add: boolean;
    readOnly: boolean;
    model: boolean;
    modeSwitching: boolean;
  };
  useVimBindings: boolean;
}

export enum InvocationMode {
  OnDemand = 'on-demand',
  Automatic = 'automatic',
}

export interface SubagentConfig {
  enabled: boolean;
  contextMemory: ContextMemoryMode;
  systemPrompt: string;
  invocationMode: InvocationMode;
  color: string;
  description: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  provider: LlmProviderName;
  model: string;
  maxIterations: number;
  maxTokens: number;
  minTimeBetweenToolCalls: number; // in milliseconds
  temperature: number; // 0-1 for controlling randomness/creativity
  enabledServers: string[];
  toolApprovals: Record<string, ToolApprovalState>;
  includeContextFiles: boolean;
  includeRepoMap: boolean;
  usePowerTools: boolean;
  useAiderTools: boolean;
  useTodoTools: boolean;
  useSubagents: boolean;
  customInstructions: string;
  autoApprove: boolean;
  subagent: SubagentConfig;
  isSubagent?: boolean; // flag to indicate if this profile is being used as a subagent
}

export interface EnvironmentVariable {
  value: string;
  source: string;
}

export const THEMES = [
  'dark',
  'light',
  'charcoal',
  'neon',
  'neopunk',
  'aurora',
  'ocean',
  'forest',
  'lavender',
  'bw',
  'midnight',
  'serenity',
  'cappuccino',
] as const;
export type Theme = (typeof THEMES)[number];

export const FONTS = [
  'Sono',
  'Poppins',
  'Nunito',
  'Quicksand',
  'PlayfairDisplay',
  'Lora',
  'SpaceGrotesk',
  'Orbitron',
  'Enriqueta',
  'FunnelDisplay',
  'GoogleSansCode',
  'Inter',
  'JetBrainsMono',
  'RobotoMono',
  'Sansation',
  'Silkscreen',
  'SourceCodePro',
  'SpaceMono',
  'UbuntuMono',
] as const;
export type Font = (typeof FONTS)[number];

export interface SettingsData {
  onboardingFinished?: boolean;
  language: string;
  startupMode?: StartupMode;
  zoomLevel?: number;
  notificationsEnabled?: boolean;
  theme?: Theme;
  font?: Font;
  fontSize?: number;
  aiderDeskAutoUpdate: boolean;
  aider: {
    options: string;
    environmentVariables: string;
    addRuleFiles: boolean;
    autoCommits: boolean;
    cachingEnabled: boolean;
    watchFiles: boolean;
    confirmBeforeEdit: boolean;
  };
  models: {
    aiderPreferred: string[];
    agentPreferred: string[];
  };
  agentProfiles: AgentProfile[];
  mcpServers: Record<string, McpServerConfig>;
  llmProviders: {
    openai?: OpenAiProvider;
    anthropic?: AnthropicProvider;
    gemini?: GeminiProvider;
    groq?: GroqProvider;
    bedrock?: BedrockProvider;
    deepseek?: DeepseekProvider;
    ollama?: OllamaProvider;
    lmstudio?: LmStudioProvider;
    'openai-compatible'?: OpenAiCompatibleProvider;
    openrouter?: OpenRouterProvider;
    requesty?: RequestyProvider;
    'vertex-ai'?: VertexAiProvider;
  };
  telemetryEnabled: boolean;
  telemetryInformed?: boolean;
  promptBehavior: PromptBehavior;
  server: {
    enabled: boolean;
    basicAuth: {
      enabled: boolean;
      username: string;
      password: string;
    };
  };
}

export interface Group {
  id: string;
  name?: string | LocalizedString;
  color?: string;
  finished?: boolean;
}

export interface PromptContext {
  id: string;
  group?: Group;
}

export interface ProjectStartedData {
  baseDir: string;
}

export interface ClearProjectData {
  baseDir: string;
  clearMessages: boolean;
  clearSession: boolean;
}

export interface UsageReportData {
  model: string;
  sentTokens: number;
  receivedTokens: number;
  messageCost: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  aiderTotalCost?: number;
  agentTotalCost?: number;
}

export interface TokensCost {
  tokens: number;
  tokensEstimated?: boolean;
  cost: number;
}

export interface TokensInfoData {
  baseDir: string;
  chatHistory: TokensCost;
  files: Record<string, TokensCost>;
  repoMap: TokensCost;
  systemMessages: TokensCost;
  agent?: TokensCost;
}

export interface InputHistoryData {
  baseDir: string;
  messages: string[];
}

export interface UserMessageData {
  baseDir: string;
  content: string;
  mode?: Mode;
  promptContext?: PromptContext;
}

export interface FileEdit {
  path: string;
  original: string;
  updated: string;
}

export interface GenericTool {
  groupName: string;
  name: string;
  description: string;
}

export interface McpTool {
  serverName: string;
  name: string;
  description?: string;
  inputSchema: JsonSchema;
}

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Readonly<Record<string, string>>;
  url?: string;
  headers?: Readonly<Record<string, string>>;
}

export interface VersionsInfo {
  aiderDeskCurrentVersion?: string | null;
  aiderCurrentVersion?: string | null;
  aiderDeskAvailableVersion?: string | null;
  aiderAvailableVersion?: string | null;
  aiderDeskDownloadProgress?: number;
  aiderDeskNewVersionReady?: boolean;
  releaseNotes?: string | null;
}

export enum FileWriteMode {
  Overwrite = 'overwrite',
  Append = 'append',
  CreateOnly = 'create_only',
}

export interface ModelInfo {
  maxInputTokens: number;
  maxOutputTokens: number;
  inputCostPerToken: number;
  outputCostPerToken: number;
  cacheWriteInputTokenCost?: number;
  cacheReadInputTokenCost?: number;
  supportsTools: boolean;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

export interface TodoItem {
  name: string;
  completed: boolean;
}

export interface UsageDataRow {
  timestamp: string;
  project: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost: number;
}

export interface Model {
  id: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  inputCostPerToken?: number;
  outputCostPerToken?: number;
  supportsTools?: boolean;
  cacheReadInputTokenCost?: number;
}

export type ProviderModels = Partial<Record<LlmProviderName, Model[]>>;

export interface CustomCommandArgument {
  description: string;
  required?: boolean;
}

export interface CustomCommand {
  name: string;
  description: string;
  arguments: CustomCommandArgument[];
  template: string;
  includeContext?: boolean;
  autoApprove?: boolean;
}

export interface TerminalData {
  terminalId: string;
  baseDir: string;
  data: string;
}

export interface TerminalExitData {
  terminalId: string;
  baseDir: string;
  exitCode: number;
  signal?: number;
}
