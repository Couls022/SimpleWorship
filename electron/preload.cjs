const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onWindowStateChanged: (callback) => {
    ipcRenderer.on('window:state-changed', (event, isMaximized) => callback(isMaximized));
  },
  getDisplays: () => ipcRenderer.invoke('display:get-all'),
  openProjector: (options) => ipcRenderer.invoke('projector:open', options),
  closeProjector: (options) => ipcRenderer.invoke('projector:close', options),
  saveSwsFile: (defaultName, data) => ipcRenderer.invoke('file:save-sws', { defaultName, data }),
  openSwsFile: () => ipcRenderer.invoke('file:open-sws'),
  readSwsFromPath: (filePath) => ipcRenderer.invoke('file:read-sws-path', filePath),
  onFileAssociationOpened: (callback) => {
    ipcRenderer.on('file:opened-via-association', (event, filePath) => callback(filePath));
  },
  onDisplayChanged: (callback) => {
    ipcRenderer.on('display:changed', (event, info) => callback(info));
  }
});
