import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DeepseekProvider } from '@common/agent';

import { Input } from '@/components/common/Input';

type Props = {
  provider: DeepseekProvider;
  onChange: (updated: DeepseekProvider) => void;
};

export const DeepseekParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-md font-medium uppercase mb-5">
        {t('providers.deepseek')} {t('settings.agent.providerSettings')}
      </h3>
      <Input
        label={t('deepseek.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={t('settings.agent.envVarPlaceholder', {
          envVar: 'DEEPSEEK_API_KEY',
        })}
      />
    </div>
  );
};
