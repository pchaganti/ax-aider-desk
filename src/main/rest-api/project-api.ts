import { Router } from 'express';
import { z } from 'zod';
import { StartupMode } from '@common/types';

import { BaseApi } from './base-api';

import { ProjectManager } from '@/project';
import { Store } from '@/store';

const RestartProjectSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  startupMode: z.enum(['ask', 'architect', 'context']).optional(),
});

const GetProjectSettingsSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const ProjectSettingsPatchSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  // Other fields are optional as it's Partial<ProjectSettings>
});

const InterruptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const ClearContextSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const AnswerQuestionSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  answer: z.string().min(1, 'Answer is required'),
});

export class ProjectApi extends BaseApi {
  constructor(
    private readonly projectManager: ProjectManager,
    private readonly store: Store,
  ) {
    super();
  }

  registerRoutes(router: Router): void {
    // Get projects
    router.get(
      '/projects',
      this.handleRequest(async (_, res) => {
        const projects = this.store.getOpenProjects();
        res.status(200).json(projects);
      }),
    );

    // Restart project
    router.post(
      '/project/restart',
      this.handleRequest(async (req, res) => {
        const result = RestartProjectSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, startupMode } = result.data;
        await this.projectManager.restartProject(projectDir, startupMode as StartupMode);
        res.status(200).json({ message: 'Project restarted' });
      }),
    );

    // Get project settings
    router.get(
      '/project/settings',
      this.handleRequest(async (req, res) => {
        const result = GetProjectSettingsSchema.safeParse(req.query);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir } = result.data;
        const projectSettings = this.store.getProjectSettings(projectDir);
        res.status(200).json(projectSettings);
      }),
    );

    // Update project settings
    router.patch(
      '/project/settings',
      this.handleRequest(async (req, res) => {
        const result = ProjectSettingsPatchSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, ...settings } = result.data;
        const projectSettings = this.store.getProjectSettings(projectDir);
        const updatedSettings = { ...projectSettings, ...settings };
        this.store.saveProjectSettings(projectDir, updatedSettings);
        res.status(200).json(updatedSettings);
      }),
    );

    // Interrupt project
    router.post(
      '/project/interrupt',
      this.handleRequest(async (req, res) => {
        const result = InterruptSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir } = result.data;
        const project = this.projectManager.getProject(projectDir);
        const validatedProject = this.findProject(project, projectDir, res);
        if (validatedProject) {
          validatedProject.interruptResponse();
          res.status(200).json({ message: 'Interrupt signal sent' });
        }
      }),
    );

    // Clear project context
    router.post(
      '/project/clear-context',
      this.handleRequest(async (req, res) => {
        const result = ClearContextSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir } = result.data;
        const project = this.projectManager.getProject(projectDir);
        const validatedProject = this.findProject(project, projectDir, res);
        if (validatedProject) {
          validatedProject.clearContext(true);
          res.status(200).json({ message: 'Context cleared' });
        }
      }),
    );

    // Answer project question
    router.post(
      '/project/question/answer',
      this.handleRequest(async (req, res) => {
        const result = AnswerQuestionSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, answer } = result.data;
        const project = this.projectManager.getProject(projectDir);
        const validatedProject = this.findProject(project, projectDir, res);
        if (validatedProject) {
          validatedProject.answerQuestion(answer);
          res.status(200).json({ message: 'Answer submitted' });
        }
      }),
    );
  }
}
