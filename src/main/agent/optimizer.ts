import { CacheControl } from 'src/main/agent/llm-provider';
import { cloneDeep } from 'lodash';
import { type CoreUserMessage, type CoreMessage, type ToolContent, type ToolResultPart } from 'ai';

import logger from '../logger';

export const optimizeMessages = (messages: CoreMessage[], cacheControl: CacheControl) => {
  if (messages.length === 0) {
    return [];
  }

  let optimizedMessages = cloneDeep(messages);

  optimizedMessages = convertImageToolResults(optimizedMessages);

  logger.info('Optimized messages:', {
    before: {
      count: messages.length,
      roles: messages.map((m) => m.role),
    },
    after: {
      count: optimizedMessages.length,
      roles: optimizedMessages.map((m) => m.role),
    },
  });

  const lastMessage = optimizedMessages[messages.length - 1];

  if (cacheControl) {
    lastMessage.providerOptions = {
      ...lastMessage.providerOptions,
      ...cacheControl,
    };
  }

  return optimizedMessages;
};

const convertImageToolResults = (messages: CoreMessage[]): CoreMessage[] => {
  const newMessages: CoreMessage[] = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      const toolContent = message.content as ToolContent;
      const updatedToolContent: ToolResultPart[] = [];
      const userMessagesToAdd: CoreUserMessage[] = [];

      for (const toolResultPart of toolContent) {
        if (toolResultPart.result) {
          try {
            const resultString = typeof toolResultPart.result === 'string' ? toolResultPart.result : JSON.stringify(toolResultPart.result);
            const parsedResult = JSON.parse(resultString);

            if (
              parsedResult &&
              Array.isArray(parsedResult.content) &&
              parsedResult.content.length === 1 &&
              parsedResult.content[0].type === 'image' &&
              (parsedResult.content[0].data || parsedResult.content[0].image) &&
              parsedResult.content[0].mimeType?.startsWith('image/')
            ) {
              updatedToolContent.push({
                ...toolResultPart,
                result: 'Image rendered.',
              });
              userMessagesToAdd.push({
                role: 'user',
                content: [
                  {
                    type: 'image',
                    image: parsedResult.content[0].data || parsedResult.content[0].image,
                    mimeType: parsedResult.content[0].mimeType,
                  },
                ],
              } satisfies CoreUserMessage);
            } else {
              updatedToolContent.push(toolResultPart);
            }
          } catch (error) {
            logger.error('Failed to parse tool result as JSON:', { error });
            // If result is not valid JSON, or doesn't match the image format,
            // just keep the original toolResultPart as is.
            updatedToolContent.push(toolResultPart);
          }
        } else {
          updatedToolContent.push(toolResultPart);
        }
      }

      // Push the modified tool message
      newMessages.push({
        ...message,
        content: updatedToolContent,
      });

      // Push the user message if it was created
      for (const userMessage of userMessagesToAdd) {
        logger.info('Adding user message for image tool result', {
          toolCallId: toolContent[0].toolCallId,
        });
        newMessages.push(userMessage);
      }
    } else {
      // For non-tool messages, just push them as is
      newMessages.push(message);
    }
  }

  return newMessages;
};
