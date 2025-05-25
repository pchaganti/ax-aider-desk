import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenAiCompatibleProvider } from '@common/agent';

import { Input } from '@/components/common/Input';

type Props = {
  provider: OpenAiCompatibleProvider;
  onChange: (updated: OpenAiCompatibleProvider) => void;
};

export const OpenAiCompatibleParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const baseUrl = provider.baseUrl || '';
  const apiKey = provider.apiKey || '';
  const model = provider.model || '';

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, baseUrl: e.target.value });
  };

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleModelChange = (selectedModel: string) => {
    onChange({ ...provider, model: selectedModel });
  };

  return (
    <div className="mt-2 space-y-2">
      <Input label={t('openai.baseUrl')} type="text" value={baseUrl} onChange={handleBaseUrlChange} placeholder={t('openai.baseUrlPlaceholder')} />
      <Input
        label={t('openai.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={t('settings.agent.envVarPlaceholder', { envVar: 'OPENAI_API_KEY' })}
      />
      <Input label={t('model.label')} type="text" value={model} onChange={(e) => handleModelChange(e.target.value)} placeholder={t('model.placeholder')} />
    </div>
  );
};
