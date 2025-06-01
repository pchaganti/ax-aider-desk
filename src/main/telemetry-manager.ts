import { PostHog } from 'posthog-node';
import { POSTHOG_PUBLIC_API_KEY, POSTHOG_HOST } from 'src/main/constants';
import { AgentProfile, Mode, SettingsData } from '@common/types';
import { app } from 'electron';

import { Store } from './store';
import logger from './logger';

export class TelemetryManager {
  private client?: PostHog;
  private store: Store;
  private distinctId: string;

  constructor(store: Store) {
    this.store = store;
    this.distinctId = store.getUserId();
  }

  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    if (oldSettings.telemetryEnabled !== newSettings.telemetryEnabled) {
      if (newSettings.telemetryEnabled && !this.client) {
        void this.init();
      } else if (!newSettings.telemetryEnabled && this.client) {
        this.client.capture({
          distinctId: this.distinctId,
          event: 'telemetry-disabled',
        });
        void this.destroy();
      }
    }
  }

  async init(): Promise<void> {
    if (!this.store.getSettings().telemetryEnabled) {
      logger.info('Telemetry is disabled or PostHog settings are not configured.');
      return;
    }

    this.client = new PostHog(POSTHOG_PUBLIC_API_KEY, {
      host: POSTHOG_HOST,
    });
    logger.info('TelemetryManager initialized for PostHog.');
    this.client.identify({
      distinctId: this.distinctId,
      properties: {
        os: process.platform,
        version: app.getVersion(),
      },
    });
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
      logger.info('TelemetryManager destroyed.');
    }
  }

  captureProjectOpened(openedProjectsCount: number) {
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'project-opened',
      properties: {
        count: openedProjectsCount,
      },
    });
  }

  captureProjectClosed(closedProjectsCount: number) {
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'project-closed',
      properties: {
        count: closedProjectsCount,
      },
    });
  }

  captureRunPrompt(mode?: Mode) {
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'run-prompt',
      properties: {
        mode,
      },
    });
  }

  captureAgentRun(profile: AgentProfile) {
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'agent-run',
      properties: {
        maxIterations: profile.maxIterations,
        maxTokens: profile.maxTokens,
        customInstructionsDefined: profile.customInstructions.trim().length > 0,
        useAiderTools: profile.useAiderTools,
        usePowerTools: profile.usePowerTools,
        includeContextFiles: profile.includeContextFiles,
        includeRepoMap: profile.includeRepoMap,
        autoApprove: profile.autoApprove,
        enabledMcpServersCount: profile.enabledServers.length,
        totalMcpServersCount: Object.keys(this.store.getSettings().mcpServers).length,
      },
    });
  }
}
