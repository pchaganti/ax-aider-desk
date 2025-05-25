import fs from 'fs/promises';
import path from 'path';

import { tool } from 'ai';
import { z } from 'zod';
import {
  TOOL_GROUP_NAME_SEPARATOR,
  AIDER_TOOL_GROUP_NAME as TOOL_GROUP_NAME,
  AIDER_TOOL_GET_CONTEXT_FILES as TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_ADD_CONTEXT_FILE as TOOL_ADD_CONTEXT_FILE,
  AIDER_TOOL_DROP_CONTEXT_FILE as TOOL_DROP_CONTEXT_FILE,
  AIDER_TOOL_RUN_PROMPT as TOOL_RUN_PROMPT,
  AIDER_TOOL_DESCRIPTIONS,
} from '@common/tools';
import { AgentProfile, ToolApprovalState } from '@common/types';

import { Project } from '../../project';

import { ApprovalManager } from './approval-manager';

import type { ToolSet } from 'ai';

export const createAiderToolset = (project: Project, profile: AgentProfile): ToolSet => {
  const approvalManager = new ApprovalManager(project, profile);

  const getContextFilesTool = tool({
    description: AIDER_TOOL_DESCRIPTIONS[TOOL_GET_CONTEXT_FILES],
    parameters: z.object({
      projectDir: z.string().describe("The project directory. Can be '.' for current project."),
    }),
    execute: async ({ projectDir }, { toolCallId }) => {
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_GET_CONTEXT_FILES, {
        projectDir,
      });

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GET_CONTEXT_FILES}`;
      const questionText = 'Approve getting context files?';

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `Getting context files denied by user. Reason: ${userInput}`;
      }

      const files = project.getContextFiles();
      return JSON.stringify(files);
    },
  });

  const addContextFileTool = tool({
    description: AIDER_TOOL_DESCRIPTIONS[TOOL_ADD_CONTEXT_FILE],
    parameters: z.object({
      path: z.string().describe('File path to add to context. Relative to project directory when not read-only. Absolute path should be used when read-only.'),
      readOnly: z.boolean().optional().describe('Whether the file is read-only'),
    }),
    execute: async ({ path: relativePath, readOnly = false }, { toolCallId }) => {
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_ADD_CONTEXT_FILE, {
        path: relativePath,
        readOnly,
      });

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_ADD_CONTEXT_FILE}`;
      const questionText = `Approve adding file '${path}' to context?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `Adding file '${path}' to context denied by user. Reason: ${userInput}`;
      }

      const absolutePath = path.resolve(project.baseDir, relativePath);
      let fileExists = false;
      try {
        await fs.access(absolutePath);
        fileExists = true;
      } catch {
        // File does not exist
        fileExists = false;
      }

      if (!fileExists) {
        // Ask user if they want to create the file
        const questionKey = 'tool_aider_add_context_file_create_file';
        const questionText = `File '${relativePath}' does not exist. Create it?`;

        const [isApproved] = await approvalManager.handleApproval(questionKey, questionText);

        if (isApproved) {
          try {
            // Create directories if they don't exist
            const dir = path.dirname(absolutePath);
            await fs.mkdir(dir, { recursive: true });
            // Create an empty file
            await fs.writeFile(absolutePath, '');
            project.addLogMessage('info', `Created new file: ${relativePath}`);
            fileExists = true; // File now exists

            try {
              // Add the new file to git staging
              await project.git.add(absolutePath);
            } catch (gitError) {
              const gitErrorMessage = gitError instanceof Error ? gitError.message : String(gitError);
              project.addLogMessage('warning', `Failed to add new file ${relativePath} to git staging area: ${gitErrorMessage}`);
              // Continue even if git add fails, as the file was created successfully
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            project.addLogMessage('error', `Failed to create file '${relativePath}': ${errorMessage}`);
            return `Error: Failed to create file '${relativePath}'. It was not added to the context.`;
          }
        } else {
          return `File '${relativePath}' not created by user. It was not added to the context.`;
        }
      }

      if (fileExists) {
        const added = await project.addFile({
          path: relativePath,
          readOnly,
        });
        return added ? `Added file: ${relativePath}` : `Not added - file '${relativePath}' was already in the context.`;
      } else {
        return `File '${relativePath}' does not exist and was not created. It was not added to the context.`;
      }
    },
  });

  const dropContextFileTool = tool({
    description: AIDER_TOOL_DESCRIPTIONS[TOOL_DROP_CONTEXT_FILE],
    parameters: z.object({
      path: z.string().describe('File path to remove from context.'),
    }),
    execute: async ({ path }, { toolCallId }) => {
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_DROP_CONTEXT_FILE, { path });

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_DROP_CONTEXT_FILE}`;
      const questionText = `Approve dropping file '${path}' from context?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `Dropping file '${path}' from context denied by user. Reason: ${userInput}`;
      }

      project.dropFile(path);
      return `Dropped file: ${path}`;
    },
  });

  const runPromptTool = tool({
    description: AIDER_TOOL_DESCRIPTIONS[TOOL_RUN_PROMPT],
    parameters: z.object({
      prompt: z.string().describe('The prompt to run in natural language.'),
    }),
    execute: async ({ prompt }, { toolCallId }) => {
      project.addToolMessage(toolCallId, 'aider', 'run_prompt', { prompt });

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_RUN_PROMPT}`;
      const questionText = 'Approve prompt to run in Aider?';

      // Ask the question and wait for the answer
      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText, prompt);

      if (!isApproved) {
        return {
          responses: [],
          updatedFiles: [],
          deniedReason: userInput,
          error: 'Aider prompt execution denied by user. Update the prompt based on the denied reason or cancel and do not run again.',
        };
      }

      const responses = await project.sendPrompt(prompt, 'code', true);

      // Notify that we are still processing after aider finishes
      project.addLogMessage('loading');

      return {
        responses: responses.map((response) => ({
          messageId: response.messageId,
          content: response.content.trim(),
          reflectedMessage: response.reflectedMessage,
        })),
        updatedFiles: responses.flatMap((response) => response.editedFiles || []).filter((value, index, self) => self.indexOf(value) === index), // Unique files
      };
    },
  });

  const allTools = {
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GET_CONTEXT_FILES}`]: getContextFilesTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_ADD_CONTEXT_FILE}`]: addContextFileTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_DROP_CONTEXT_FILE}`]: dropContextFileTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_RUN_PROMPT}`]: runPromptTool,
  };

  // Filter out tools that are set to Never in toolApprovals
  const filteredTools: ToolSet = {};
  for (const [toolId, tool] of Object.entries(allTools)) {
    if (profile.toolApprovals[toolId] !== ToolApprovalState.Never) {
      filteredTools[toolId] = tool;
    }
  }

  return filteredTools;
};
