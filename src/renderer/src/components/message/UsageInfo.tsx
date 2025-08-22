import { useTranslation } from 'react-i18next';
import { FaArrowRightFromBracket, FaArrowRightToBracket, FaDollarSign, FaDownload, FaUpload } from 'react-icons/fa6';
import { UsageReportData } from '@common/types';

type Props = {
  usageReport: UsageReportData;
  className?: string;
};

export const UsageInfo = ({ usageReport, className }: Props) => {
  const { t } = useTranslation();

  return (
    <div className={className}>
      <div className="flex items-center gap-3 px-2 text-2xs text-text-muted group-hover:text-text-secondary transition-colors">
        {usageReport.cacheWriteTokens && usageReport.cacheWriteTokens > 0 ? (
          <span className="flex items-center gap-1" data-tooltip-id="usage-info-tooltip" data-tooltip-content={t('responseMessage.cacheWriteTokens')}>
            <FaDownload className="w-2.5 h-2.5 mr-0.5" /> {usageReport.cacheWriteTokens}
          </span>
        ) : null}
        {usageReport.cacheReadTokens && usageReport.cacheReadTokens > 0 ? (
          <span className="flex items-center gap-1" data-tooltip-id="usage-info-tooltip" data-tooltip-content={t('responseMessage.cacheReadTokens')}>
            <FaUpload className="w-2.5 h-2.5 mr-0.5" /> {usageReport.cacheReadTokens}
          </span>
        ) : null}
        <span className="flex items-center gap-1" data-tooltip-id="usage-info-tooltip" data-tooltip-content={t('responseMessage.inputTokens')}>
          <FaArrowRightToBracket className="w-2.5 h-2.5 mr-0.5 rotate-90" /> {usageReport.sentTokens}
        </span>
        <span className="flex items-center gap-1" data-tooltip-id="usage-info-tooltip" data-tooltip-content={t('responseMessage.outputTokens')}>
          <FaArrowRightFromBracket className="w-2.5 h-2.5 mr-0.5 -rotate-90" /> {usageReport.receivedTokens}
        </span>
        {usageReport.messageCost > 0 && (
          <span className="flex items-center gap-0.5">
            <FaDollarSign className="w-2.5 h-2.5" /> {usageReport.messageCost.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
};
