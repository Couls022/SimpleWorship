import { useStore } from './useStore';
import { broadcastStateChange, subscribeToBroadcast } from '../utils/broadcastSync';
import { dbApi } from '../db';

export interface SyncTelemetry {
  channelActive: boolean;
  channelName: string;
  lastBroadcastTime: number | null;
  lastReceivedTime: number | null;
  messageCount: number;
  backendSyncActive: boolean;
  lastBackendSyncTime: number | null;
  backendStatus: 'connected' | 'disconnected' | 'syncing';
  latency?: number;
  lastCommandReceived?: string | null;
}

export const syncTelemetry: SyncTelemetry = {
  channelActive: true,
  channelName: 'simpleworship_live_channel',
  lastBroadcastTime: null,
  lastReceivedTime: null,
  messageCount: 0,
  backendSyncActive: true,
  lastBackendSyncTime: null,
  backendStatus: 'connected',
  latency: 12,
  lastCommandReceived: null
};

let syncBackendTimeout: any = null;
let initialized = false;
let lastProcessedCommandTime = Date.now();

function isHttpServerAvailable(): boolean {
  return typeof window !== 'undefined' && window.location.protocol.startsWith('http');
}

export async function forceSyncNow(): Promise<{ success: boolean; latency: number; timestamp: number }> {
  const store = useStore.getState();
  
  // 1. Broadcast to all open projector & stage display windows
  broadcastStateChange({
    type: 'SYNC_STATE',
    data: {
      groupStates: store.groupStates,
      activeControlGroupId: store.activeControlGroupId,
      outputGroups: store.outputGroups,
      alert: store.alert,
      annotationState: store.annotationState,
      activeSchedule: store.activeSchedule,
      themesList: store.themesList,
      systemOptions: store.systemOptions,
    }
  });
  syncTelemetry.lastBroadcastTime = Date.now();
  syncTelemetry.messageCount++;

  // 2. Persist active schedule to local IndexedDB for durable recovery
  try {
    if (store.activeSchedule) {
      await dbApi.saveSchedule(store.activeSchedule);
    }
  } catch (e) {
    console.warn('[Sync] Local DB persist warning:', e);
  }

  // 3. Synchronize with Express backend server
  await syncStateToBackend();

  return {
    success: syncTelemetry.backendStatus === 'connected',
    latency: syncTelemetry.latency || 10,
    timestamp: Date.now()
  };
}

function executeRemoteCommandLocally(cmd: { action: string; params?: any }) {
  const store = useStore.getState();
  syncTelemetry.lastCommandReceived = `${cmd.action} @ ${new Date().toLocaleTimeString()}`;
  
  switch (cmd.action) {
    case 'next_slide':
      store.goLiveNext();
      break;
    case 'prev_slide':
      store.goLivePrev();
      break;
    case 'next_item':
      store.goNextScheduleItem();
      break;
    case 'prev_item':
      store.goPrevScheduleItem();
      break;
    case 'toggle_black':
      store.toggleBlack();
      break;
    case 'toggle_clear':
      store.toggleClear();
      break;
    case 'toggle_logo':
      store.toggleLogo();
      break;
    case 'go_live':
      store.goLive();
      break;
    case 'set_alert':
      if (cmd.params) {
        store.setAlert({
          active: cmd.params.active ?? cmd.params.enabled ?? true,
          message: cmd.params.message || cmd.params.text || '',
          position: cmd.params.position || 'bottom'
        });
      }
      break;
    case 'clear_alert':
      store.setAlert({ active: false, message: '' });
      break;
    default:
      console.log('[Sync] Unknown remote command:', cmd.action);
  }

  window.dispatchEvent(
    new CustomEvent('simpleworship:notify', {
      detail: `Remote Command Executed: ${cmd.action.replace('_', ' ').toUpperCase()}`
    })
  );
  window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
}

async function syncStateToBackend() {
  if (!isHttpServerAvailable()) {
    syncTelemetry.backendStatus = 'connected';
    return;
  }
  const startTime = performance.now();
  try {
    const store = useStore.getState();
    const payload = {
      groupStates: store.groupStates,
      alert: store.alert,
      activeSchedule: store.activeSchedule,
      activeControlGroupId: store.activeControlGroupId,
      outputGroups: store.outputGroups,
      themesList: store.themesList,
      systemOptions: store.systemOptions
    };
    
    syncTelemetry.backendStatus = 'syncing';
    window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));

    const res = await fetch('/api/sync/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const endTime = performance.now();
    syncTelemetry.latency = Math.round(endTime - startTime);

    if (res.ok) {
      syncTelemetry.backendStatus = 'connected';
      syncTelemetry.lastBackendSyncTime = Date.now();
      window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
    } else {
      syncTelemetry.backendStatus = 'disconnected';
      window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
    }
  } catch (err) {
    syncTelemetry.backendStatus = 'disconnected';
    window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
  }
}

function debouncedBackendSync() {
  if (syncBackendTimeout) clearTimeout(syncBackendTimeout);
  syncBackendTimeout = setTimeout(() => {
    syncStateToBackend();
  }, 1000);
}

export function initSync(isProjector: boolean = false) {
  if (initialized) return;
  initialized = true;

  if (isProjector) {
    // Projector listens for full sync state updates
    subscribeToBroadcast((payload) => {
      if (payload.type === 'SYNC_STATE' && payload.data) {
        syncTelemetry.lastReceivedTime = Date.now();
        syncTelemetry.messageCount++;
        
        const data = payload.data;
        useStore.setState({
          groupStates: data.groupStates || {},
          alert: data.alert || useStore.getState().alert,
          ...(data.annotationState ? { annotationState: data.annotationState } : {}),
          ...(data.activeControlGroupId !== undefined ? { activeControlGroupId: data.activeControlGroupId } : {}),
          ...(data.outputGroups ? { outputGroups: data.outputGroups } : {}),
          ...(data.activeSchedule ? { activeSchedule: data.activeSchedule } : {}),
          ...(data.themesList ? { themesList: data.themesList } : {}),
          ...(data.systemOptions ? { systemOptions: data.systemOptions } : {})
        });
        
        window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
      }
    });
    
    // Request initial state via robust sync channel
    broadcastStateChange({ type: 'REQUEST_STATE', data: null });

    // Also fetch initial state from backend as fallback if HTTP server is available
    if (isHttpServerAvailable()) {
      fetch('/api/sync/state')
        .then(async res => {
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) return null;
          return res.json();
        })
        .then(res => {
          if (res && res.success && res.data) {
            useStore.setState({
              groupStates: res.data.groupStates || {},
              alert: res.data.alert || useStore.getState().alert,
              ...(res.data.activeSchedule ? { activeSchedule: res.data.activeSchedule } : {})
            });
          }
        })
        .catch(() => {});
    }
  } else {
    // Moderator listens for requests and broadcasts updates
    subscribeToBroadcast((payload) => {
      if (payload.type === 'REQUEST_STATE') {
        const store = useStore.getState();
        broadcastStateChange({
          type: 'SYNC_STATE',
          data: {
            groupStates: store.groupStates,
            activeControlGroupId: store.activeControlGroupId,
            outputGroups: store.outputGroups,
            alert: store.alert,
            annotationState: store.annotationState,
            activeSchedule: store.activeSchedule,
            themesList: store.themesList,
            systemOptions: store.systemOptions,
          }
        });
        syncTelemetry.lastBroadcastTime = Date.now();
        syncTelemetry.messageCount++;
        window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
      }
    });

    // Subscribe to local state changes to broadcast them & sync with backend
    let lastLocalUpdateTime = Date.now();
    useStore.subscribe((state, prevState) => {
      if (
        state.groupStates !== prevState.groupStates ||
        state.activeControlGroupId !== prevState.activeControlGroupId ||
        state.outputGroups !== prevState.outputGroups ||
        state.alert !== prevState.alert ||
        state.annotationState !== prevState.annotationState ||
        state.activeSchedule !== prevState.activeSchedule ||
        state.themesList !== prevState.themesList ||
        state.systemOptions !== prevState.systemOptions
      ) {
        lastLocalUpdateTime = Date.now();
        // Individual delta updates are handled in useStore using broadcastStateChange,
        // but we also sync full state to backend here.
        debouncedBackendSync();
      }
    });

    // Polling for REST sync & Remote Command execution
    setInterval(async () => {
      if (!isHttpServerAvailable()) return;
      try {
        const res = await fetch('/api/sync/state');
        if (res.ok) {
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('application/json')) return;
          const payload = await res.json();
          
          // 1. Process any incoming remote commands (from mobile, tablet, or external control)
          if (payload.pendingCommands && Array.isArray(payload.pendingCommands)) {
            for (const cmd of payload.pendingCommands) {
              if (cmd.timestamp > lastProcessedCommandTime) {
                lastProcessedCommandTime = cmd.timestamp;
                executeRemoteCommandLocally(cmd);
              }
            }
          }

          // 2. Merge server state if newer than local changes
          const timeSinceLocalChange = Date.now() - lastLocalUpdateTime;
          if (timeSinceLocalChange >= 1500 && payload.success && payload.data) {
            const serverState = payload.data;
            if (serverState.lastUpdated > lastLocalUpdateTime) {
              lastLocalUpdateTime = serverState.lastUpdated;
              useStore.setState({
                groupStates: serverState.groupStates || {},
                alert: serverState.alert || useStore.getState().alert,
                ...(serverState.activeSchedule ? { activeSchedule: serverState.activeSchedule } : {})
              });
            }
          }
        }
      } catch (err) {}
    }, 500);
  }
}

export function broadcastState() {
  const store = useStore.getState();
  broadcastStateChange({
    type: 'SYNC_STATE',
    data: {
      groupStates: store.groupStates,
      activeControlGroupId: store.activeControlGroupId,
      outputGroups: store.outputGroups,
      alert: store.alert,
      activeSchedule: store.activeSchedule,
      themesList: store.themesList,
      systemOptions: store.systemOptions,
    }
  });
  syncTelemetry.lastBroadcastTime = Date.now();
  syncTelemetry.messageCount++;
  debouncedBackendSync();
  window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
}
