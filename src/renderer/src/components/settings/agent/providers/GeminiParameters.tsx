import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GeminiProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { Slider } from '@/components/common/Slider';
import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  provider: GeminiProvider;
  onChange: (updated: GeminiProvider) => void;
};

export const GeminiParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey, customBaseUrl, thinkingBudget, includeThoughts, useSearchGrounding } = provider;

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleCustomBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, customBaseUrl: e.target.value });
  };

  const handleThinkingBudgetChange = (value: number) => {
    onChange({ ...provider, thinkingBudget: value });
  };

  const handleIncludeThoughtsChange = (checked: boolean) => {
    onChange({ ...provider, includeThoughts: checked });
  };

  const handleUseSearchGroundingChange = (checked: boolean) => {
    onChange({ ...provider, useSearchGrounding: checked });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-md font-medium uppercase mb-5">
        {t('providers.gemini')} {t('settings.agent.providerSettings')}
      </h3>
      <Input
        label={t('gemini.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={t('settings.agent.envVarPlaceholder', {
          envVar: 'GEMINI_API_KEY',
        })}
      />
      <Input
        label={t('gemini.customBaseUrl')}
        value={customBaseUrl || ''}
        onChange={handleCustomBaseUrlChange}
        placeholder={t('settings.agent.envVarPlaceholder', {
          envVar: 'GEMINI_API_BASE_URL',
        })}
      />
      <Slider label={t('gemini.thinkingBudget')} value={thinkingBudget ?? 0} min={0} max={24576} onChange={handleThinkingBudgetChange} />
      <div className="flex items-center space-x-2">
        <Checkbox
          label={<span className="text-sm">{t('gemini.includeThoughts')}</span>}
          checked={includeThoughts ?? false}
          onChange={handleIncludeThoughtsChange}
        />
        <InfoIcon tooltip={t('gemini.includeThoughtsTooltip')} />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          label={<span className="text-sm">{t('gemini.useSearchGrounding')}</span>}
          checked={useSearchGrounding ?? false}
          onChange={handleUseSearchGroundingChange}
        />
        <InfoIcon tooltip={t('gemini.useSearchGroundingTooltip')} />
      </div>
    </div>
  );
};
