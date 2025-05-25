import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { glob } from 'glob';
import { searchTool } from '@buger/probe';
import { AgentProfile, FileWriteMode, ToolApprovalState } from '@common/types';
import {
  TOOL_GROUP_NAME_SEPARATOR,
  POWER_TOOL_GROUP_NAME as TOOL_GROUP_NAME,
  POWER_TOOL_FILE_EDIT as TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ as TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE as TOOL_FILE_WRITE,
  POWER_TOOL_GLOB as TOOL_GLOB,
  POWER_TOOL_GREP as TOOL_GREP,
  POWER_TOOL_SEMANTIC_SEARCH as TOOL_SEMANTIC_SEARCH,
  POWER_TOOL_BASH as TOOL_BASH,
  POWER_TOOL_DESCRIPTIONS,
} from '@common/tools';

import { Project } from '../../project';

import { ApprovalManager } from './approval-manager';

const execAsync = promisify(exec);

export const createPowerToolset = (project: Project, profile: AgentProfile): ToolSet => {
  const approvalManager = new ApprovalManager(project, profile);

  const fileEditTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_FILE_EDIT],
    parameters: z.object({
      filePath: z.string().describe('The path to the file to be edited (relative to the project root).'),
      searchTerm: z
        .string()
        .describe('The string or regular expression to find in the file. When editing a code, make sure you use multiple lines in the search if possible.'),
      replacementText: z.string().describe('The string to replace the searchTerm with.'),
      isRegex: z.boolean().optional().default(false).describe('Whether the searchTerm should be treated as a regular expression. Default: false.'),
      replaceAll: z.boolean().optional().default(false).describe('Whether to replace all occurrences or just the first one. Default: false.'),
    }),
    execute: async (args, { toolCallId }) => {
      const { filePath, searchTerm, replacementText, isRegex, replaceAll } = args;
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_FILE_EDIT, args);

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_EDIT}`;
      const questionText = `Approve editing file '${filePath}'?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `File edit to '${filePath}' denied by user. Reason: ${userInput}`;
      }

      const absolutePath = path.resolve(project.baseDir, filePath);
      try {
        const fileContent = await fs.readFile(absolutePath, 'utf8');
        let modifiedContent: string;

        if (isRegex) {
          const regex = new RegExp(searchTerm, replaceAll ? 'g' : '');
          modifiedContent = fileContent.replace(regex, replacementText);
        } else {
          if (replaceAll) {
            modifiedContent = fileContent.replaceAll(searchTerm, replacementText);
          } else {
            modifiedContent = fileContent.replace(searchTerm, replacementText);
          }
        }

        if (fileContent === modifiedContent) {
          return `Warning: Search term '${searchTerm}' did not result in changes in '${filePath}'. File content remains the same.`;
        }

        await fs.writeFile(absolutePath, modifiedContent, 'utf8');
        return `Successfully edited '${filePath}'.`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          return `Error: File '${filePath}' not found.`;
        }
        return `Error editing file '${filePath}': ${errorMessage}`;
      }
    },
  });

  const fileReadTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_FILE_READ],
    parameters: z.object({
      filePath: z.string().describe('The path to the file to be read (relative to the project root).'),
    }),
    execute: async ({ filePath }, { toolCallId }) => {
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_FILE_READ, { filePath });

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_READ}`;
      const questionText = `Approve reading file '${filePath}'?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `File read of '${filePath}' denied by user. Reason: ${userInput}`;
      }

      const absolutePath = path.resolve(project.baseDir, filePath);
      try {
        const content = await fs.readFile(absolutePath, 'utf8');
        return `Here is the most recent content of '${filePath}' (ignore previous versions):\n\n${content}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          return `Error: File '${filePath}' not found.`;
        }
        return `Error: Could not read file '${filePath}'. ${errorMessage}`;
      }
    },
  });

  const fileWriteTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_FILE_WRITE],
    parameters: z.object({
      filePath: z.string().describe('The path to the file to be written (relative to the project root).'),
      content: z.string().describe('The content to write to the file.'),
      mode: z
        .nativeEnum(FileWriteMode)
        .optional()
        .default(FileWriteMode.Overwrite)
        .describe(
          "Mode of writing: 'overwrite' (overwrites or creates), 'append' (appends or creates), 'create_only' (creates if not exists, fails if exists). Default: 'overwrite'.",
        ),
    }),
    execute: async ({ filePath, content, mode }, { toolCallId }) => {
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_FILE_WRITE, { filePath, content, mode });

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_WRITE}`;
      const questionText =
        mode === FileWriteMode.Overwrite
          ? `Approve overwriting or creating file '${filePath}'?`
          : mode === FileWriteMode.Append
            ? `Approve appending to file '${filePath}'?`
            : `Approve creating file '${filePath}'?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `File write to '${filePath}' denied by user. Reason: ${userInput}`;
      }

      const absolutePath = path.resolve(project.baseDir, filePath);

      const addToGit = async () => {
        try {
          // Add the new file to git staging
          await project.git.add(absolutePath);
        } catch (gitError) {
          const gitErrorMessage = gitError instanceof Error ? gitError.message : String(gitError);
          project.addLogMessage('warning', `Failed to add new file ${absolutePath} to git staging area: ${gitErrorMessage}`);
          // Continue even if git add fails, as the file was created successfully
        }
      };

      try {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });

        if (mode === FileWriteMode.CreateOnly) {
          try {
            await fs.writeFile(absolutePath, content, { flag: 'wx' });
            await addToGit();

            return `Successfully wrote to '${filePath}' (created).`;
          } catch (e) {
            if ((e as NodeJS.ErrnoException)?.code === 'EEXIST') {
              return `Error: File '${filePath}' already exists (mode: create_only).`;
            }
            throw e;
          }
        } else if (mode === FileWriteMode.Append) {
          await fs.appendFile(absolutePath, content, 'utf8');
          return `Successfully appended to '${filePath}'.`;
        } else {
          await fs.writeFile(absolutePath, content, 'utf8');
          await addToGit();
          return `Successfully wrote to '${filePath}' (overwritten/created).`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error writing to file '${filePath}': ${errorMessage}`;
      }
    },
  });

  const globTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_GLOB],
    parameters: z.object({
      pattern: z.string().describe('The glob pattern to search for (e.g., src/**/*.ts, *.md).'),
      cwd: z
        .string()
        .optional()
        .describe('The current working directory from which to apply the glob pattern (relative to project root). Default: project root.'),
      ignore: z.array(z.string()).optional().describe('An array of glob patterns to ignore.'),
    }),
    execute: async ({ pattern, cwd, ignore }, { toolCallId }) => {
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_GLOB, { pattern, cwd, ignore });

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GLOB}`;
      const questionText = `Approve glob search with pattern '${pattern}'?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `Glob search with pattern '${pattern}' denied by user. Reason: ${userInput}`;
      }

      const absoluteCwd = cwd ? path.resolve(project.baseDir, cwd) : project.baseDir;
      try {
        const files = await glob(pattern, {
          cwd: absoluteCwd,
          ignore: ignore,
          nodir: false,
          absolute: false, // Keep paths relative to cwd for easier processing
        });
        // Ensure paths are relative to project.baseDir
        return files.map((file) => path.relative(project.baseDir, path.resolve(absoluteCwd, file)));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error executing glob pattern '${pattern}': ${errorMessage}`;
      }
    },
  });

  const grepTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_GREP],
    parameters: z.object({
      filePattern: z.string().describe('A glob pattern specifying the files to search within (e.g., src/**/*.tsx, *.py).'),
      searchTerm: z.string().describe('The regular expression to search for within the files.'),
      contextLines: z
        .number()
        .int()
        .min(0)
        .optional()
        .default(0)
        .describe('The number of lines of context to show before and after each matching line. Default: 0.'),
      caseSensitive: z.boolean().optional().default(false).describe('Whether the search should be case sensitive. Default: false.'),
    }),
    execute: async ({ filePattern, searchTerm, contextLines, caseSensitive }, { toolCallId }) => {
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_GREP, { filePattern, searchTerm, contextLines, caseSensitive });

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GREP}`;
      const questionText = `Approve grep search for '${searchTerm}' in files matching '${filePattern}'?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `Grep search for '${searchTerm}' in files matching '${filePattern}' denied by user. Reason: ${userInput}`;
      }

      try {
        const files = await glob(filePattern, {
          cwd: project.baseDir,
          nodir: true,
          absolute: true,
        });

        if (files.length === 0) {
          return `No files found matching pattern '${filePattern}'.`;
        }

        const results: Array<{
          filePath: string;
          lineNumber: number;
          lineContent: string;
          context?: string[];
        }> = [];
        const searchRegex = new RegExp(searchTerm, caseSensitive ? undefined : 'i'); // Simpler for line-by-line test

        for (const absoluteFilePath of files) {
          const fileContent = await fs.readFile(absoluteFilePath, 'utf8');
          const lines = fileContent.split('\n');
          const relativeFilePath = path.relative(project.baseDir, absoluteFilePath);

          lines.forEach((line, index) => {
            if (searchRegex.test(line)) {
              const matchResult: {
                filePath: string;
                lineNumber: number;
                lineContent: string;
                context?: string[];
              } = {
                filePath: relativeFilePath,
                lineNumber: index + 1,
                lineContent: line,
              };

              if (contextLines > 0) {
                const start = Math.max(0, index - contextLines);
                const end = Math.min(lines.length - 1, index + contextLines);
                matchResult.context = lines.slice(start, end + 1);
              }
              results.push(matchResult);
            }
          });
        }

        if (results.length === 0) {
          return `No matches found for pattern '${searchTerm}' in files matching '${filePattern}'.`;
        }
        return results;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error during grep: ${errorMessage}`;
      }
    },
  });

  const bashTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_BASH],
    parameters: z.object({
      command: z.string().describe('The shell command to execute (e.g., ls -la, npm install).'),
      cwd: z.string().optional().describe('The working directory for the command (relative to project root). Default: project root.'),
      timeout: z.number().int().min(0).optional().default(60000).describe('Timeout for the command execution in milliseconds. Default: 60000 ms.'),
    }),
    execute: async ({ command, cwd, timeout }, { toolCallId }) => {
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_BASH, { command, cwd, timeout });

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_BASH}`;
      const questionText = 'Approve executing bash command?';
      const questionSubject = `Command: ${command}\nWorking Directory: ${cwd || '.'}\nTimeout: ${timeout}ms`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `Bash command execution denied by user. Reason: ${userInput}`;
      }

      const absoluteCwd = cwd ? path.resolve(project.baseDir, cwd) : project.baseDir;
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: absoluteCwd,
          timeout: timeout,
        });
        return { stdout, stderr, exitCode: 0 };
      } catch (error: unknown) {
        const execError = error as {
          stdout?: string;
          stderr?: string;
          message?: string;
          code?: number;
        };
        return {
          stdout: execError.stdout || '',
          stderr: execError.stderr || execError.message || String(error),
          exitCode: typeof execError.code === 'number' ? execError.code : 1,
        };
      }
    },
  });

  /*
  const lintTool = tool({
    description:
      "Executes a linting command for the project. The command should be specific to the project's linter and configuration. Returns raw command output.",
    parameters: z.object({
      command: z.string().describe("The linting command to execute (e.g., 'eslint src/ --format stylish', 'pylint my_module')."),
      cwd: z.string().optional().describe('The working directory for the command (relative to project root). Default: project root.'),
      timeout: z.number().int().min(0).optional().default(120000).describe('Timeout for the command execution in milliseconds. Default: 120000 ms.'),
    }),
    execute: async ({ command, cwd, timeout }) => {
      const absoluteCwd = cwd ? path.resolve(project.baseDir, cwd) : project.baseDir;
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: absoluteCwd,
          timeout: timeout,
        });
        return {
          stdout,
          stderr,
          exitCode: 0,
          note: 'Lint command finished. Review stdout/stderr for results.',
        };
      } catch (error: unknown) {
        const execError = error as {
          stdout?: string;
          stderr?: string;
          message?: string;
          code?: number;
        };
        return {
          stdout: execError.stdout || '',
          stderr: execError.stderr || execError.message || String(error),
          exitCode: typeof execError.code === 'number' ? execError.code : 1,
          note: 'Lint command failed or returned non-zero exit code. Check output for details.',
        };
      }
    },
  });

  const runTestsTool = tool({
    description:
      "Executes a test command for the project. The command should be specific to the project's test runner and configuration. Returns raw command output.",
    parameters: z.object({
      command: z.string().describe("The test command to execute (e.g., 'npm test', 'pytest -k my_test_suite')."),
      cwd: z.string().optional().describe('The working directory for the command (relative to project root). Default: project root.'),
      timeout: z.number().int().min(0).optional().default(300000).describe('Timeout for the command execution in milliseconds. Default: 300000 ms.'),
    }),
    execute: async ({ command, cwd, timeout }) => {
      const absoluteCwd = cwd ? path.resolve(project.baseDir, cwd) : project.baseDir;
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: absoluteCwd,
          timeout: timeout,
        });
        return {
          stdout,
          stderr,
          exitCode: 0,
          note: 'Test command finished. Review stdout/stderr for results.',
        };
      } catch (error: unknown) {
        const execError = error as {
          stdout?: string;
          stderr?: string;
          message?: string;
          code?: number;
        };
        return {
          stdout: execError.stdout || '',
          stderr: execError.stderr || execError.message || String(error),
          exitCode: typeof execError.code === 'number' ? execError.code : 1,
          note: 'Test command failed or returned non-zero exit code. Check output for details.',
        };
      }
    },
  });

  // TaskList tools
  const prepareTasksTool = tool({
    description: 'Prepares or re-initializes the task list with a given set of task titles. Clears all existing tasks and creates new ones.',
    parameters: z.object({
      titles: z.array(z.string()).describe('An array of titles for the tasks to be created.'),
    }),
    execute: async ({ titles }) => {
      try {
        return await project.prepareTasks(titles);
      } catch (error) {
        return `Error preparing tasks: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const getTasksTool = tool({
    description: 'Retrieves all current tasks from the task list.',
    parameters: z.object({}), // No parameters
    execute: async () => {
      try {
        return await project.listTasks();
      } catch (error) {
        return `Error getting tasks: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const updateTaskTool = tool({
    description: "Updates an existing task's title or completion status. Use 'completed: true' for completed tasks and 'completed: false' for pending tasks.",
    parameters: z.object({
      taskId: z.string().describe('The ID of the task to update.'),
      updates: z.object({
        title: z.string().optional().describe('The new title for the task.'),
        completed: z.boolean().optional().describe('The new completion status for the task. True marks as completed, false marks as pending.'),
      }),
    }),
    execute: async ({ taskId, updates }) => {
      try {
        const projectUpdatePayload: { title?: string; completed?: boolean } = {};
        if (updates.title !== undefined) {
          projectUpdatePayload.title = updates.title;
        }
        if (updates.completed !== undefined) {
          projectUpdatePayload.completed = updates.completed;
        }

        const updatedTask = await project.updateTask(taskId, projectUpdatePayload);
        if (!updatedTask) {
          return `Error: Task with ID '${taskId}' not found or update failed.`;
        }
        return updatedTask;
      } catch (error) {
        return `Error updating task '${taskId}': ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
   */

  const allTools = {
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_EDIT}`]: fileEditTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_READ}`]: fileReadTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_WRITE}`]: fileWriteTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GLOB}`]: globTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GREP}`]: grepTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_SEMANTIC_SEARCH}`]: searchTool(POWER_TOOL_DESCRIPTIONS[TOOL_SEMANTIC_SEARCH]),
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_BASH}`]: bashTool,
    // TODO: disabled for now until better defined
    // [`power${TOOL_GROUP_NAME_SEPARATOR}lint`]: lintTool,
    // [`power${TOOL_GROUP_NAME_SEPARATOR}run_tests`]: runTestsTool,
    // [`power${TOOL_GROUP_NAME_SEPARATOR}prepare_tasks`]: prepareTasksTool,
    // [`power${TOOL_GROUP_NAME_SEPARATOR}get_tasks`]: getTasksTool,
    // [`power${TOOL_GROUP_NAME_SEPARATOR}update_task`]: updateTaskTool,
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
