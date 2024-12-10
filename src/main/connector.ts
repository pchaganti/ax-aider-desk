import { Socket } from 'socket.io';
import { ContextFile, FileEdit } from '@common/types';
import {
  AddFileMessage,
  AddMessageMessage,
  AnswerQuestionMessage,
  ApplyEditsMessage,
  DropFileMessage,
  EditFormat,
  InterruptResponseMessage,
  Message,
  MessageAction,
  PromptMessage,
  RunCommandMessage,
  SetModelsMessage,
} from './messages';
import logger from './logger';

export class Connector {
  socket: Socket;
  baseDir: string;
  listenTo: MessageAction[];

  constructor(socket: Socket, baseDir: string, listenTo: MessageAction[] = []) {
    this.socket = socket;
    this.baseDir = baseDir;
    this.listenTo = listenTo;
  }

  private sendMessage = (message: Message) => {
    if (!this.socket.connected) {
      logger.warn('Socket.IO client is not connected');
      return;
    }
    logger.info('Sending message to client:', { baseDir: this.baseDir, messageType: message.action });
    this.socket.emit('message', message);
  };

  public sendPromptMessage(prompt: string, editFormat?: EditFormat): void {
    const message: PromptMessage = {
      action: 'prompt',
      prompt,
      editFormat,
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

  public sendAddFileMessage = (contextFile: ContextFile) => {
    const message: AddFileMessage = {
      action: 'add-file',
      path: contextFile.path,
      readOnly: contextFile.readOnly,
    };
    this.sendMessage(message);
  };

  public sendDropFileMessage = (path: string) => {
    const message: DropFileMessage = {
      action: 'drop-file',
      path,
    };
    this.sendMessage(message);
  };

  public sendSetModelsMessage(mainModel: string, weakModel: string): void {
    const message: SetModelsMessage = {
      action: 'set-models',
      name: mainModel,
      weakModel,
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

  public sendAddMessageMessage(content: string) {
    const message: AddMessageMessage = {
      action: 'add-message',
      content,
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
}
