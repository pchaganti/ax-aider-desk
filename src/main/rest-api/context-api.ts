import { Router } from 'express';
import { z } from 'zod';
import { delay } from '@common/utils';

import { BaseApi } from './base-api';

import { ProjectManager } from '@/project';

const ContextFileSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  path: z.string().min(1, 'File path is required'),
  readOnly: z.boolean().optional(),
});

const GetContextFilesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const GetAddableFilesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  searchRegex: z.string().optional(),
});

export class ContextApi extends BaseApi {
  constructor(private readonly projectManager: ProjectManager) {
    super();
  }

  registerRoutes(router: Router): void {
    // Add context file
    router.post(
      '/add-context-file',
      this.handleRequest(async (req, res) => {
        const result = ContextFileSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, path, readOnly } = result.data;
        const project = this.projectManager.getProject(projectDir);
        const validatedProject = this.findProject(project, projectDir, res);
        if (!validatedProject) {
          return;
        }

        await validatedProject.addFile({ path, readOnly });

        // add delay to allow Aider to verify the added files
        await delay(1000);

        const contextFiles = validatedProject.getContextFiles();
        res.status(200).json(contextFiles);
      }),
    );

    // Drop context file
    router.post(
      '/drop-context-file',
      this.handleRequest(async (req, res) => {
        const result = ContextFileSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, path } = result.data;
        const project = this.projectManager.getProject(projectDir);
        const validatedProject = this.findProject(project, projectDir, res);
        if (!validatedProject) {
          return;
        }

        validatedProject.dropFile(path);

        // add delay to allow Aider to verify the dropped files
        await delay(1000);

        const contextFiles = validatedProject.getContextFiles();
        res.status(200).json(contextFiles);
      }),
    );

    // Get context files
    router.post(
      '/get-context-files',
      this.handleRequest(async (req, res) => {
        const result = GetContextFilesSchema.safeParse(req.body);
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
        if (!validatedProject) {
          return;
        }

        const contextFiles = validatedProject.getContextFiles();
        res.status(200).json(contextFiles);
      }),
    );

    // Get addable files
    router.post(
      '/get-addable-files',
      this.handleRequest(async (req, res) => {
        const result = GetAddableFilesSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, searchRegex } = result.data;
        const project = this.projectManager.getProject(projectDir);
        const validatedProject = this.findProject(project, projectDir, res);
        if (!validatedProject) {
          return;
        }

        const addableFiles = validatedProject.getAddableFiles(searchRegex);
        res.status(200).json(addableFiles);
      }),
    );
  }
}
