import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { ProjectManager } from '@/project';

const GetCustomCommandsSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const RunCustomCommandSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  commandName: z.string().min(1, 'Command name is required'),
  args: z.array(z.string()),
  mode: z.enum(['code', 'ask', 'architect', 'context']),
});

export class CommandsApi extends BaseApi {
  constructor(private readonly projectManager: ProjectManager) {
    super();
  }

  registerRoutes(router: Router): void {
    // Get custom commands
    router.get(
      '/project/custom-commands',
      this.handleRequest(async (req, res) => {
        const result = GetCustomCommandsSchema.safeParse(req.query);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir } = result.data;
        const commands = await this.projectManager.getCustomCommands(projectDir);
        res.status(200).json(commands);
      }),
    );

    // Run custom command
    router.post(
      '/project/custom-commands',
      this.handleRequest(async (req, res) => {
        const result = RunCustomCommandSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, commandName, args, mode } = result.data;
        const project = this.projectManager.getProject(projectDir);
        const validatedProject = this.findProject(project, projectDir, res);
        if (validatedProject) {
          await validatedProject.runCustomCommand(commandName, args, mode);
          res.status(200).json({ message: 'Custom command executed' });
        }
      }),
    );
  }
}
