import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenAiCompatibleProvider } from '@common/agent';

import { ProviderModels } from './ProviderModels';

import { Input } from '@/components/common/Input';

type Props = {
  provider: OpenAiCompatibleProvider;
  onChange: (updated: OpenAiCompatibleProvider) => void;
};

export const OpenAiCompatibleParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const baseUrl = provider.baseUrl || '';
  const apiKey = provider.apiKey || '';
  const models = provider.models || [];

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, baseUrl: e.target.value });
  };

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleModelsChange = (updatedModels: string[]) => {
    onChange({ ...provider, models: updatedModels });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-md font-medium uppercase mb-5">
        {t('providers.openai-compatible')} {t('settings.agent.providerSettings')}
      </h3>
      <Input label={t('openai.baseUrl')} type="text" value={baseUrl} onChange={handleBaseUrlChange} placeholder={t('openai.baseUrlPlaceholder')} />
      <Input
        label={t('openai.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={t('settings.agent.envVarPlaceholder', { envVar: 'OPENAI_API_KEY' })}
      />
      <ProviderModels models={models} onChange={handleModelsChange} />
    </div>
  );
};
