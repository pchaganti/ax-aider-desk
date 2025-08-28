import { Router } from 'express';
import { z } from 'zod';
import { SettingsData } from '@common/types';

import { BaseApi } from './base-api';

import { McpManager } from '@/agent';
import { ModelInfoManager } from '@/models';
import { Store } from '@/store';

const SettingsDataSchema = z.any(); // Placeholder - can be refined based on SettingsData type

export class SettingsApi extends BaseApi {
  constructor(
    private readonly store: Store,
    private readonly modelInfoManager: ModelInfoManager,
    private readonly mcpManager: McpManager,
  ) {
    super();
  }

  registerRoutes(router: Router): void {
    // Get settings
    router.get(
      '/settings',
      this.handleRequest(async (_, res) => {
        const settings = this.store.getSettings();
        res.status(200).json(settings);
      }),
    );

    // Update settings
    router.post(
      '/settings',
      this.handleRequest(async (req, res) => {
        const result = SettingsDataSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const newSettings = result.data as SettingsData;
        const oldSettings = this.store.getSettings();
        this.store.saveSettings(newSettings);

        this.mcpManager.settingsChanged(oldSettings, newSettings);
        // Note: agent and telemetryManager are not available here, as per original code

        res.status(200).json(this.store.getSettings());
      }),
    );

    // Get models
    router.get(
      '/models',
      this.handleRequest(async (_, res) => {
        const modelsInfo = await this.modelInfoManager.getAllModelsInfo();
        res.status(200).json(modelsInfo);
      }),
    );
  }
}
