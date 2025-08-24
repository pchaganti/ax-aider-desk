import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenAiProvider } from '@common/agent';
import { ReasoningEffort } from '@common/types';

import { Input } from '@/components/common/Input';
import { Select, Option } from '@/components/common/Select';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: OpenAiProvider;
  onChange: (updated: OpenAiProvider) => void;
};

export const OpenAiParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';
  const reasoningEffort = provider.reasoningEffort || ReasoningEffort.Medium;

  const reasoningOptions: Option[] = [
    { value: ReasoningEffort.Minimal, label: t('openai.reasoningEffortMinimal') },
    { value: ReasoningEffort.Low, label: t('openai.reasoningEffortLow') },
    { value: ReasoningEffort.Medium, label: t('openai.reasoningEffortMedium') },
    { value: ReasoningEffort.High, label: t('openai.reasoningEffortHigh') },
  ];

  const { environmentVariable: openAiApiKeyEnv } = useEffectiveEnvironmentVariable('OPENAI_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleReasoningEffortChange = (value: string) => {
    onChange({ ...provider, reasoningEffort: value as ReasoningEffort });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('openai.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          openAiApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: openAiApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'OPENAI_API_KEY',
              })
        }
      />

      <div className="grid grid-cols-2 gap-x-10">
        <Select label={t('openai.reasoningEffort')} value={reasoningEffort} onChange={handleReasoningEffortChange} options={reasoningOptions} />
      </div>
    </div>
  );
};
