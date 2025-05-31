import { useTranslation } from 'react-i18next';
import { RiToolsFill } from 'react-icons/ri';
import { FileWriteMode } from '@common/types';
import { getLanguageFromPath } from '@common/utils'; // Assuming CodeBlock can be used here

import { ToolMessage } from '@/types/message';
import { MessageBar } from '@/components/message/MessageBar';
import { CodeBlock } from '@/components/message/CodeBlock';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
};

const formatName = (name: string): string => {
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const FileWriteToolMessage = ({ message, onRemove }: Props) => {
  const { t } = useTranslation();

  const getToolDisplayName = (): string => {
    const filePath = message.args.filePath as string;
    const mode = message.args.mode as FileWriteMode;

    switch (mode) {
      case FileWriteMode.Overwrite:
        return t('toolMessage.power.fileWrite.overwrite', { filePath });
      case FileWriteMode.Append:
        return t('toolMessage.power.fileWrite.append', { filePath });
      case FileWriteMode.CreateOnly:
        return t('toolMessage.power.fileWrite.createOnly', { filePath });
      default:
        return t('toolMessage.toolLabel', { server: formatName(message.serverName), tool: formatName(message.toolName) });
    }
  };

  const contentToWrite = message.args.content as string;
  const filePath = message.args.filePath as string;

  const copyContent = JSON.stringify({ args: message.args, result: message.content && JSON.parse(message.content) }, null, 2);

  const language = getLanguageFromPath(filePath);

  return (
    <div className="border border-neutral-800 rounded-md mb-2 group p-3 bg-neutral-850">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-neutral-500">
          <RiToolsFill className="w-4 h-4" />
        </div>
        <div className="text-xs text-neutral-100">{getToolDisplayName()}</div>
      </div>

      <div className="text-xs text-neutral-300 bg-neutral-850">
        <CodeBlock baseDir="" language={language} file={filePath} isComplete={true}>
          {contentToWrite}
        </CodeBlock>
      </div>
      <MessageBar content={copyContent} usageReport={message.usageReport} remove={onRemove} />
    </div>
  );
};
