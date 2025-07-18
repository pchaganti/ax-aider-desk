import { SessionData } from '@common/types';
import { KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoDocumentTextOutline, IoListOutline, IoTrashOutline, IoAddOutline, IoSaveOutline, IoClose } from 'react-icons/io5';
import { LuImageDown } from 'react-icons/lu';
import { RiChatDownloadLine } from 'react-icons/ri';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  sessions: SessionData[];
  onLoadSessionMessages: (name: string) => void;
  onLoadSessionFiles: (name: string) => void;
  onSaveSession: (name: string) => void;
  onDeleteSession: (name: string) => void;
  onExportSessionToMarkdown: () => void;
  onExportSessionToImage: () => void;
};

export const SessionsPopup = ({
  sessions,
  onLoadSessionMessages,
  onLoadSessionFiles,
  onSaveSession,
  onDeleteSession,
  onExportSessionToMarkdown,
  onExportSessionToImage,
}: Props) => {
  const { t } = useTranslation();
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [showNewSessionInput, setShowNewSessionInput] = useState(false);

  const handleDeleteSession = () => {
    if (sessionToDelete) {
      onDeleteSession(sessionToDelete);
      setSessionToDelete(null);
    }
  };

  const handleSaveNewSession = () => {
    if (newSessionName.trim()) {
      onSaveSession(newSessionName.trim());
      setNewSessionName('');
      setShowNewSessionInput(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveNewSession();
    }
  };

  return (
    <div className="absolute right-0 top-full mt-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg z-50 w-[320px]">
      <div>
        <div className="p-2 text-xs font-semibold border-b border-neutral-700">{t('sessions.title')}</div>
        {sessions.length === 0 ? (
          <div className="text-xs text-neutral-400 p-2">{t('sessions.empty')}</div>
        ) : (
          <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600">
            {sessions.map((session) => (
              <div key={session.name} className="flex items-center justify-between text-xs px-2 py-0.5">
                <span className="truncate text-neutral-300">{session.name}</span>
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    className="p-1 hover:bg-neutral-600 rounded-md"
                    onClick={() => onSaveSession(session.name)}
                    data-tooltip-id="session-tooltip"
                    data-tooltip-content={t('sessions.save')}
                  >
                    <IoSaveOutline className="w-4 h-4 text-neutral-200" />
                  </button>

                  <button
                    className="p-1 hover:bg-neutral-600 rounded-md"
                    onClick={() => onLoadSessionMessages(session.name)}
                    data-tooltip-id="session-tooltip"
                    data-tooltip-content={t('sessions.loadMessages', { count: session.messages || 0 })}
                  >
                    <IoListOutline className="w-4 h-4 text-neutral-200" />
                  </button>

                  <button
                    className="p-1 hover:bg-neutral-600 rounded-md"
                    onClick={() => onLoadSessionFiles(session.name)}
                    data-tooltip-id="session-tooltip"
                    data-tooltip-content={t('sessions.loadFiles', { count: session.files || 0 })}
                  >
                    <IoDocumentTextOutline className="w-4 h-4 text-neutral-200" />
                  </button>

                  <button
                    className="p-1 hover:bg-neutral-600 rounded-md"
                    onClick={() => setSessionToDelete(session.name)}
                    data-tooltip-id="session-tooltip"
                    data-tooltip-content={t('common.delete')}
                  >
                    <IoTrashOutline className="w-4 h-4 text-neutral-200" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-2 py-2 border-t border-neutral-700 flex flex-col space-y-2">
          {showNewSessionInput ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('sessions.newSessionPlaceholder')}
                className="flex-grow text-xs px-2 py-1 rounded bg-neutral-800 border border-neutral-600 text-white focus:outline-none"
                autoFocus
              />
              <button className="p-1 hover:bg-neutral-600 rounded-md" onClick={handleSaveNewSession}>
                <IoSaveOutline className="w-4 h-4 text-neutral-200" />
              </button>
              <button
                className="p-1 hover:bg-neutral-600 rounded-md"
                onClick={() => {
                  setShowNewSessionInput(false);
                  setNewSessionName('');
                }}
              >
                <IoClose className="w-4 h-4 text-neutral-200" />
              </button>
            </div>
          ) : (
            <div className="flex align-center w-full justify-between">
              <button
                className="p-1 px-2 hover:bg-neutral-600 rounded-md flex items-center space-x-1 text-xs text-neutral-200"
                onClick={() => setShowNewSessionInput(true)}
              >
                <IoAddOutline className="w-4 h-4" />
                <span>{t('sessions.saveAsNew')}</span>
              </button>
              <div className="flex items-center space-x-1">
                <button
                  className="p-1 px-2 hover:bg-neutral-600 rounded-md flex items-center space-x-1 text-xs text-neutral-200"
                  onClick={onExportSessionToMarkdown}
                  data-tooltip-id="session-tooltip"
                  data-tooltip-content={t('sessions.exportAsMarkdown')}
                >
                  <RiChatDownloadLine className="w-4 h-4" />
                </button>
                <button
                  className="p-1 px-2 hover:bg-neutral-600 rounded-md flex items-center space-x-1 text-xs text-neutral-200"
                  onClick={onExportSessionToImage}
                  data-tooltip-id="session-tooltip"
                  data-tooltip-content={t('sessions.exportAsImage')}
                >
                  <LuImageDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {sessionToDelete && (
        <ConfirmDialog
          title={t('sessions.deleteTitle')}
          onConfirm={handleDeleteSession}
          onCancel={() => setSessionToDelete(null)}
          confirmButtonText={t('common.delete')}
        >
          <p>{t('sessions.deleteConfirm', { name: sessionToDelete })}</p>
          <p className="text-sm text-neutral-400 mt-1">{t('sessions.deleteWarning')}</p>
        </ConfirmDialog>
      )}
      <StyledTooltip id="session-tooltip" />
    </div>
  );
};
