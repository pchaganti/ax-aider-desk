import { Server } from 'http';

import express from 'express';
import cors from 'cors';

import { ContextApi } from './context-api';
import { PromptApi } from './prompt-api';
import { SettingsApi } from './settings-api';
import { ProjectApi } from './project-api';
import { CommandsApi } from './commands-api';

import { SERVER_PORT } from '@/constants';
import logger from '@/logger';
import { McpManager } from '@/agent';
import { ModelInfoManager } from '@/models';
import { ProjectManager } from '@/project';
import { Store } from '@/store';

// Import API modules

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class RestApiController {
  private app = express();

  constructor(
    private readonly projectManager: ProjectManager,
    private readonly server: Server,
    private readonly store: Store,
    private readonly modelInfoManager: ModelInfoManager,
    private readonly mcpManager: McpManager,
  ) {
    // Configure Express
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(cors());

    // Set timeout for all requests
    this.app.use((req, res, next) => {
      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        res.status(504).json({ error: 'Request timeout' });
      });
      res.setTimeout(REQUEST_TIMEOUT_MS, () => {
        res.status(504).json({ error: 'Response timeout' });
      });
      next();
    });

    this.init();
  }

  private setupRoutes(): void {
    // Create API router
    const apiRouter = express.Router();

    // Register all API modules
    new ContextApi(this.projectManager).registerRoutes(apiRouter);
    new PromptApi(this.projectManager).registerRoutes(apiRouter);
    new SettingsApi(this.store, this.modelInfoManager, this.mcpManager).registerRoutes(apiRouter);
    new ProjectApi(this.projectManager, this.store).registerRoutes(apiRouter);
    new CommandsApi(this.projectManager).registerRoutes(apiRouter);

    // Mount the API router globally under /api
    this.app.use('/api', apiRouter);
  }

  private init() {
    this.setupRoutes();

    // The server is already listening from the main process,
    // so we just need to attach our Express app to it
    this.server.on('request', this.app);

    logger.info(`REST API routes registered on port ${SERVER_PORT}`);
  }

  async close() {
    // nothing for now
  }
}
