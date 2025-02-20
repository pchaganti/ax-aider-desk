import {
  AutocompletionData,
  CommandOutputData,
  LogData,
  ModelsData,
  ProjectData,
  ResponseChunkData,
  ResponseCompletedData,
  TokensInfoData,
  QuestionData,
} from '@common/types';
import { AddFileDialog } from 'components/AddFileDialog';
import { ContextFiles } from 'components/ContextFiles';
import { Messages } from 'components/Messages';
import { PromptField, PromptFieldRef } from 'components/PromptField';
import { SessionInfo } from 'components/SessionInfo';
import { IpcRendererEvent } from 'electron';
import { useEffect, useRef, useState } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { ConfirmDialog } from 'components/ConfirmDialog';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';
import {
  CommandOutputMessage,
  isCommandOutputMessage,
  isLoadingMessage,
  LoadingMessage,
  LogMessage,
  Message,
  PromptMessage,
  ResponseMessage,
} from 'types/message';
import { v4 as uuidv4 } from 'uuid';
import { ProjectBar, ProjectTopBarRef } from 'components/ProjectBar';

type AddFileDialogOptions = {
  readOnly: boolean;
};

type Props = {
  project: ProjectData;
  isActive?: boolean;
};

export const ProjectView = ({ project, isActive = false }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [processing, setProcessing] = useState(false);
  const [addFileDialogOptions, setAddFileDialogOptions] = useState<AddFileDialogOptions | null>(null);
  const [autocompletionData, setAutocompletionData] = useState<AutocompletionData | null>(null);
  const [modelsData, setModelsData] = useState<ModelsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);
  const [lastMessageCost, setLastMessageCost] = useState<number | undefined>(undefined);
  const [tokensInfo, setTokensInfo] = useState<TokensInfoData | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [editFormat, setEditFormat] = useState<string>('code');
  const [showFrozenDialog, setShowFrozenDialog] = useState(false);
  const processingMessageRef = useRef<ResponseMessage | null>(null);
  const promptFieldRef = useRef<PromptFieldRef>(null);
  const projectTopBarRef = useRef<ProjectTopBarRef>(null);
  const frozenTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    window.api.startProject(project.baseDir);

    return () => {
      window.api.stopProject(project.baseDir);
    };
  }, [project.baseDir]);

  useEffect(() => {
    if (messages.length > 0 || modelsData) {
      setLoading(false);
    }
  }, [messages, modelsData]);

  useEffect(() => {
    if (!processing && frozenTimeoutRef.current) {
      clearTimeout(frozenTimeoutRef.current);
      frozenTimeoutRef.current = null;
    }
  }, [processing]);

  useEffect(() => {
    const loadingMessageIndex = messages.findIndex(isLoadingMessage);
    if (loadingMessageIndex !== -1 && loadingMessageIndex === messages.length - 2) {
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages.splice(loadingMessageIndex, 1);
        return newMessages;
      });
    }
  }, [messages]);

  useEffect(() => {
    const handleResponseChunk = (_: IpcRendererEvent, { messageId, chunk, reflectedMessage }: ResponseChunkData) => {
      const processingMessage = processingMessageRef.current;
      if (!processingMessage || processingMessage.id !== messageId) {
        const newMessages: Message[] = [];

        if (reflectedMessage) {
          newMessages.push({
            id: uuidv4(),
            type: 'reflected-message',
            content: reflectedMessage,
          });
        }

        const newResponseMessage: ResponseMessage = {
          id: messageId,
          type: 'response',
          content: chunk,
          processing: true,
        };
        processingMessageRef.current = newResponseMessage;
        newMessages.push(newResponseMessage);
        setMessages((prevMessages) => prevMessages.filter((message) => !isLoadingMessage(message)).concat(...newMessages));
        if (!processing) {
          setProcessing(true);
        }
      } else {
        processingMessage.content += chunk;
        setMessages((prevMessages) => prevMessages.map((message) => (message.id === messageId ? processingMessage : message)));
      }
    };

    const handleResponseCompleted = (_: IpcRendererEvent, { messageId, usageReport, content }: ResponseCompletedData) => {
      const processingMessage = processingMessageRef.current;

      // If no processing message exists, find the last response message
      if (!processingMessage && content) {
        const newResponseMessage: ResponseMessage = {
          id: messageId,
          type: 'response',
          content,
          processing: false,
          usageReport,
        };
        setMessages((prevMessages) => prevMessages.filter((message) => !isLoadingMessage(message)).concat(newResponseMessage));
      } else if (processingMessage && processingMessage.id === messageId) {
        processingMessage.processing = false;
        processingMessage.usageReport = usageReport;
        processingMessage.content = content;
        setMessages((prevMessages) => prevMessages.map((message) => (message.id === messageId ? processingMessage : message)));

        processingMessageRef.current = null;
      }

      if (usageReport) {
        setTotalCost(usageReport.totalCost);
        setLastMessageCost(usageReport.messageCost);
      }
      setProcessing(false);
    };

    const handleCommandOutput = (_: IpcRendererEvent, { command, output }: CommandOutputData) => {
      setMessages((prevMessages) => {
        const lastMessage = prevMessages[prevMessages.length - 1];

        if (lastMessage && isCommandOutputMessage(lastMessage) && lastMessage.command === command) {
          const updatedLastMessage: CommandOutputMessage = {
            ...lastMessage,
            content: lastMessage.content + output,
          };
          return prevMessages.slice(0, -1).concat(updatedLastMessage);
        } else {
          const commandOutputMessage: CommandOutputMessage = {
            id: uuidv4(),
            type: 'command-output',
            command,
            content: output,
          };
          return prevMessages.filter((message) => !isLoadingMessage(message)).concat(commandOutputMessage);
        }
      });
    };

    const handleLog = (_: IpcRendererEvent, { level, message }: LogData) => {
      if (level === 'loading') {
        const loadingMessage: LoadingMessage = {
          id: uuidv4(),
          type: 'loading',
          content: message,
        };
        setMessages((prevMessages) => [...prevMessages, loadingMessage]);
      } else {
        const logMessage: LogMessage = {
          id: uuidv4(),
          type: 'log',
          level,
          content: message,
        };
        setMessages((prevMessages) => [...prevMessages.filter((message) => !isLoadingMessage(message)), logMessage]);
      }
    };

    const handleUpdateAutocompletion = (_: IpcRendererEvent, data: AutocompletionData) => {
      setAutocompletionData(data);
    };

    const handleSetCurrentModels = (_: IpcRendererEvent, data: ModelsData) => {
      setModelsData(data);

      if (data.error) {
        const errorMessage: LogMessage = {
          id: uuidv4(),
          type: 'log',
          level: 'error',
          content: data.error,
        };
        setMessages((prevMessages) => [...prevMessages, errorMessage]);
      }
    };

    const handleTokensInfo = (_: IpcRendererEvent, data: TokensInfoData) => {
      setTokensInfo(data);
    };

    const handleQuestion = (_: IpcRendererEvent, data: QuestionData) => {
      setQuestion(data);
    };

    const autocompletionListenerId = window.api.addUpdateAutocompletionListener(project.baseDir, handleUpdateAutocompletion);
    const currentModelsListenerId = window.api.addSetCurrentModelsListener(project.baseDir, handleSetCurrentModels);
    const commandOutputListenerId = window.api.addCommandOutputListener(project.baseDir, handleCommandOutput);
    const responseChunkListenerId = window.api.addResponseChunkListener(project.baseDir, handleResponseChunk);
    const responseCompletedListenerId = window.api.addResponseCompletedListener(project.baseDir, handleResponseCompleted);
    const logListenerId = window.api.addLogListener(project.baseDir, handleLog);
    const tokensInfoListenerId = window.api.addTokensInfoListener(project.baseDir, handleTokensInfo);
    const questionListenerId = window.api.addAskQuestionListener(project.baseDir, handleQuestion);

    return () => {
      window.api.removeUpdateAutocompletionListener(autocompletionListenerId);
      window.api.removeSetCurrentModelsListener(currentModelsListenerId);
      window.api.removeCommandOutputListener(commandOutputListenerId);
      window.api.removeResponseChunkListener(responseChunkListenerId);
      window.api.removeResponseCompletedListener(responseCompletedListenerId);
      window.api.removeLogListener(logListenerId);
      window.api.removeTokensInfoListener(tokensInfoListenerId);
      window.api.removeAskQuestionListener(questionListenerId);
    };
  }, [project.baseDir, processing]);

  const handleAddFile = (filePath: string, readOnly = false) => {
    window.api.addFile(project.baseDir, filePath, readOnly);
    setAddFileDialogOptions(null);
    promptFieldRef.current?.focus();
  };

  const handlePromptSubmit = (prompt: string) => {
    setProcessing(true);
    const promptMessage: PromptMessage = {
      id: uuidv4(),
      type: 'prompt',
      editFormat,
      content: prompt,
    };
    const loadingMessage: LoadingMessage = {
      id: uuidv4(),
      type: 'loading',
      content: 'Thinking...',
    };
    setMessages((prevMessages) => [...prevMessages, promptMessage, loadingMessage]);
  };

  const showFileDialog = (readOnly: boolean) => {
    setAddFileDialogOptions({
      readOnly,
    });
  };

  const clearMessages = () => {
    const lastModelsMessage = messages.filter((message) => message.type === 'models').pop();
    setMessages(lastModelsMessage ? [lastModelsMessage] : []);
    setProcessing(false);
    window.api.runCommand(project.baseDir, 'clear');
  };

  const refreshRepositoryMap = () => {
    window.api.runCommand(project.baseDir, 'map-refresh');
  };

  const undoCommit = () => {
    window.api.runCommand(project.baseDir, 'undo');
  };

  const runTests = (testCmd?: string) => {
    window.api.runCommand(project.baseDir, `test ${testCmd || ''}`);
  };

  const answerQuestion = (answer: string) => {
    if (question) {
      if (question.answerFunction) {
        question.answerFunction(answer);
      } else {
        window.api.answerQuestion(project.baseDir, answer);
      }
      setQuestion(null);
    }
  };

  const scrapeWeb = async (url: string) => {
    setProcessing(true);
    const loadingMessage: LoadingMessage = {
      id: uuidv4(),
      type: 'loading',
      content: `Scraping ${url}...`,
    };
    setMessages((prevMessages) => [...prevMessages, loadingMessage]);

    try {
      await window.api.scrapeWeb(project.baseDir, url);
      const infoMessage: LogMessage = {
        id: uuidv4(),
        level: 'info',
        type: 'log',
        content: `Content from ${url} has been added to the chat.`,
      };
      setMessages((prevMessages) => [...prevMessages, infoMessage]);
    } catch (error) {
      if (error instanceof Error) {
        const getMessage = () => {
          if (error.message.includes('Cannot navigate to invalid URL')) {
            return `Invalid URL: ${url}`;
          } else if (error.message.includes('npx playwright install')) {
            return 'Playwright is not installed. Run `npx playwright install` in the terminal to install it and try again.';
          } else {
            return `Error during scraping: ${error.message}`;
          }
        };

        const errorMessage: LogMessage = {
          id: uuidv4(),
          level: 'error',
          type: 'log',
          content: getMessage(),
        };
        setMessages((prevMessages) => [...prevMessages, errorMessage]);
      }
    } finally {
      setMessages((prevMessages) => prevMessages.filter((message) => message !== loadingMessage));
      setProcessing(false);
    }
  };

  const handleInterruptResponse = () => {
    window.api.interruptResponse(project.baseDir);
    const interruptMessage: LogMessage = {
      id: uuidv4(),
      type: 'log',
      level: 'warning',
      content: 'Interrupted by user.',
    };
    setMessages((prevMessages) => [...prevMessages, interruptMessage]);

    frozenTimeoutRef.current = setTimeout(() => {
      if (processing) {
        setShowFrozenDialog(true);
      }
    }, 5000);
  };

  const handleModelChange = () => {
    promptFieldRef.current?.focus();
    setModelsData(null);
  };

  const restartProject = () => {
    setShowFrozenDialog(false);
    setLoading(true);
    setMessages([]);
    setLastMessageCost(0);
    setTotalCost(0);
    setProcessing(false);
    setTokensInfo(null);
    setQuestion(null);
    setModelsData(null);
    void window.api.restartProject(project.baseDir);
  };

  return (
    <div className="flex h-full bg-gradient-to-b from-neutral-950 to-neutral-900 relative">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900 z-10">
          <CgSpinner className="animate-spin w-10 h-10" />
          <div className="mt-2 text-sm text-center text-white">Loading...</div>
        </div>
      )}
      <div className="flex flex-col flex-grow overflow-hidden">
        <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900">
          <ProjectBar
            ref={projectTopBarRef}
            baseDir={project.baseDir}
            modelsData={modelsData}
            allModels={autocompletionData?.models}
            architectMode={editFormat === 'architect'}
            onModelChange={handleModelChange}
          />
        </div>
        <div className="flex-grow overflow-y-auto">
          <Messages baseDir={project.baseDir} messages={messages} allFiles={autocompletionData?.allFiles} />
        </div>
        <div className="relative bottom-0 w-full p-4 pb-2 flex-shrink-0 flex border-t border-neutral-800">
          <PromptField
            ref={promptFieldRef}
            baseDir={project.baseDir}
            onSubmitted={handlePromptSubmit}
            processing={processing}
            editFormat={editFormat}
            setEditFormat={setEditFormat}
            isActive={isActive}
            words={autocompletionData?.words}
            clearMessages={clearMessages}
            scrapeWeb={scrapeWeb}
            showFileDialog={showFileDialog}
            question={question}
            answerQuestion={answerQuestion}
            interruptResponse={handleInterruptResponse}
            undoCommit={undoCommit}
            runTests={runTests}
            openModelSelector={() => projectTopBarRef.current?.openMainModelSelector()}
            disabled={!modelsData}
          />
        </div>
      </div>
      <ResizableBox
        width={300}
        height={Infinity}
        minConstraints={[100, Infinity]}
        maxConstraints={[window.innerWidth - 300, Infinity]}
        axis="x"
        resizeHandles={['w']}
        className="border-l border-neutral-800 flex flex-col flex-shrink-0"
      >
        <div className="flex flex-col h-full">
          <div className="flex-grow flex flex-col overflow-y-hidden">
            <ContextFiles
              baseDir={project.baseDir}
              showFileDialog={() =>
                setAddFileDialogOptions({
                  readOnly: false,
                })
              }
            />
          </div>
          <SessionInfo
            tokensInfo={tokensInfo}
            totalCost={totalCost}
            lastMessageCost={lastMessageCost}
            clearMessages={clearMessages}
            refreshRepoMap={refreshRepositoryMap}
            restartProject={restartProject}
          />
        </div>
      </ResizableBox>
      {showFrozenDialog && (
        <ConfirmDialog
          title="AIDER FROZEN?"
          onConfirm={restartProject}
          onCancel={() => setShowFrozenDialog(false)}
          confirmButtonText="Restart"
          cancelButtonText="Wait"
          closeOnEscape={false}
        >
          Aider process seems to be frozen. Would you like to restart the session?
        </ConfirmDialog>
      )}
      {addFileDialogOptions && (
        <AddFileDialog
          baseDir={project.baseDir}
          onClose={() => {
            setAddFileDialogOptions(null);
            promptFieldRef.current?.focus();
          }}
          onAddFile={handleAddFile}
          initialReadOnly={addFileDialogOptions.readOnly}
        />
      )}
    </div>
  );
};
