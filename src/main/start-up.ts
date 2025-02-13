import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { delay } from '@common/utils';
import { AIDER_DESK_DIR, SETUP_COMPLETE_FILENAME, PYTHON_VENV_DIR, AIDER_DESK_CONNECTOR_DIR, RESOURCES_DIR } from './constants';

const execAsync = promisify(exec);

const getPythonExecutable = (): string => {
  const envPython = process.env.AIDER_DESK_PYTHON;
  if (envPython) {
    return envPython;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
};

const checkPythonVersion = async (): Promise<void> => {
  const pythonExecutable = getPythonExecutable();
  try {
    const command = `${pythonExecutable} --version`;
    const { stdout } = await execAsync(command, {
      windowsHide: true,
    });

    // Extract version number from output like "Python 3.10.12"
    const versionMatch = stdout.match(/Python (\d+)\.(\d+)\.\d+/);
    if (!versionMatch) {
      throw new Error(
        `Could not determine Python version (output: '${stdout}'). You can specify a specific Python executable by setting the AIDER_DESK_PYTHON environment variable.`,
      );
    }

    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);

    // Check if version is between 3.9 and 3.12
    if (major !== 3 || minor < 9 || minor > 12) {
      throw new Error(
        `Python version ${major}.${minor} is not supported. Please install Python 3.9-3.12. You can specify a specific Python executable by setting the AIDER_DESK_PYTHON environment variable.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('version')) {
      throw error;
    }
    throw new Error(
      `Python is not installed or an error occurred. Please install Python 3.9-3.12 or set the AIDER_DESK_PYTHON environment variable. Original error: ${error}`,
    );
  }
};

const createVirtualEnv = async (): Promise<void> => {
  const command = process.platform === 'win32' ? 'python' : 'python3';
  await execAsync(`${command} -m venv "${PYTHON_VENV_DIR}"`, {
    windowsHide: true,
  });
};

const getPythonVenvBinPath = (): string => {
  return process.platform === 'win32' ? path.join(PYTHON_VENV_DIR, 'Scripts') : path.join(PYTHON_VENV_DIR, 'bin');
};

const setupAiderConnector = async () => {
  if (!fs.existsSync(AIDER_DESK_CONNECTOR_DIR)) {
    fs.mkdirSync(AIDER_DESK_CONNECTOR_DIR, { recursive: true });
  }

  // Copy connector.py from resources
  const sourceConnectorPath = path.join(RESOURCES_DIR, 'connector/connector.py');
  const destConnectorPath = path.join(AIDER_DESK_CONNECTOR_DIR, 'connector.py');
  fs.copyFileSync(sourceConnectorPath, destConnectorPath);

  await installAiderConnectorRequirements();
};

const installAiderConnectorRequirements = async (): Promise<void> => {
  const pythonBinPath = getPythonVenvBinPath();
  const pip = process.platform === 'win32' ? 'pip.exe' : 'pip';
  const pipPath = path.join(pythonBinPath, pip);

  const packages = ['aider-chat --upgrade', 'python-socketio', 'websocket-client', 'nest-asyncio'];

  for (const pkg of packages) {
    await execAsync(`"${pipPath}" install ${pkg}`, {
      windowsHide: true,
      env: {
        ...process.env,
        VIRTUAL_ENV: PYTHON_VENV_DIR,
        PATH: `${pythonBinPath}${path.delimiter}${process.env.PATH}`,
      },
    });
  }
};

const performUpdateCheck = async (updateProgress: UpdateProgressFunction): Promise<void> => {
  updateProgress({
    step: 'Update Check',
    message: 'Updating Aider connector...',
  });

  await setupAiderConnector();
};

export type UpdateProgressData = {
  step: string;
  message: string;
};

export type UpdateProgressFunction = (data: UpdateProgressData) => void;

export const performStartUp = async (updateProgress: UpdateProgressFunction): Promise<boolean> => {
  if (fs.existsSync(SETUP_COMPLETE_FILENAME)) {
    await performUpdateCheck(updateProgress);
    return true;
  }

  updateProgress({
    step: 'AiderDesk Setup',
    message: 'Performing initial setup...',
  });

  await delay(2000);

  if (!fs.existsSync(AIDER_DESK_DIR)) {
    fs.mkdirSync(AIDER_DESK_DIR, { recursive: true });
  }

  try {
    updateProgress({
      step: 'Checking Python Installation',
      message: 'Verifying Python installation...',
    });

    await checkPythonVersion();

    updateProgress({
      step: 'Creating Virtual Environment',
      message: 'Setting up Python virtual environment...',
    });

    await createVirtualEnv();

    updateProgress({
      step: 'Setting Up Connector',
      message: 'Installing Aider connector (this may take a while)...',
    });

    await setupAiderConnector();

    updateProgress({
      step: 'Finishing Setup',
      message: 'Completing installation...',
    });

    // Create setup complete file
    fs.writeFileSync(SETUP_COMPLETE_FILENAME, new Date().toISOString());

    return true;
  } catch (error) {
    // Clean up if setup fails
    if (fs.existsSync(PYTHON_VENV_DIR)) {
      fs.rmSync(PYTHON_VENV_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(SETUP_COMPLETE_FILENAME)) {
      fs.unlinkSync(SETUP_COMPLETE_FILENAME);
    }
    throw error;
  }
};
