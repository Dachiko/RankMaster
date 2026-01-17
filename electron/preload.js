
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanDirectory: (path) => ipcRenderer.invoke('fs:scanDirectory', path),
  readFile: (dirPath, filename) => ipcRenderer.invoke('fs:readFile', { dirPath, filename }),
  writeFile: (dirPath, filename, data) => ipcRenderer.invoke('fs:writeFile', { dirPath, filename, data }),
  joinPath: (dirPath, filename) => ipcRenderer.invoke('fs:joinPath', { dirPath, filename }),
  moveFile: (sourcePath, targetPath) => ipcRenderer.invoke('fs:moveFile', { sourcePath, targetPath }),
  makeDir: (dirPath) => ipcRenderer.invoke('fs:makeDir', { dirPath }),
  quit: () => ipcRenderer.invoke('app:quit'),
  isElectron: true
});
