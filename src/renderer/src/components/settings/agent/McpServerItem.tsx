import { McpServerConfig, McpTool, ToolApprovalState } from '@common/types';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { McpToolItem } from './McpToolItem';

import { Accordion } from '@/components/common/Accordion';
import { IconButton } from '@/components/common/IconButton';
import { Checkbox } from '@/components/common/Checkbox';

type Props = {
  serverName: string;
  config: McpServerConfig;
  onRemove?: () => void;
  onEdit?: () => void;
  toolApprovals: Record<string, ToolApprovalState>;
  onApprovalChange: (toolId: string, approval: ToolApprovalState) => void;
  reloadTrigger?: number;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
};

export const McpServerItem = ({
  serverName,
  config,
  onRemove,
  onEdit,
  toolApprovals,
  onApprovalChange,
  reloadTrigger = 0,
  enabled,
  onEnabledChange,
}: Props) => {
  const { t } = useTranslation();
  const [tools, setTools] = useState<McpTool[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTools = async () => {
      try {
        const loadedTools = await window.api.loadMcpServerTools(serverName, config);
        setTools(loadedTools);
        setError(null);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load MCP server tools:', error);
        setTools(null);
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    void loadTools();
  }, [serverName, config, reloadTrigger]);

  const renderTitle = () => {
    const enabledCount =
      tools && tools.length - tools.filter((tool) => toolApprovals[`${serverName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`] === ToolApprovalState.Never).length;

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          {onEnabledChange && <Checkbox id={`enable-server-${serverName}`} checked={enabled || false} onChange={onEnabledChange} className="mr-2" />}
          <span className="text-sm">{serverName}</span>
        </div>
        <div className="flex items-center">
          {loading ? (
            <span className="text-xs text-neutral-400">{t('common.loading')}</span>
          ) : (
            tools &&
            tools?.length > 0 && (
              <span className="text-xs mr-3 text-neutral-400">
                {t('mcp.serverToolStatus', {
                  count: tools.length,
                  enabledCount,
                })}
              </span>
            )
          )}
          {!loading && (
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full flex items-center justify-center ${tools && tools.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
          )}
          {onEdit && (
            <IconButton
              icon={<FaPencilAlt className="text-neutral-200 hover:text-neutral-100 w-3.5 h-3.5" />}
              onClick={onEdit}
              tooltip={t('common.edit')}
              className="ml-4"
              tooltipId="mcp-server-item"
            />
          )}
          {onRemove && (
            <IconButton
              icon={<FaTrash className="text-red-500/60 hover:text-red-500 w-3.5 h-3.5" />}
              onClick={onRemove}
              tooltip={t('common.remove')}
              className="ml-3"
              tooltipId="mcp-server-item"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-neutral-700 rounded mb-1">
      <Accordion title={renderTitle()} buttonClassName="px-2" chevronPosition="right">
        {loading ? (
          <div className="text-xs text-neutral-500 p-2">{t('common.loading')}</div>
        ) : error ? (
          <div className="text-xs text-red-400 p-4">{error}</div>
        ) : tools && tools.length > 0 ? (
          <div>
            <div className="text-xs p-2 pt-1 rounded mt-1 space-y-2">
              <div className="text-xs text-neutral-400 ml-1">{t('mcp.tools')}</div>
              {tools.map((tool) => (
                <McpToolItem key={tool.name} tool={tool} toolApprovals={toolApprovals} onApprovalChange={onApprovalChange} serverName={serverName} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-neutral-500 p-4">{t('mcp.noToolsFound')}</div>
        )}
      </Accordion>
    </div>
  );
};
