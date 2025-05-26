import { forwardRef, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdEdit, MdKeyboardArrowUp } from 'react-icons/md';
import { AVAILABLE_PROVIDERS, isOllamaProvider, PROVIDER_MODELS } from '@common/agent';
import { AgentProfile, SettingsData } from '@common/types';

import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { IconButton } from '@/components/common/IconButton';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useBooleanState } from '@/hooks/useBooleanState';
import { useOllamaModels } from '@/hooks/useOllamaModels';
import { useSettings } from '@/context/SettingsContext';
import { useProjectSettings } from '@/context/ProjectSettingsContext';

type Props = Record<string, never>;

export const AgentModelSelector = forwardRef<HTMLDivElement, Props>((_props, _ref) => {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const { projectSettings } = useProjectSettings();
  const [highlightedModelIndex, setHighlightedModelIndex] = useState(-1);
  const [visible, show, hide] = useBooleanState(false);
  const [settingsDialogVisible, showSettingsDialog, hideSettingsDialog] = useBooleanState(false);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const highlightedModelRef = useRef<HTMLDivElement>(null);

  useClickOutside(modelSelectorRef, hide);

  useEffect(() => {
    if (!visible) {
      setHighlightedModelIndex(-1);
    }
  }, [visible]);

  const activeAgentProfile = useMemo(() => {
    return settings?.agentProfiles.find((profile) => profile.id === projectSettings?.agentProfileId);
  }, [projectSettings?.agentProfileId, settings?.agentProfiles]);

  const ollamaBaseUrl = useMemo(() => {
    const ollamaProvider = settings?.llmProviders['ollama'];
    return ollamaProvider && isOllamaProvider(ollamaProvider) ? ollamaProvider.baseUrl : '';
  }, [settings?.llmProviders]);

  const ollamaModels = useOllamaModels(ollamaBaseUrl);

  const agentModels = useMemo(() => {
    const models: string[] = [];
    AVAILABLE_PROVIDERS.forEach((provider) => {
      switch (provider) {
        case 'ollama':
          if (ollamaModels.length > 0) {
            models.push(...ollamaModels.map((model) => `ollama/${model}`));
          }
          break;
        case 'openrouter':
        case 'openai-compatible': {
          const providerModel = settings?.llmProviders[provider]?.model;
          if (providerModel) {
            models.push(`${provider}/${providerModel}`);
          }
          break;
        }
        default:
          models.push(...Object.keys(PROVIDER_MODELS[provider]?.models || {}).map((model) => `${provider}/${model}`));
          // For any other provider, we assume it has a known set of models
          break;
      }
    });
    // Add the currently selected model if it's not in the known list (custom model)
    if (activeAgentProfile && !models.some((model) => model === `${activeAgentProfile.provider}/${activeAgentProfile.model}`)) {
      const currentSelection = `${activeAgentProfile.provider}/${activeAgentProfile.model}`;
      if (!models.includes(currentSelection)) {
        models.unshift(currentSelection); // Add to the beginning for visibility
      }
    }
    return models;
  }, [activeAgentProfile, ollamaModels, settings?.llmProviders]);

  const selectedModelDisplay = activeAgentProfile ? `${activeAgentProfile.provider}/${activeAgentProfile.model}` : t('common.notSet');

  const toggleVisible = useCallback(() => {
    if (visible) {
      hide();
    } else {
      show();
    }
  }, [visible, hide, show]);

  const onModelSelected = useCallback(
    (selectedModelString: string) => {
      if (!settings) {
        return;
      }

      const [providerName, ...modelNameParts] = selectedModelString.split('/');
      const modelName = modelNameParts.join('/');
      if (!providerName || !modelName) {
        // eslint-disable-next-line no-console
        console.error('Invalid model string format:', selectedModelString);
        return; // Invalid format
      }

      const updatedProfiles = settings?.agentProfiles.map((profile) => {
        if (profile.id === activeAgentProfile?.id) {
          return {
            ...profile,
            model: modelName,
            provider: providerName,
          } as AgentProfile;
        }
        return profile;
      });

      const updatedSettings: SettingsData = {
        ...settings,
        agentProfiles: updatedProfiles || [],
      };
      void saveSettings(updatedSettings);
      hide();
    },
    [settings, saveSettings, hide, activeAgentProfile?.id],
  );

  const onModelSelectorKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedModelIndex((prev) => {
          const newIndex = Math.min(prev + 1, agentModels.length - 1);
          setTimeout(
            () =>
              highlightedModelRef.current?.scrollIntoView({
                block: 'nearest',
              }),
            0,
          );
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedModelIndex((prev) => {
          const newIndex = Math.max(prev - 1, 0);
          setTimeout(
            () =>
              highlightedModelRef.current?.scrollIntoView({
                block: 'nearest',
              }),
            0,
          );
          return newIndex;
        });
        break;
      case 'Enter':
        if (highlightedModelIndex !== -1) {
          e.preventDefault();
          const selected = agentModels[highlightedModelIndex];
          onModelSelected(selected);
        }
        break;
      case 'Escape':
        e.preventDefault();
        hide();
        break;
    }
  };

  const renderModelItem = (modelString: string, index: number) => {
    const isSelected = modelString === selectedModelDisplay;
    return (
      <div
        key={modelString}
        ref={index === highlightedModelIndex ? highlightedModelRef : undefined}
        className={`flex items-center w-full hover:bg-neutral-700 transition-colors duration-200 ${index === highlightedModelIndex ? 'bg-neutral-700' : 'text-neutral-300'}`}
      >
        <button
          onClick={() => onModelSelected(modelString)}
          className={`flex-grow px-3 py-1 text-left text-xs
                        ${isSelected ? 'text-white font-bold' : ''}`}
        >
          {modelString}
        </button>
      </div>
    );
  };

  if (!activeAgentProfile) {
    return <div className="text-xs text-neutral-400">{t('modelSelector.noActiveAgentProvider')}</div>;
  }

  return (
    <>
      <div className="relative flex items-center space-x-1" ref={modelSelectorRef}>
        <button onClick={toggleVisible} className="flex items-center hover:text-neutral-300 focus:outline-none transition-colors duration-200 text-xs">
          <span>{selectedModelDisplay}</span>
          <MdKeyboardArrowUp className={`w-3 h-3 ml-1 transform transition-transform ${visible ? '' : 'rotate-180'}`} />
        </button>
        <IconButton icon={<MdEdit className="w-4 h-4" />} onClick={showSettingsDialog} className="p-0.5 hover:bg-neutral-700 rounded-md" />
        {visible && agentModels.length > 0 && (
          <div
            className="absolute top-full left-[-5px] mt-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg z-10 flex flex-col w-auto min-w-[500px]"
            onKeyDown={onModelSelectorKeyDown}
            tabIndex={-1} // Make the div focusable for keydown events
          >
            <div className="overflow-y-auto scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 max-h-48">
              {agentModels.map(renderModelItem)}
            </div>
          </div>
        )}
      </div>
      {settingsDialogVisible && <SettingsDialog onClose={hideSettingsDialog} initialTab={2} />}
    </>
  );
});

AgentModelSelector.displayName = 'AgentModelSelector';
