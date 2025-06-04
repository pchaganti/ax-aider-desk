import { useCallback, useState } from 'react';
import { HiArrowRight } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useSettings } from '@/context/SettingsContext';
import { AiderSettings } from '@/components/settings/AiderSettings';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { Button } from '@/components/common/Button';

export const Onboarding = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, saveSettings } = useSettings();
  const [step, setStep] = useState(1);

  const handleNext = async () => {
    if (step === 2) {
      await saveSettings({
        ...settings!,
        onboardingFinished: true,
      });
      navigate('/home');
    } else {
      setStep(step + 1);
    }
  };

  const handleLanguageChange = useCallback(
    async (language: string) => {
      await saveSettings({
        ...settings!,
        language,
      });
    },
    [saveSettings, settings],
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex flex-col space-y-4 relative">
            <h1 className="text-xl font-bold text-neutral-100 uppercase">{t('onboarding.title')}</h1>
            <p className="text-neutral-300 text-sm">{t('onboarding.description')}</p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 text-sm">
              <li>{t('onboarding.features.1')}</li>
              <li>{t('onboarding.features.2')}</li>
              <li>{t('onboarding.features.3')}</li>
              <li>{t('onboarding.features.4')}</li>
              <li>{t('onboarding.features.5')}</li>
            </ul>
            <p className="text-neutral-300 text-sm">{t('onboarding.getStarted')}</p>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-neutral-100 uppercase">{t('onboarding.aider.title')}</h2>
            <p className="text-neutral-300 text-sm">{t('onboarding.aider.description')}</p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 text-xs">
              <li>{t('onboarding.aider.options.1')}</li>
              <li>{t('onboarding.aider.options.2')}</li>
              <li>{t('onboarding.aider.options.3')}</li>
            </ul>
            <p className="text-neutral-300 text-sm">{t('onboarding.aider.configureLater')}</p>
            <AiderSettings settings={settings!} setSettings={saveSettings} initialShowEnvVars={true} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen p-[4px] bg-neutral-850 overflow-y-auto scrollbar-thin scrollbar-track-neutral-850 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600">
      <div className="flex flex-col flex-1 border-2 border-neutral-600 relative">
        {step === 1 && (
          <div className="absolute top-5 right-5 w-[200px]">
            <LanguageSelector language={settings?.language || 'en'} onChange={handleLanguageChange} hideLabel />
          </div>
        )}
        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <div className="max-w-2xl w-full">
            {renderStep()}
            <div className="mt-10 flex justify-center">
              <Button onClick={handleNext} className="gap-2">
                {step === 2 ? t('onboarding.finish') : t('common.next')}
                <HiArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
