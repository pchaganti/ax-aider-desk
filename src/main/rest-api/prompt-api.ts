import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { ProjectManager } from '@/project';

const RunPromptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  editFormat: z.enum(['code', 'ask', 'architect', 'context']).optional(),
});

export class PromptApi extends BaseApi {
  private isPromptRunning = false;

  constructor(private readonly projectManager: ProjectManager) {
    super();
  }

  registerRoutes(router: Router): void {
    router.post(
      '/run-prompt',
      this.handleRequest(async (req, res) => {
        const result = RunPromptSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, prompt, editFormat } = result.data;

        // Check if another prompt is already running
        if (this.isPromptRunning) {
          res.status(429).json({
            error: 'Too many requests',
            message: 'Another prompt is already being processed',
          });
          return;
        }

        const project = this.projectManager.getProject(projectDir);
        const validatedProject = this.findProject(project, projectDir, res);
        if (!validatedProject) {
          return;
        }

        try {
          this.isPromptRunning = true;

          const responses = await validatedProject.sendPrompt(prompt, undefined, editFormat);

          res.status(200).json(responses);
        } finally {
          // Clear the running flag even if there's an error
          this.isPromptRunning = false;
        }
      }),
    );
  }
}
