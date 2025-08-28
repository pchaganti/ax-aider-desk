import { Request, Response, Router } from 'express';

import { Project } from '@/project';

export abstract class BaseApi {
  protected constructor() {}

  /**
   * Finds a project by directory path and validates it exists and is started
   * Returns null if project not found or not started, and sends appropriate error response
   */
  protected findProject(project: Project | undefined, projectDir: string, res: Response): Project | null {
    if (!project) {
      res.status(404).json({
        error: 'Project not found',
        message: `Project directory '${projectDir}' does not exist`,
      });
      return null;
    }

    if (!project.isStarted()) {
      res.status(403).json({
        error: 'Project not started',
        message: 'Please open the project in AiderDesk first',
      });
      return null;
    }

    return project;
  }

  /**
   * Generic request handler wrapper with consistent error handling
   */
  protected handleRequest<T>(handler: (req: Request, res: Response) => Promise<T>) {
    return async (req: Request, res: Response) => {
      try {
        await handler(req, res);
      } catch (error) {
        console.error('REST API: Error processing request', {
          error,
          path: req.path,
          method: req.method,
        });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };
  }

  /**
   * Abstract method for registering routes - each API module must implement this
   */
  abstract registerRoutes(router: Router): void;
}
