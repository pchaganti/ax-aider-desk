import { useTranslation } from 'react-i18next';
import { RiFolderLine, RiFileTextLine, RiErrorWarningFill, RiCheckboxCircleFill } from 'react-icons/ri';
import { LuFolderSearch } from 'react-icons/lu';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { CodeInline } from '@/components/common/CodeInline';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
};

export const GlobToolMessage = ({ message, onRemove }: Props) => {
  const { t } = useTranslation();

  const pattern = message.args.pattern as string;
  const content = message.content && JSON.parse(message.content);
  const isError = content && !Array.isArray(content);

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <LuFolderSearch className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.power.glob.title')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{pattern}</CodeInline>
        </span>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />}
      {content &&
        (isError || content.length === 0 ? (
          <span className="text-left">
            <StyledTooltip id={`glob-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill
              className="w-3 h-3 text-error"
              data-tooltip-id={`glob-error-tooltip-${message.id}`}
              data-tooltip-content={isError ? content : t('toolMessage.power.glob.noMatches')}
            />
          </span>
        ) : (
          <RiCheckboxCircleFill className="w-3 h-3 text-success" />
        ))}
    </div>
  );

  const renderContent = () => {
    if (isError) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="text-error">{content}</div>
        </div>
      );
    }

    if (!content || content.length === 0) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="text-text-muted">{t('toolMessage.power.glob.noMatches')}</div>
        </div>
      );
    }

    const groupedFiles: Record<string, string[]> = content.reduce((acc: Record<string, string[]>, filePath: string) => {
      const parts = filePath.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      const file = parts[parts.length - 1];
      if (!acc[dir]) {
        acc[dir] = [];
      }
      acc[dir].push(file);
      return acc;
    }, {});

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-text-secondary">{t('toolMessage.power.glob.foundFiles', { count: content.length })}</span>
        </div>
        {Object.keys(groupedFiles).length > 1 ? (
          (Object.entries(groupedFiles) as [string, string[]][]).map(([dir, files]) => (
            <div key={dir} className="mb-1">
              <div className="flex items-center gap-1 text-text-secondary mb-1">
                <RiFolderLine className="w-3 h-3" />
                <span>{dir || '.'}</span>
              </div>
              <div className="ml-4">
                {files.map((file: string) => (
                  <div key={file} className="flex items-center gap-1 text-text-primary">
                    <RiFileTextLine className="w-3 h-3" />
                    <span>{file}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-1">
            {content.map((filePath: string) => (
              <div key={filePath} className="flex items-center gap-1 text-text-primary">
                <RiFileTextLine className="w-3 h-3" />
                <span>{filePath}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return <ExpandableMessageBlock title={title} content={renderContent()} usageReport={message.usageReport} onRemove={onRemove} />;
};
