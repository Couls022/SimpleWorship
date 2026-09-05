const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onWindowStateChanged: (callback) => {
    const handler = (event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:state-changed', handler);
    return () => ipcRenderer.removeListener('window:state-changed', handler);
  },
  getDisplays: () => ipcRenderer.invoke('display:get-all'),
  onDisplaysChanged: (callback) => {
    const handler = (event, displays) => callback(displays);
    ipcRenderer.on('displays:changed', handler);
    return () => ipcRenderer.removeListener('displays:changed', handler);
  },
  onDisplayChanged: (callback) => {
    const handler = (event, info) => callback(info);
    ipcRenderer.on('display:changed', handler);
    return () => ipcRenderer.removeListener('display:changed', handler);
  },
  openProjector: (groupIdOrOpts, maybeDisplayId) => {
    if (typeof groupIdOrOpts === 'object' && groupIdOrOpts !== null) {
      return ipcRenderer.invoke('projector:open', groupIdOrOpts);
    }
    return ipcRenderer.invoke('projector:open', { groupId: groupIdOrOpts, displayId: maybeDisplayId });
  },
  closeProjector: (groupIdOrOpts) => {
    if (typeof groupIdOrOpts === 'object' && groupIdOrOpts !== null) {
      return ipcRenderer.invoke('projector:close', groupIdOrOpts);
    }
    return ipcRenderer.invoke('projector:close', { groupId: groupIdOrOpts });
  },
  getProjectorStatuses: () => ipcRenderer.invoke('projector:get-statuses'),
  getProjectorStatus: (groupId) => ipcRenderer.invoke('projector:get-status', { groupId }),
  onProjectorStatusChanged: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('projector:status-changed', handler);
    return () => ipcRenderer.removeListener('projector:status-changed', handler);
  },
  onProjectorRouteChanged: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('projector:route-changed', handler);
    return () => ipcRenderer.removeListener('projector:route-changed', handler);
  },
  onProjectorError: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('projector:error', handler);
    return () => ipcRenderer.removeListener('projector:error', handler);
  },
  syncProjectorDisplays: (assignments) => ipcRenderer.invoke('projector:sync-displays', { assignments }),
  identifyDisplays: () => ipcRenderer.invoke('display:identify'),
  saveSwsFile: (defaultName, data) => ipcRenderer.invoke('file:save-sws', { defaultName, data }),
  openSwsFile: () => ipcRenderer.invoke('file:open-sws'),
  readSwsFromPath: (filePath) => ipcRenderer.invoke('file:read-sws-path', filePath),
  onFileAssociationOpened: (callback) => {
    const handler = (event, filePath) => callback(filePath);
    ipcRenderer.on('file:opened-via-association', handler);
    return () => ipcRenderer.removeListener('file:opened-via-association', handler);
  }
});
