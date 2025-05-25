import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GeminiProvider } from '@common/agent';

import { Input } from '@/components/common/Input';

type Props = {
  provider: GeminiProvider;
  onChange: (updated: GeminiProvider) => void;
};

export const GeminiParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey;

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="mt-2 space-y-2">
      <Input
        label={t('gemini.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={t('settings.agent.envVarPlaceholder', {
          envVar: 'GEMINI_API_KEY',
        })}
      />
    </div>
  );
};
