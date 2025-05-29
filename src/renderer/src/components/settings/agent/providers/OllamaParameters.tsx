import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OllamaProvider } from '@common/agent';

import { Input } from '@/components/common/Input';

type Props = {
  provider: OllamaProvider;
  onChange: (updated: OllamaProvider) => void;
};

export const OllamaParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const baseUrl = provider.baseUrl || '';

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, baseUrl: e.target.value });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-md font-medium uppercase mb-5">
        {t('providers.ollama')} {t('settings.agent.providerSettings')}
      </h3>
      <Input label={t('ollama.baseUrl')} type="text" value={baseUrl} onChange={handleBaseUrlChange} placeholder={t('ollama.baseUrlPlaceholder')} />
    </div>
  );
};
