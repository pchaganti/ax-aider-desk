import path from 'path';

import { ContextFile, EditFormat, FileEdit, MessageRole, Mode } from '@common/types';
import { Socket } from 'socket.io';

import logger from '@/logger';
import {
  AddFileMessage,
  AddMessageMessage,
  AnswerQuestionMessage,
  ApplyEditsMessage,
  DropFileMessage,
  InterruptResponseMessage,
  Message,
  MessageAction,
  PromptMessage,
  RunCommandMessage,
  SetModelsMessage,
  CompactConversationMessage,
  UpdateEnvVarsMessage,
} from '@/messages';

export class Connector {
  socket: Socket;
  baseDir: string;
  listenTo: MessageAction[];
  inputHistoryFile?: string;

  constructor(socket: Socket, baseDir: string, listenTo: MessageAction[] = [], inputHistoryFile?: string) {
    this.socket = socket;
    this.baseDir = baseDir;
    this.listenTo = listenTo;
    this.inputHistoryFile = inputHistoryFile;
  }

  private sendMessage = (message: Message) => {
    if (!this.socket.connected) {
      logger.warn('Socket.IO client is not connected');
      return;
    }
    logger.info('Sending message to connector:', {
      baseDir: this.baseDir,
      messageType: message.action,
    });
    this.socket.emit('message', message);
  };

  public sendPromptMessage(
    prompt: string,
    mode: Mode | null = null,
    architectModel: string | null = null,
    promptId: string | null = null,
    clearContext = false,
    clearFiles = false,
  ): void {
    const message: PromptMessage = {
      action: 'prompt',
      prompt,
      mode,
      architectModel,
      promptId,
      clearContext,
      clearFiles,
    };
    this.sendMessage(message);
  }

  public sendAnswerQuestionMessage = (answer: string) => {
    const message: AnswerQuestionMessage = {
      action: 'answer-question',
      answer,
    };
    this.sendMessage(message);
  };

  public sendAddFileMessage = (contextFile: ContextFile, noUpdate = false) => {
    const filePath = contextFile.readOnly || contextFile.path.startsWith(this.baseDir) ? contextFile.path : path.join(this.baseDir, contextFile.path);

    const message: AddFileMessage = {
      action: 'add-file',
      path: filePath,
      readOnly: contextFile.readOnly,
      noUpdate,
    };
    this.sendMessage(message);
  };

  public sendDropFileMessage = (path: string, noUpdate = false) => {
    const message: DropFileMessage = {
      action: 'drop-file',
      path,
      noUpdate,
    };
    this.sendMessage(message);
  };

  public sendSetModelsMessage(mainModel: string, weakModel: string | null, editFormat?: EditFormat): void {
    const message: SetModelsMessage = {
      action: 'set-models',
      mainModel,
      weakModel,
      editFormat,
    };
    this.sendMessage(message);
  }

  public sendRunCommandMessage(command: string): void {
    const message: RunCommandMessage = {
      action: 'run-command',
      command: `/${command}`,
    };
    this.sendMessage(message);
  }

  public sendAddMessageMessage(role: MessageRole = MessageRole.User, content: string, acknowledge = true) {
    const message: AddMessageMessage = {
      action: 'add-message',
      content,
      role,
      acknowledge,
    };
    this.sendMessage(message);
  }

  public sendInterruptResponseMessage() {
    const message: InterruptResponseMessage = {
      action: 'interrupt-response',
    };
    this.sendMessage(message);
  }

  public sendApplyEditsMessage(edits: FileEdit[]) {
    const message: ApplyEditsMessage = {
      action: 'apply-edits',
      edits,
    };
    this.sendMessage(message);
  }

  public sendCompactConversationMessage(customInstructions?: string) {
    const message: CompactConversationMessage = {
      action: 'compact-conversation',
      customInstructions,
    };
    this.sendMessage(message);
  }

  public sendUpdateEnvVarsMessage(environmentVariables: Record<string, unknown>) {
    const message: UpdateEnvVarsMessage = {
      action: 'update-env-vars',
      environmentVariables,
    };
    this.sendMessage(message);
  }
}
