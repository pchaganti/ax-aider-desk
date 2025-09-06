import { ChangeEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsData } from '@common/types';
import { clsx } from 'clsx';

import { Input } from '../common/Input';
import { Section } from '../common/Section';
import { Button } from '../common/Button';
import { Checkbox } from '../common/Checkbox';

import { useApi } from '@/context/ApiContext';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const ServerSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [operation, setOperation] = useState<'starting' | 'stopping' | null>(null);

  const isServerRunning = settings.server.enabled;

  const handleServerToggle = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    const isStarting = !isServerRunning;
    setOperation(isStarting ? 'starting' : 'stopping');

    try {
      let success: boolean;

      if (isStarting) {
        // Start server with current credentials if basic auth is enabled
        const username = settings.server.basicAuth.enabled ? settings.server.basicAuth.username : undefined;
        const password = settings.server.basicAuth.enabled ? settings.server.basicAuth.password : undefined;
        success = await api.startServer(username, password);
      } else {
        // Stop server
        success = await api.stopServer();
      }

      if (success) {
        // Update settings to reflect the new server state
        setSettings({
          ...settings,
          server: {
            ...settings.server,
            enabled: isStarting,
          },
        });
      } else {
        // Handle failure (could add toast notification here)
      }
    } catch {
      // Handle error (could add toast notification here)
    } finally {
      setIsLoading(false);
      setOperation(null);
    }
  };

  const handleBasicAuthEnabledChange = (checked: boolean) => {
    setSettings({
      ...settings,
      server: {
        ...settings.server,
        basicAuth: {
          ...settings.server.basicAuth,
          enabled: checked,
        },
      },
    });
  };

  const handleUsernameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      server: {
        ...settings.server,
        basicAuth: {
          ...settings.server.basicAuth,
          username: e.target.value,
        },
      },
    });
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      server: {
        ...settings.server,
        basicAuth: {
          ...settings.server.basicAuth,
          password: e.target.value,
        },
      },
    });
  };

  const getButtonText = () => {
    if (operation === 'starting') {
      return t('settings.server.starting');
    }
    if (operation === 'stopping') {
      return t('settings.server.stopping');
    }
    return isServerRunning ? t('settings.server.stop') : t('settings.server.start');
  };

  return (
    <div className="space-y-3">
      <Section className="p-4">
        {/* Authentication Toggle */}
        <div>
          <Checkbox
            label={t('settings.server.enableBasicAuth')}
            checked={settings.server.basicAuth.enabled}
            onChange={handleBasicAuthEnabledChange}
            disabled={isServerRunning}
          />
          <p className="text-xs text-text-muted mt-2">{t('settings.server.enableBasicAuthDescription')}</p>
        </div>
        {/* Collapsible Authentication Inputs */}
        {settings.server.basicAuth.enabled && (
          <div className="grid grid-cols-2 gap-4 mt-3">
            <Input
              label={<div className="text-xs">{t('settings.server.username')}</div>}
              value={settings.server.basicAuth.username}
              onChange={handleUsernameChange}
              type="text"
              placeholder="admin"
            />
            <Input
              label={<div className="text-xs">{t('settings.server.password')}</div>}
              value={settings.server.basicAuth.password}
              onChange={handlePasswordChange}
              type="password"
              placeholder="password"
            />
          </div>
        )}
      </Section>

      <div className="p-4">
        {/* Centered Server Status and Control */}
        <div className="flex flex-col items-center space-y-2">
          <div className="p-3 bg-bg-secondary rounded-lg">
            <p className="text-sm text-text-muted">
              {t('settings.server.serverStatus')}:{' '}
              <span className={clsx('font-medium', isServerRunning ? 'text-success' : 'text-error')}>
                {isServerRunning ? t('settings.server.running') : t('settings.server.stopped')}
              </span>
            </p>
          </div>
          <Button variant="contained" onClick={handleServerToggle} disabled={isLoading}>
            {getButtonText()}
          </Button>
        </div>
      </div>
    </div>
  );
};
