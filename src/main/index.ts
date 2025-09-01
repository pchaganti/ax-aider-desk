import { join } from 'path';
import { createServer } from 'http';
import { existsSync, statSync } from 'fs';

import { delay } from '@common/utils';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, Menu, shell } from 'electron';

import icon from '../../resources/icon.png?asset';

import { ProgressWindow } from '@/progress-window';
import { Agent, McpManager } from '@/agent';
import { RestApiController } from '@/rest-api';
import { ConnectorManager } from '@/connector';
import { setupIpcHandlers } from '@/ipc-handlers';
import { ProjectManager } from '@/project';
import { performStartUp, UpdateProgressData } from '@/start-up';
import { Store, getDefaultProjectSettings } from '@/store';
import { VersionsManager } from '@/versions';
import logger from '@/logger';
import { TelemetryManager } from '@/telemetry';
import { EventManager } from '@/events';
import { ModelInfoManager } from '@/models';
import { DataManager } from '@/data-manager';
import { TerminalManager } from '@/terminal';
import { EventsHandler } from '@/events-handler';

const HEADLESS_MODE = process.env.AIDER_DESK_HEADLESS === 'true';

const setupCustomMenu = (): void => {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    // Edit menu (without Select All)
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Reset Zoom' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
      ],
    },
    // Settings menu
    {
      label: 'Settings',
      submenu: [
        {
          label: 'General',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('open-settings', 0);
          },
        },
        {
          label: 'Providers',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('open-settings', 1);
          },
        },
        {
          label: 'Aider',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('open-settings', 2);
          },
        },
        {
          label: 'Agent',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('open-settings', 3);
          },
        },
        {
          label: 'About',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('open-settings', 4);
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};

const initStore = async (): Promise<Store> => {
  const store = new Store();
  await store.init();

  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  if (args.length > 0) {
    const potentialDir = args[args.length - 1];
    try {
      const absolutePath = join(process.cwd(), potentialDir);
      if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
        const normalizedDir = absolutePath;
        store.setOpenProjects([
          {
            baseDir: normalizedDir,
            active: true,
            settings: getDefaultProjectSettings(store, normalizedDir),
          },
        ]);
      } else {
        logger.warn(`Provided path is not a directory: ${potentialDir}`);
      }
    } catch (error) {
      logger.error(`Error checking directory path: ${(error as Error).message}`);
    }
  }

  return store;
};

const initManagers = async (
  mainWindow: BrowserWindow | null,
  store: Store,
): Promise<{
  eventsHandler: EventsHandler;
}> => {
  // Initialize telemetry manager
  const telemetryManager = new TelemetryManager(store);
  await telemetryManager.init();

  // Initialize MCP manager
  const mcpManager = new McpManager();
  const activeProject = store.getOpenProjects().find((project) => project.active);

  void mcpManager.initMcpConnectors(store.getSettings().mcpServers, activeProject?.baseDir);

  // Initialize model info manager
  const modelInfoManager = new ModelInfoManager();
  void modelInfoManager.init();

  // Initialize data manager
  const dataManager = new DataManager();
  dataManager.init();

  // Initialize agent
  const agent = new Agent(store, mcpManager, modelInfoManager, telemetryManager);

  // Initialize event manager
  const eventManager = new EventManager(mainWindow);

  // Initialize project manager
  const projectManager = new ProjectManager(store, agent, telemetryManager, dataManager, eventManager);

  // Initialize terminal manager
  const terminalManager = new TerminalManager(eventManager, telemetryManager);

  // Initialize Versions Manager (this also sets up listeners)
  const versionsManager = new VersionsManager(eventManager, store);

  // Create HTTP server
  const httpServer = createServer();

  // Initialize events handler
  const eventsHandler = new EventsHandler(
    mainWindow,
    projectManager,
    store,
    mcpManager,
    agent,
    versionsManager,
    modelInfoManager,
    telemetryManager,
    dataManager,
    terminalManager,
  );

  // Create and initialize REST API controller
  const restApiController = new RestApiController(httpServer, projectManager, eventsHandler);

  // Initialize connector manager with the server
  const connectorManager = new ConnectorManager(projectManager, httpServer, eventManager);

  const beforeQuit = async () => {
    terminalManager.close();
    await mcpManager.close();
    await restApiController.close();
    await connectorManager.close();
    await projectManager.close();
    versionsManager.destroy();
    await telemetryManager.destroy();
  };

  app.on('before-quit', beforeQuit);

  // Handle CTRL+C (SIGINT)
  process.on('SIGINT', async () => {
    await beforeQuit();
    process.exit(0);
  });

  return {
    eventsHandler,
  };
};

const initWindow = async (store: Store): Promise<BrowserWindow> => {
  const lastWindowState = store.getWindowState();
  const mainWindow = new BrowserWindow({
    width: lastWindowState.width,
    height: lastWindowState.height,
    x: lastWindowState.x,
    y: lastWindowState.y,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    if (lastWindowState.isMaximized) {
      mainWindow.maximize();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('context-menu', (_event, params) => {
    mainWindow.webContents.send('context-menu', params);
  });

  const saveWindowState = (): void => {
    const [width, height] = mainWindow.getSize();
    const [x, y] = mainWindow.getPosition();
    store.setWindowState({
      width,
      height,
      x,
      y,
      isMaximized: mainWindow.isMaximized(),
    });
  };

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  const { eventsHandler } = await initManagers(mainWindow, store);

  // Initialize IPC handlers
  setupIpcHandlers(eventsHandler);

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Apply saved zoom level
  const settings = store.getSettings();
  mainWindow.webContents.setZoomFactor(settings.zoomLevel ?? 1.0);

  return mainWindow;
};

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.hotovo.aider-desk');

  if (!HEADLESS_MODE) {
    // Setup custom menu only in GUI mode
    setupCustomMenu();

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });
  }

  logger.info('------------ Starting AiderDesk... ------------');
  logger.info('Initializing fix-path...');
  (await import('fix-path')).default();

  let progressBar: ProgressWindow | null = null;
  let updateProgress: ((data: UpdateProgressData) => void) | null;

  if (!HEADLESS_MODE) {
    progressBar = new ProgressWindow({
      width: 400,
      icon,
    });
    progressBar.title = 'Starting AiderDesk...';
    progressBar.setDetail('Initializing core components...');

    await new Promise((resolve) => {
      progressBar?.on('ready', () => {
        resolve(null);
      });
    });
    await delay(1000);

    updateProgress = ({ step, message, info, progress }: UpdateProgressData) => {
      progressBar!.title = step;
      progressBar!.setDetail(message, info);
      if (progress !== undefined) {
        progressBar!.setProgress(progress);
      }
    };
  } else {
    logger.info('Starting in headless mode...');
    // In headless mode, use a no-op updateProgress
    updateProgress = () => {};
  }

  try {
    await performStartUp(updateProgress);
    if (progressBar) {
      progressBar.title = 'Startup complete';
      progressBar.setDetail('Everything is ready! Have fun coding!', 'Booting up UI...');
      progressBar.setCompleted();
    }
  } catch (error) {
    if (progressBar) {
      progressBar?.close();
    }
    dialog.showErrorBox('Setup Failed', error instanceof Error ? error.message : 'Unknown error occurred during setup');
    app.quit();
    return;
  }

  const store = await initStore();

  if (HEADLESS_MODE) {
    // Initialize managers without window in headless mode
    await initManagers(null, store);
  } else {
    await initWindow(store);
    progressBar?.close();

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0 && store) {
        void initWindow(store);
      }
    });
  }
});

app.on('window-all-closed', () => {
  if (!HEADLESS_MODE) {
    app.quit();
  }
});

process.on('exit', () => {
  app.quit();
});
