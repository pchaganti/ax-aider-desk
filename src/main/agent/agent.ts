import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentProfile,
  ContextFile,
  ContextMessage,
  ContextUserMessage,
  McpTool,
  PromptContext,
  SettingsData,
  ToolApprovalState,
  UsageReportData,
} from '@common/types';
import {
  APICallError,
  type CoreMessage,
  type FinishReason,
  generateText,
  type ImagePart,
  InvalidToolArgumentsError,
  NoSuchToolError,
  type StepResult,
  streamText,
  type Tool,
  type ToolExecutionOptions,
  type ToolSet,
  wrapLanguageModel,
} from 'ai';
import { delay, extractServerNameToolName } from '@common/utils';
import { getLlmProviderConfig, LlmProviderName } from '@common/agent';
// @ts-expect-error gpt-tokenizer is not typed
import { countTokens } from 'gpt-tokenizer/model/gpt-4o';
import { jsonSchemaToZod } from '@n8n/json-schema-to-zod';
import { Client as McpSdkClient } from '@modelcontextprotocol/sdk/client/index.js';
import { ZodSchema } from 'zod';
import { isBinary } from 'istextorbinary';
import { fileTypeFromBuffer } from 'file-type';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { createPowerToolset } from './tools/power';
import { createTodoToolset } from './tools/todo';
import { getSystemPrompt } from './prompts';
import { createAiderToolset } from './tools/aider';
import { createHelpersToolset } from './tools/helpers';
import { calculateCost, createLlm, getCacheControl, getProviderOptions, getUsageReport } from './llm-providers';
import { MCP_CLIENT_TIMEOUT, McpManager } from './mcp-manager';
import { ApprovalManager } from './tools/approval-manager';
import { extractPromptContextFromToolResult, THINKING_RESPONSE_STAR_TAG, ANSWER_RESPONSE_START_TAG } from './utils';
import { extractReasoningMiddleware } from './middlewares/extract-reasoning-middleware';

import type { JsonSchema } from '@n8n/json-schema-to-zod';

import { AIDER_DESK_PROJECT_RULES_DIR } from '@/constants';
import { Project } from '@/project';
import { Store } from '@/store';
import logger from '@/logger';
import { parseAiderEnv } from '@/utils';
import { optimizeMessages } from '@/agent/optimizer';
import { ModelManager } from '@/models/model-manager';
import { TelemetryManager } from '@/telemetry/telemetry-manager';
import { ResponseMessage } from '@/messages';
import { createSubagentsToolset } from '@/agent/tools/subagents';

export class Agent {
  private abortController: AbortController | null = null;
  private aiderEnv: Record<string, string> | null = null;
  private lastToolCallTime: number = 0;

  constructor(
    private readonly store: Store,
    private readonly mcpManager: McpManager,
    private readonly modelInfoManager: ModelManager,
    private readonly telemetryManager: TelemetryManager,
  ) {}

  private invalidateAiderEnv() {
    this.aiderEnv = null;
  }

  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    const aiderEnvChanged = oldSettings.aider?.environmentVariables !== newSettings.aider?.environmentVariables;
    const aiderOptionsChanged = oldSettings.aider?.options !== newSettings.aider?.options;
    if (aiderEnvChanged || aiderOptionsChanged) {
      logger.info('Aider environment or options changed, invalidating cached environment.');
      this.invalidateAiderEnv();
    }
  }

  private async getFilesContentForPrompt(files: ContextFile[], project: Project): Promise<{ textFileContents: string[]; imageParts: ImagePart[] }> {
    const textFileContents: string[] = [];
    const imageParts: ImagePart[] = [];

    const fileInfos = await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.resolve(project.baseDir, file.path);
          const fileContentBuffer = await fs.readFile(filePath);

          // If binary, try to detect if it's an image using image-type and return base64
          if (isBinary(filePath, fileContentBuffer)) {
            try {
              const detected = await fileTypeFromBuffer(fileContentBuffer);
              if (detected?.mime.startsWith('image/')) {
                const imageBase64 = fileContentBuffer.toString('base64');
                logger.debug(`Detected image file: ${file.path}`);

                return {
                  path: file.path,
                  content: null,
                  readOnly: file.readOnly,
                  imageBase64,
                  mimeType: detected.mime,
                  isImage: true,
                };
              }
            } catch (e) {
              logger.warn(`image-type failed to detect image for ${file.path}`, { error: e instanceof Error ? e.message : String(e) });
            }

            logger.debug(`Skipping non-image binary file: ${file.path}`);
            return null;
          }

          // Read file as text
          const fileContent = fileContentBuffer.toString('utf8');

          // Add line numbers to content
          const lines = fileContent.split('\n');
          const numberedLines = lines.map((line, index) => `${index + 1} | ${line}`);
          const content = numberedLines.join('\n');

          return {
            path: file.path,
            content,
            readOnly: file.readOnly,
            isImage: false,
          };
        } catch (error) {
          logger.error('Error reading context file:', {
            path: file.path,
            error,
          });
          return null;
        }
      }),
    );

    // Process the results and separate text files from images
    fileInfos.filter(Boolean).forEach((file) => {
      if (file!.isImage && file!.imageBase64) {
        // Add to imageParts array
        imageParts.push({
          type: 'image',
          image: `data:${file!.mimeType};base64,${file!.imageBase64}`,
          mimeType: file!.mimeType,
        });
      } else if (!file!.isImage && file!.content) {
        // Add to textFileContents array
        const filePath = path.isAbsolute(file!.path) ? path.relative(project.baseDir, file!.path) : file!.path;
        const textContent = `<file>\n  <path>${filePath}</path>\n  <content-with-line-numbers>\n${file!.content}</content-with-line-numbers>\n</file>`;
        textFileContents.push(textContent);
      }
    });

    return { textFileContents, imageParts };
  }

  private async getContextFilesMessages(project: Project, profile: AgentProfile, contextFiles: ContextFile[]): Promise<CoreMessage[]> {
    const messages: CoreMessage[] = [];

    // Filter out rule files as they are already included in the system prompt
    const filteredContextFiles = contextFiles.filter((file) => {
      const normalizedPath = path.normalize(file.path);
      const normalizedRulesDir = path.normalize(AIDER_DESK_PROJECT_RULES_DIR);

      // Check if the file is within the rules directory
      return (
        !normalizedPath.startsWith(normalizedRulesDir + path.sep) &&
        !normalizedPath.startsWith(normalizedRulesDir + '/') &&
        normalizedPath !== normalizedRulesDir
      );
    });

    if (filteredContextFiles.length > 0) {
      // Separate readonly and editable files
      const [readOnlyFiles, editableFiles] = filteredContextFiles.reduce(
        ([readOnly, editable], file) => (file.readOnly ? [[...readOnly, file], editable] : [readOnly, [...editable, file]]),
        [[], []] as [ContextFile[], ContextFile[]],
      );
      const allImageParts: ImagePart[] = [];

      // Process readonly files first
      if (readOnlyFiles.length > 0) {
        const { textFileContents, imageParts } = await this.getFilesContentForPrompt(readOnlyFiles, project);

        if (textFileContents.length > 0) {
          messages.push({
            role: 'user',
            content:
              (profile.useAiderTools
                ? 'The following files are already part of the Aider context as READ-ONLY reference material. You can analyze and reference their content, but you must NOT modify, edit, or suggest changes to these files. Use them only for understanding context and making informed decisions about other files:\n\n'
                : 'The following files are provided as READ-ONLY reference material. You can analyze and reference their content, but you must NOT modify, edit, or suggest changes to these files. Use them only for understanding context and making informed decisions:\n\n') +
              textFileContents.join('\n\n'),
          });
          messages.push({
            role: 'assistant',
            content: 'Understood. I will use the provided files as read-only references and will not attempt to modify their content.',
          });
        }

        allImageParts.push(...imageParts);
      }

      // Process editable files
      if (editableFiles.length > 0) {
        const { textFileContents, imageParts } = await this.getFilesContentForPrompt(editableFiles, project);

        if (textFileContents.length > 0) {
          messages.push({
            role: 'user',
            content:
              (profile.useAiderTools
                ? 'The following files are available for editing and modification. These files are already loaded in the Aider context, so you can directly use Aider tools to modify them without needing to add them to the context first. The content shown below is current and up-to-date:\n\n'
                : 'The following files are available for editing and modification. The content shown below is current and up-to-date, so you can reference it directly without needing to read the files again. You may suggest changes or modifications to these files:\n\n') +
              textFileContents.join('\n\n'),
          });
          messages.push({
            role: 'assistant',
            content: profile.useAiderTools
              ? 'Acknowledged. These files are already part of the Aider context and are available for direct editing using Aider tools. I do not need to re-add them.'
              : 'Understood. The content of these files is current, and I will refer to them as editable files without needing to read them again.',
          });
        }

        allImageParts.push(...imageParts);
      }

      if (allImageParts.length > 0) {
        messages.push({
          role: 'user',
          content: allImageParts,
        });
        messages.push({
          role: 'assistant',
          content: 'I can see the provided images and will use them for reference.',
        });
      }
    }

    return messages;
  }

  private async getWorkingFilesMessages(contextFiles: ContextFile[]): Promise<CoreMessage[]> {
    const messages: CoreMessage[] = [];

    if (contextFiles.length > 0) {
      const fileList = contextFiles
        .map((file) => {
          return `- ${file.path}`;
        })
        .join('\n');

      messages.push({
        role: 'user',
        content: `The following files are currently in the working context:\n\n${fileList}`,
      });
      messages.push({
        role: 'assistant',
        content: 'OK, I have noted the files in the context.',
      });
    }

    return messages;
  }

  private async getAvailableTools(
    project: Project,
    profile: AgentProfile,
    messages?: ContextMessage[],
    resultMessages?: ContextMessage[],
    abortSignal?: AbortSignal,
    promptContext?: PromptContext,
  ): Promise<ToolSet> {
    logger.debug('getAvailableTools', {
      enabledServers: profile.enabledServers,
      promptContext,
    });

    const mcpConnectors = await this.mcpManager.getConnectors();
    const approvalManager = new ApprovalManager(project, profile);

    // Build the toolSet directly from enabled clients and tools
    const toolSet: ToolSet = mcpConnectors.reduce((acc, mcpConnector) => {
      // Skip if serverName is not in the profile's enabledServers
      if (!profile.enabledServers.includes(mcpConnector.serverName)) {
        return acc;
      }

      // Process tools for this enabled server
      mcpConnector.tools.forEach((tool) => {
        const toolId = `${mcpConnector.serverName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`;
        const normalizedToolId = toolId.toLowerCase().replaceAll(/\s+/g, '_');

        // Check approval state first from the profile
        const approvalState = profile.toolApprovals[toolId];

        // Skip tools marked as 'Never' approved
        if (approvalState === ToolApprovalState.Never) {
          logger.debug(`Skipping tool due to 'Never' approval state: ${toolId}`);
          return; // Do not add the tool if it's never approved
        }

        acc[normalizedToolId] = this.convertMpcToolToAiSdkTool(
          profile.provider,
          mcpConnector.serverName,
          project,
          profile,
          mcpConnector.client,
          tool,
          approvalManager,
          promptContext,
        );
      });

      return acc;
    }, {} as ToolSet);

    if (profile.useAiderTools) {
      const aiderTools = createAiderToolset(project, profile, promptContext);
      Object.assign(toolSet, aiderTools);
    }

    if (profile.usePowerTools) {
      const powerTools = createPowerToolset(project, profile, promptContext);
      Object.assign(toolSet, powerTools);
    }

    if (profile.useSubagents) {
      const subagentsToolset = createSubagentsToolset(this.store.getSettings(), project, profile, abortSignal, messages, resultMessages);
      Object.assign(toolSet, subagentsToolset);
    }

    if (profile.useTodoTools) {
      const todoTools = createTodoToolset(project, profile, promptContext);
      Object.assign(toolSet, todoTools);
    }

    // Add helper tools
    const helperTools = createHelpersToolset();
    Object.assign(toolSet, helperTools);

    return toolSet;
  }

  private convertMpcToolToAiSdkTool(
    providerName: LlmProviderName,
    serverName: string,
    project: Project,
    profile: AgentProfile,
    mcpClient: McpSdkClient,
    toolDef: McpTool,
    approvalManager: ApprovalManager,
    promptContext?: PromptContext,
  ): Tool {
    const toolId = `${serverName}${TOOL_GROUP_NAME_SEPARATOR}${toolDef.name}`;
    let zodSchema: ZodSchema;
    try {
      zodSchema = jsonSchemaToZod(this.fixInputSchema(providerName, toolDef.inputSchema));
    } catch (e) {
      logger.error(`Failed to convert JSON schema to Zod for tool ${toolDef.name}:`, e);
      // Fallback to a generic object schema if conversion fails
      zodSchema = jsonSchemaToZod({ type: 'object', properties: {} });
    }

    const execute = async (args: { [x: string]: unknown } | undefined, { toolCallId }: ToolExecutionOptions) => {
      project.addToolMessage(toolCallId, serverName, toolDef.name, args, undefined, undefined, promptContext);

      // --- Tool Approval Logic ---
      const questionKey = toolId;
      const questionText = `Approve tool ${toolDef.name} from ${serverName} MCP server?`;
      const questionSubject = args ? JSON.stringify(args) : undefined;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText, questionSubject);

      if (!isApproved) {
        logger.warn(`Tool execution denied by user: ${toolId}`);
        return `Tool execution denied by user.${userInput ? ` User input: ${userInput}` : ''}`;
      }
      logger.debug(`Tool execution approved: ${toolId}`);
      // --- End Tool Approval Logic ---

      // Enforce minimum time between tool calls
      const timeSinceLastCall = Date.now() - this.lastToolCallTime;
      const currentMinTime = profile.minTimeBetweenToolCalls;
      const remainingDelay = currentMinTime - timeSinceLastCall;

      if (remainingDelay > 0) {
        logger.debug(`Delaying tool call by ${remainingDelay}ms to respect minTimeBetweenToolCalls (${currentMinTime}ms)`);
        await delay(remainingDelay);
      }

      try {
        const response = await mcpClient.callTool(
          {
            name: toolDef.name,
            arguments: args,
          },
          undefined,
          {
            timeout: MCP_CLIENT_TIMEOUT,
          },
        );

        logger.debug(`Tool ${toolDef.name} returned response`, { response });

        // Update last tool call time
        this.lastToolCallTime = Date.now();
        return response;
      } catch (error) {
        logger.error(`Error calling tool ${serverName}${TOOL_GROUP_NAME_SEPARATOR}${toolDef.name}:`, error);
        // Update last tool call time even if there's an error
        this.lastToolCallTime = Date.now();
        // Return an error message string to the agent
        return `Error executing tool ${toolDef.name}: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

    logger.debug(`Converting MCP tool to AI SDK tool: ${toolDef.name}`, toolDef);

    return {
      description: toolDef.description ?? '',
      parameters: zodSchema,
      execute,
    };
  }

  /**
   * Fixes the input schema for various providers.
   */
  private fixInputSchema(provider: LlmProviderName, inputSchema: JsonSchema): JsonSchema {
    if (provider === 'gemini') {
      // Deep clone to avoid modifying the original schema
      const fixedSchema = JSON.parse(JSON.stringify(inputSchema));

      if (fixedSchema.properties) {
        for (const key of Object.keys(fixedSchema.properties)) {
          const property = fixedSchema.properties[key];

          if (property.anyOf) {
            property.any_of = property.anyOf;
            delete property.anyOf;
          }
          if (property.oneOf) {
            property.one_of = property.oneOf;
            delete property.oneOf;
          }
          if (property.allOf) {
            property.all_of = property.allOf;
            delete property.allOf;
          }

          // gemini does not like "default" in the schema
          if (property.default !== undefined) {
            delete property.default;
          }

          if (property.type === 'string' && property.format && !['enum', 'date-time'].includes(property.format)) {
            logger.debug(`Removing unsupported format '${property.format}' for property '${key}' in Gemini schema`);
            delete property.format;
          }

          if (!property.type || property.type === 'null') {
            property.type = 'string';
          }
        }
        if (Object.keys(fixedSchema.properties).length === 0) {
          // gemini requires at least one property in the schema
          fixedSchema.properties = {
            placeholder: {
              type: 'string',
              description: 'Placeholder property to satisfy Gemini schema requirements',
            },
          };
        }
      }

      return fixedSchema;
    }

    return inputSchema;
  }

  async runAgent(
    project: Project,
    profile: AgentProfile,
    prompt: string,
    promptContext?: PromptContext,
    contextMessages: ContextMessage[] = project.getContextMessages(),
    contextFiles: ContextFile[] = project.getContextFiles(),
    systemPrompt?: string,
    abortSignal?: AbortSignal,
  ): Promise<ContextMessage[]> {
    const settings = this.store.getSettings();

    this.telemetryManager.captureAgentRun(profile);

    logger.debug('runAgent', {
      profile,
      prompt,
      promptContext,
      contextMessages,
      contextFiles,
      systemPrompt,
    });

    // Create new abort controller for this run only if abortSignal is not provided
    const shouldCreateAbortController = !abortSignal;
    if (shouldCreateAbortController) {
      this.abortController = new AbortController();
    }
    const effectiveAbortSignal = abortSignal || this.abortController?.signal;

    const llmProvider = getLlmProviderConfig(profile.provider, settings);
    const cacheControl = getCacheControl(profile, llmProvider);
    const providerOptions = getProviderOptions(llmProvider);

    const userRequestMessage: ContextUserMessage = {
      id: promptContext?.id || uuidv4(),
      role: 'user',
      content: prompt,
      promptContext,
    };
    const messages = await this.prepareMessages(project, profile, contextMessages, contextFiles);
    const resultMessages: ContextMessage[] = [userRequestMessage];
    const initialUserRequestMessageIndex = messages.length - contextMessages.length;

    // add user message
    messages.push(...resultMessages);

    try {
      // reinitialize MCP clients for the current project and wait for them to be ready
      await this.mcpManager.initMcpConnectors(settings.mcpServers, project.baseDir, false, profile.enabledServers);
    } catch (error) {
      logger.error('Error reinitializing MCP clients:', error);
      project.addLogMessage('error', `Error reinitializing MCP clients: ${error}`, false, promptContext);
    }

    const toolSet = await this.getAvailableTools(project, profile, contextMessages, resultMessages, effectiveAbortSignal, promptContext);

    logger.info(`Running prompt with ${Object.keys(toolSet).length} tools.`);
    logger.debug('Tools:', {
      tools: Object.keys(toolSet),
    });

    let currentResponseId: string = uuidv4();

    try {
      const model = createLlm(llmProvider, profile.model, await this.getLlmEnv(project));

      if (!systemPrompt) {
        systemPrompt = await getSystemPrompt(project.baseDir, profile);
      }

      // repairToolCall function that attempts to repair tool calls
      const repairToolCall = async ({ toolCall, tools, error, messages, system }) => {
        logger.warn('Error during tool call:', { error, toolCall });

        if (NoSuchToolError.isInstance(error)) {
          // If the tool doesn't exist, return a call to the helper tool
          // to inform the LLM about the missing tool.
          logger.warn(`Attempted to call non-existent tool: ${error.toolName}`);

          const matchingTool = error.availableTools?.find((availableTool) => availableTool.endsWith(`${TOOL_GROUP_NAME_SEPARATOR}${error.toolName}`));
          if (matchingTool) {
            logger.info(`Found matching tool for ${error.toolName}: ${matchingTool}. Retrying with full name.`);
            return {
              toolCallType: 'function' as const,
              toolCallId: toolCall.toolCallId,
              toolName: matchingTool,
              args: toolCall.args,
            };
          } else {
            return {
              toolCallType: 'function' as const,
              toolCallId: toolCall.toolCallId,
              toolName: `helpers${TOOL_GROUP_NAME_SEPARATOR}no_such_tool`,
              args: JSON.stringify({
                toolName: error.toolName,
                availableTools: error.availableTools,
              }),
            };
          }
        } else if (InvalidToolArgumentsError.isInstance(error)) {
          // If the arguments are invalid, return a call to the helper tool
          // to inform the LLM about the argument error.
          logger.warn(`Invalid arguments for tool: ${error.toolName}`, {
            args: error.toolArgs,
            error: error.message,
          });
          return {
            toolCallType: 'function' as const,
            toolCallId: toolCall.toolCallId,
            toolName: `helpers${TOOL_GROUP_NAME_SEPARATOR}invalid_tool_arguments`,
            args: JSON.stringify({
              toolName: error.toolName,
              toolArgs: JSON.stringify(error.toolArgs), // Pass the problematic args
              error: error.message, // Pass the validation error message
            }),
          };
        }

        // Attempt generic repair for other types of errors
        try {
          logger.info(`Attempting generic repair for tool call error: ${toolCall.toolName}`);
          const result = await generateText({
            model,
            system,
            messages: [
              ...messages,
              {
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    args: JSON.stringify(toolCall.args),
                  },
                ],
              },
              {
                role: 'tool' as const,
                content: [
                  {
                    type: 'tool-result',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    result: error.message,
                  },
                ],
              },
            ],
            tools,
          });

          logger.info('Repair tool call result:', result);
          const newToolCall = result.toolCalls.find((newToolCall) => newToolCall.toolName === toolCall.toolName);
          return newToolCall != null
            ? {
                toolCallType: 'function' as const,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                // Ensure args are stringified for the AI SDK tool call format
                args: typeof newToolCall.args === 'string' ? newToolCall.args : JSON.stringify(newToolCall.args),
              }
            : null; // Return null if the LLM couldn't repair the call
        } catch (repairError) {
          logger.error('Error during tool call repair:', repairError);
          return null;
        }
      };

      let iterationCount = 0;
      let retryCount = 0;

      while (true) {
        logger.info(`Starting iteration ${iterationCount}`);
        iterationCount++;
        if (iterationCount > profile.maxIterations) {
          logger.warn(`Max iterations (${profile.maxIterations}) reached. Stopping agent.`);
          project.addLogMessage(
            'warning',
            `The Agent has reached the maximum number of allowed iterations (${profile.maxIterations}). To allow more iterations, go to Settings -> Agent -> Parameters and increase Max Iterations.`,
            false,
            promptContext,
          );
          break;
        }

        let iterationError: unknown | null = null;
        let hasReasoning: boolean = false;
        let finishReason: null | FinishReason = null;
        let responseMessages: ContextMessage[] = [];
        let currentTextResponse = '';

        const result = streamText({
          providerOptions,
          model: wrapLanguageModel({
            model,
            middleware: extractReasoningMiddleware({
              tagName: 'think',
            }),
          }),
          system: systemPrompt,
          messages: optimizeMessages(profile, initialUserRequestMessageIndex, messages, cacheControl, settings),
          toolCallStreaming: true,
          tools: toolSet,
          abortSignal: effectiveAbortSignal,
          maxTokens: profile.maxTokens,
          maxRetries: 5,
          temperature: profile.temperature,
          experimental_telemetry: {
            isEnabled: true,
          },
          onError: ({ error }) => {
            if (effectiveAbortSignal?.aborted) {
              return;
            }

            logger.error('Error during prompt:', { error });
            iterationError = error;
            if (typeof error === 'string') {
              project.addLogMessage('error', error, false, promptContext);
              // @ts-expect-error checking keys in error
            } else if (APICallError.isInstance(error) || ('message' in error && 'responseBody' in error)) {
              project.addLogMessage('error', `${error.message}: ${error.responseBody}`, false, promptContext);
            } else if (error instanceof Error) {
              project.addLogMessage('error', error.message, false, promptContext);
            } else {
              project.addLogMessage('error', JSON.stringify(error), false, promptContext);
            }
          },
          onChunk: ({ chunk }) => {
            if (chunk.type === 'text-delta') {
              if (hasReasoning) {
                project.processResponseMessage({
                  id: currentResponseId,
                  action: 'response',
                  content: ANSWER_RESPONSE_START_TAG,
                  finished: false,
                  promptContext,
                });
                hasReasoning = false;
              }

              if (chunk.textDelta?.trim() || currentTextResponse.trim()) {
                project.processResponseMessage({
                  id: currentResponseId,
                  action: 'response',
                  content: chunk.textDelta,
                  finished: false,
                  promptContext,
                });
                currentTextResponse += chunk.textDelta;
              }
            } else if (chunk.type === 'reasoning') {
              if (!hasReasoning) {
                project.processResponseMessage({
                  id: currentResponseId,
                  action: 'response',
                  content: THINKING_RESPONSE_STAR_TAG,
                  finished: false,
                  promptContext,
                });
                hasReasoning = true;
              }

              project.processResponseMessage({
                id: currentResponseId,
                action: 'response',
                content: chunk.textDelta,
                finished: false,
                promptContext,
              });
            } else if (chunk.type === 'tool-call-streaming-start') {
              project.addLogMessage('loading', 'Preparing tool...', false, promptContext);
            } else if (chunk.type === 'tool-call') {
              project.addLogMessage('loading', 'Executing tool...', false, promptContext);
            } else {
              // @ts-expect-error key exists
              if (chunk.type === 'tool-result') {
                project.addLogMessage('loading', undefined, false, promptContext);
              }
            }
          },
          onStepFinish: (stepResult) => {
            finishReason = stepResult.finishReason;

            if (finishReason === 'error') {
              logger.error('Error during prompt:', { stepResult });
              return;
            }

            if (effectiveAbortSignal?.aborted) {
              logger.info('Prompt aborted by user');
              return;
            }

            responseMessages = this.processStep<typeof toolSet>(currentResponseId, stepResult, project, profile, promptContext);
            currentResponseId = uuidv4();
            hasReasoning = false;
          },
          onFinish: ({ finishReason }) => {
            logger.info(`onFinish prompt finished. Reason: ${finishReason}`);
          },
          experimental_repairToolCall: repairToolCall,
        });

        await result.consumeStream();

        if (effectiveAbortSignal?.aborted) {
          logger.info('Prompt aborted by user');
          break;
        }

        if (iterationError) {
          logger.error('Error during prompt:', iterationError);
          if (iterationError instanceof APICallError && iterationError.isRetryable) {
            // try again
            continue;
          } else {
            // stop
            break;
          }
        }

        messages.push(...responseMessages);
        resultMessages.push(...responseMessages);

        if ((finishReason === 'unknown' || finishReason === 'other') && retryCount < 3) {
          logger.warn(`Finish reason: ${finishReason}. Retrying...`);
          retryCount++;
          continue;
        }
        retryCount = 0;

        if (finishReason === 'length') {
          project.addLogMessage(
            'warning',
            'The Agent has reached the maximum number of allowed tokens. To allow more tokens, go to Settings -> Agent -> Parameters and increase Max Tokens.',
            false,
            promptContext,
          );
        }

        if (finishReason !== 'tool-calls') {
          logger.info(`Prompt finished. Reason: ${finishReason}`);
          break;
        }
      }
    } catch (error) {
      if (effectiveAbortSignal?.aborted) {
        logger.info('Prompt aborted by user');
        return resultMessages;
      }

      logger.error('Error running prompt:', error);
      if (error instanceof Error && (error.message.includes('API key') || error.message.includes('credentials'))) {
        project.addLogMessage('error', `${error.message}. Configure credentials in the Settings -> Providers.`, false, promptContext);
      } else {
        project.addLogMessage('error', `${error instanceof Error ? error.message : String(error)}`, false, promptContext);
      }
    } finally {
      // Clean up abort controller only if we created it
      if (shouldCreateAbortController) {
        this.abortController = null;
      }

      // Always send a final "finished" message, regardless of whether there was text or tools
      project.processResponseMessage({
        id: currentResponseId,
        action: 'response',
        content: '',
        finished: true,
        promptContext,
      });
    }

    return resultMessages;
  }

  private async getLlmEnv(project: Project) {
    const env = {
      ...process.env,
    };

    const homeEnvPath = path.join(homedir(), '.env');
    const projectEnvPath = path.join(project.baseDir, '.env');

    try {
      await fs.access(homeEnvPath);
      const homeEnvContent = await fs.readFile(homeEnvPath, 'utf8');
      Object.assign(env, dotenv.parse(homeEnvContent));
    } catch {
      // File does not exist or other read error, ignore
    }

    try {
      await fs.access(projectEnvPath);
      const projectEnvContent = await fs.readFile(projectEnvPath, 'utf8');
      Object.assign(env, dotenv.parse(projectEnvContent));
    } catch {
      // File does not exist or other read error, ignore
    }

    Object.assign(env, this.getAiderEnv());

    return env;
  }

  private getAiderEnv(): Record<string, string> {
    if (!this.aiderEnv) {
      this.aiderEnv = parseAiderEnv(this.store.getSettings());
    }

    return this.aiderEnv;
  }

  private async prepareMessages(project: Project, profile: AgentProfile, contextMessages: CoreMessage[], contextFiles: ContextFile[]): Promise<CoreMessage[]> {
    const messages: CoreMessage[] = [];

    // Add repo map if enabled
    if (profile.includeRepoMap) {
      const repoMap = project.getRepoMap();
      if (repoMap) {
        messages.push({
          role: 'user',
          content: repoMap,
        });
        messages.push({
          role: 'assistant',
          content: 'Ok, I will use the repository map as a reference.',
        });
      }
    }

    // Add context files with content or just list of working files
    if (profile.includeContextFiles) {
      const contextFilesMessages = await this.getContextFilesMessages(project, profile, contextFiles);
      messages.push(...contextFilesMessages);
    } else {
      const workingFilesMessages = await this.getWorkingFilesMessages(contextFiles);
      messages.push(...workingFilesMessages);
    }

    // Add message history
    messages.push(...contextMessages);

    return messages;
  }

  async estimateTokens(project: Project, profile: AgentProfile): Promise<number> {
    try {
      const settings = this.store.getSettings();
      const messages = await this.prepareMessages(project, profile, project.getContextMessages(), project.getContextFiles());
      const toolSet = await this.getAvailableTools(project, profile);
      const systemPrompt = await getSystemPrompt(project.baseDir, profile);

      const llmProvider = getLlmProviderConfig(profile.provider, settings);
      const cacheControl = getCacheControl(profile, llmProvider);

      const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user');
      const userRequestMessageIndex = lastUserIndex >= 0 ? lastUserIndex : 0;

      const optimizedMessages = optimizeMessages(profile, userRequestMessageIndex, messages, cacheControl, settings);

      // Format tools for the prompt
      const toolDefinitions = Object.entries(toolSet).map(([name, tool]) => ({
        name,
        description: tool.description,
        parameters: tool.parameters ? tool.parameters.describe() : '', // Get Zod schema description
      }));
      const toolDefinitionsString = `Available tools: ${JSON.stringify(toolDefinitions, null, 2)}`;

      // Add tool definitions and system prompt to the beginning
      optimizedMessages.unshift({ role: 'system', content: toolDefinitionsString });
      optimizedMessages.unshift({ role: 'system', content: systemPrompt });

      const chatMessages = optimizedMessages.map((msg) => ({
        role: msg.role === 'tool' ? 'user' : msg.role, // Map 'tool' role to user message as gpt-tokenizer does not support tool messages
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content), // Handle potential non-string content if necessary
      }));

      return countTokens(chatMessages);
    } catch (error) {
      logger.error(`Error counting tokens: ${error}`);
      return 0;
    }
  }

  interrupt() {
    logger.info('Interrupting Agent run');
    this.abortController?.abort();
  }

  private processStep<TOOLS extends ToolSet>(
    currentResponseId: string,
    { reasoning, text, toolCalls, toolResults, finishReason, usage, providerMetadata, response }: StepResult<TOOLS>,
    project: Project,
    profile: AgentProfile,
    promptContext?: PromptContext,
  ): ContextMessage[] {
    logger.info(`Step finished. Reason: ${finishReason}`, {
      reasoning: reasoning?.substring(0, 100), // Log truncated reasoning
      text: text?.substring(0, 100), // Log truncated text
      toolCalls: toolCalls?.map((tc) => tc.toolName),
      toolResults: toolResults?.map((tr) => tr.toolName),
      usage,
      providerMetadata,
      promptContext,
    });

    const messages: ContextMessage[] = [];
    const messageCost = calculateCost(this.modelInfoManager, profile, usage.promptTokens, usage.completionTokens, providerMetadata);
    const usageReport: UsageReportData = getUsageReport(project, profile, messageCost, usage, providerMetadata);

    // Process text/reasoning content
    if (reasoning || text?.trim()) {
      const message: ResponseMessage = {
        id: currentResponseId,
        action: 'response',
        content: reasoning && text ? `${THINKING_RESPONSE_STAR_TAG}${reasoning.trim()}${ANSWER_RESPONSE_START_TAG}${text.trim()}` : reasoning || text,
        finished: true,
        // only send usage report if there are no tool results
        usageReport: toolResults?.length ? undefined : usageReport,
        promptContext,
      };
      project.processResponseMessage(message);
    }

    if (toolResults) {
      // Process successful tool results *after* sending text/reasoning and handling errors
      for (const toolResult of toolResults) {
        const [serverName, toolName] = extractServerNameToolName(toolResult.toolName);
        const toolPromptContext = extractPromptContextFromToolResult(toolResult.result) ?? promptContext;

        // Update the existing tool message with the result
        project.addToolMessage(toolResult.toolCallId, serverName, toolName, toolResult.args, JSON.stringify(toolResult.result), usageReport, toolPromptContext);
      }
    }

    project.addLogMessage('loading', undefined, false, promptContext);

    response.messages.forEach((message) => {
      if (message.role === 'assistant') {
        messages.push({
          ...message,
          usageReport: toolResults?.length ? undefined : usageReport,
          promptContext,
        });
      } else if (message.role === 'tool') {
        messages.push({
          ...message,
          usageReport,
          promptContext,
        });
      }
    });

    return messages;
  }
}
