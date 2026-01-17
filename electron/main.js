
import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register the custom protocol as privileged
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'local-resource', 
    privileges: { 
      secure: true, 
      standard: true, 
      supportFetchAPI: true, 
      bypassCSP: true,
      stream: true
    } 
  }
]);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#000',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#ffffff'
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true, // Keep enabled, we handle access via protocol
      sandbox: false 
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
  if (app.isPackaged) {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
      mainWindow.loadURL(startUrl);
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml'
};

app.whenReady().then(() => {
  protocol.handle('local-resource', async (request) => {
    try {
        const url = new URL(request.url);
        const filepath = url.searchParams.get('path');
        
        if (!filepath) {
            console.warn('Local Resource: Missing path param');
            return new Response('Bad Request', { status: 400 });
        }

        // Direct FS read is more robust than net.fetch for local files in packaged apps
        // It bypasses potential internal browser fetch restrictions
        const data = await fsPromises.readFile(filepath);
        const ext = path.extname(filepath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

        return new Response(data, {
            headers: { 'content-type': mimeType }
        });

    } catch (error) {
        console.error('Failed to load local resource:', error);
        return new Response('Not Found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', function () {
    if (mainWindow === null) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('fs:scanDirectory', async (_, dirPath) => {
  try {
    const files = await fsPromises.readdir(dirPath, { withFileTypes: true });
    return files
      .filter(dirent => dirent.isFile())
      .map(dirent => dirent.name);
  } catch (e) {
    return [];
  }
});

ipcMain.handle('fs:readFile', async (_, { dirPath, filename }) => {
  try {
    const fullPath = path.join(dirPath, filename);
    return await fsPromises.readFile(fullPath, 'utf-8');
  } catch (e) {
    return null;
  }
});

ipcMain.handle('fs:writeFile', async (_, { dirPath, filename, data }) => {
  try {
    const fullPath = path.join(dirPath, filename);
    await fsPromises.writeFile(fullPath, data, 'utf-8');
    return true;
  } catch (e) {
    throw e;
  }
});

ipcMain.handle('fs:joinPath', async (_, { dirPath, filename }) => {
    return path.join(dirPath, filename);
});

ipcMain.handle('fs:moveFile', async (_, { sourcePath, targetPath }) => {
    try {
        await fsPromises.rename(sourcePath, targetPath);
        return true;
    } catch (e) {
        console.error('Move failed', e);
        return false;
    }
});

ipcMain.handle('fs:makeDir', async (_, { dirPath }) => {
    try {
        await fsPromises.mkdir(dirPath, { recursive: true });
        return true;
    } catch (e) {
        return false;
    }
});

ipcMain.handle('app:quit', () => {
  app.quit();
});
