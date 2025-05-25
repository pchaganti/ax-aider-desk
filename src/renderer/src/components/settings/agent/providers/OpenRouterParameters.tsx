import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenRouterProvider } from '@common/agent';

import { Input } from '@/components/common/Input';

type Props = {
  provider: OpenRouterProvider;
  onChange: (updated: OpenRouterProvider) => void;
};

export const OpenRouterParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';
  const model = provider.model || '';

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleModelChange = (selectedModel: string) => {
    onChange({ ...provider, model: selectedModel });
  };

  return (
    <div className="mt-2 space-y-2">
      <Input
        label={t('openrouter.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={t('settings.agent.envVarPlaceholder', { envVar: 'OPENROUTER_API_KEY' })}
      />
      <Input
        label={t('model.label')}
        type="text"
        value={model}
        onChange={(e) => handleModelChange(e.target.value)}
        placeholder={t('openrouter.modelPlaceholder')}
      />
    </div>
  );
};
