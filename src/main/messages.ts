import { ContexFileSourceType, ContextFile } from '@common/types';

export type MessageAction = 'init' | 'prompt' | 'response' | 'add-file' | 'drop-file' | 'update-autocompletion' | 'ask-question' | 'answer-question';

export interface Message {
  action: MessageAction;
}

export interface InitMessage {
  action: 'init';
  baseDir: string;
  openFiles?: ContextFile[];
  listenTo?: MessageAction[];
}

export const isInitMessage = (message: Message): message is InitMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'init';
};

export type EditFormat = 'code' | 'ask' | 'architect';

export interface PromptMessage extends Message {
  action: 'prompt';
  prompt: string;
  editFormat?: EditFormat;
}

export interface ResponseMessage extends Message {
  action: 'response';
  content: string;
  finished: boolean;
  editedFiles?: string[];
  commitHash?: string;
  commitMessage?: string;
  diff?: string;
}

export const isResponseMessage = (message: Message): message is ResponseMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'response';
};

export interface AddFileMessage extends Message {
  action: 'add-file';
  path: string;
  sourceType?: ContexFileSourceType;
  readOnly?: boolean;
}

export const isAddFileMessage = (message: Message): message is AddFileMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'add-file';
};

export interface DropFileMessage extends Message {
  action: 'drop-file';
  path: string;
  readOnly?: boolean;
}

export const isDropFileMessage = (message: Message): message is DropFileMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'drop-file';
};

export interface UpdateAutocompletionMessage extends Message {
  action: 'update-autocompletion';
  words: string[];
  allFiles: string[];
}

export const isUpdateAutocompletionMessage = (message: Message): message is UpdateAutocompletionMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'update-autocompletion';
};

export interface AskQuestionMessage extends Message {
  action: 'ask-question';
  question: string;
  subject?: string;
  defaultAnswer: string;
}

export const isAskQuestionMessage = (message: Message): message is AskQuestionMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'ask-question';
};

export interface AnswerQuestionMessage extends Message {
  action: 'answer-question';
  answer: string;
}
