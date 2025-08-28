import { BrowserWindow } from 'electron';
import { Socket } from 'socket.io';
import {
  ContextFile,
  CustomCommand,
  InputHistoryData,
  LogData,
  ModelsData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  ToolData,
  TokensInfoData,
  UserMessageData,
} from '@common/types';

export interface EventConnector {
  socket: Socket;
  eventTypes?: string[];
  baseDirs?: string[];
}

export class EventManager {
  private eventConnectors: EventConnector[] = [];

  constructor(private readonly mainWindow: BrowserWindow) {}

  // Project lifecycle events
  sendProjectStarted(baseDir: string): void {
    this.mainWindow.webContents.send('project-started', baseDir);
  }

  sendClearProject(baseDir: string, clearMessages: boolean, clearFiles: boolean): void {
    this.mainWindow.webContents.send('clear-project', baseDir, clearMessages, clearFiles);
  }

  // File management events
  sendFileAdded(baseDir: string, file: ContextFile): void {
    this.mainWindow.webContents.send('file-added', {
      baseDir,
      file,
    });
  }

  sendContextFilesUpdated(baseDir: string, files: ContextFile[]): void {
    this.mainWindow.webContents.send('context-files-updated', {
      baseDir,
      files,
    });
  }

  // Response events
  sendResponseChunk(data: ResponseChunkData): void {
    this.mainWindow.webContents.send('response-chunk', data);
    this.broadcastToEventConnectors('response-chunk', data);
  }

  sendResponseCompleted(data: ResponseCompletedData): void {
    this.mainWindow.webContents.send('response-completed', data);
    this.broadcastToEventConnectors('response-completed', data);
  }

  // Question events
  sendAskQuestion(questionData: QuestionData): void {
    this.mainWindow.webContents.send('ask-question', questionData);
  }

  // Autocompletion events
  sendUpdateAutocompletion(baseDir: string, words: string[], allFiles: string[], models: string[]): void {
    this.mainWindow.webContents.send('update-autocompletion', {
      baseDir,
      words,
      allFiles,
      models,
    });
  }

  // Aider models events
  sendUpdateAiderModels(modelsData: ModelsData): void {
    this.mainWindow.webContents.send('update-aider-models', modelsData);
  }

  // Command events
  sendCommandOutput(baseDir: string, command: string, output: string): void {
    this.mainWindow.webContents.send('command-output', {
      baseDir,
      command,
      output,
    });
  }

  // Log events
  sendLog(data: LogData): void {
    this.mainWindow.webContents.send('log', data);
    this.broadcastToEventConnectors('log', data);
  }

  // Tool events
  sendTool(data: ToolData): void {
    this.mainWindow.webContents.send('tool', data);
    this.broadcastToEventConnectors('tool', data);
  }

  // User message events
  sendUserMessage(data: UserMessageData): void {
    this.mainWindow.webContents.send('user-message', data);
  }

  // Tokens info events
  sendUpdateTokensInfo(tokensInfo: TokensInfoData): void {
    this.mainWindow.webContents.send('update-tokens-info', tokensInfo);
  }

  // Input history events
  sendInputHistoryUpdated(inputHistoryData: InputHistoryData): void {
    this.mainWindow.webContents.send('input-history-updated', inputHistoryData);
  }

  // Custom commands events
  sendCustomCommandsUpdated(baseDir: string, commands: CustomCommand[]): void {
    this.mainWindow.webContents.send('custom-commands-updated', {
      baseDir,
      commands,
    });
  }

  sendCustomCommandError(baseDir: string, error: string): void {
    this.mainWindow.webContents.send('custom-command-error', {
      baseDir,
      error,
    });
  }

  handleEventSubscription(socket: Socket, config: { eventTypes?: string[]; baseDirs?: string[] }): void {
    this.eventConnectors = this.eventConnectors.filter((connector) => connector.socket.id !== socket.id);
    this.eventConnectors.push({
      socket,
      eventTypes: config.eventTypes,
      baseDirs: config.baseDirs,
    });
  }

  handleEventUnsubscription(socket: Socket): void {
    this.eventConnectors = this.eventConnectors.filter((connector) => connector.socket.id !== socket.id);
  }

  private broadcastToEventConnectors(eventType: string, data: unknown): void {
    this.eventConnectors.forEach((connector) => {
      // Filter by event types if specified
      if (connector.eventTypes && !connector.eventTypes.includes(eventType)) {
        return;
      }

      // Filter by base directories if specified
      const baseDir = (data as { baseDir?: string })?.baseDir;
      if (connector.baseDirs && baseDir && !connector.baseDirs.includes(baseDir)) {
        return;
      }

      try {
        connector.socket.emit('event', { type: eventType, data });
      } catch {
        // Remove disconnected sockets
        this.handleEventUnsubscription(connector.socket);
      }
    });
  }
}
