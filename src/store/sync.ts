import { useStore } from './useStore';
import { broadcastStateChange, subscribeToBroadcast } from '../utils/broadcastSync';

export interface SyncTelemetry {
  channelActive: boolean;
  channelName: string;
  lastBroadcastTime: number | null;
  lastReceivedTime: number | null;
  messageCount: number;
  backendSyncActive: boolean;
  lastBackendSyncTime: number | null;
  backendStatus: 'connected' | 'disconnected' | 'syncing';
}

export const syncTelemetry: SyncTelemetry = {
  channelActive: true,
  channelName: 'simpleworship_live_channel',
  lastBroadcastTime: null,
  lastReceivedTime: null,
  messageCount: 0,
  backendSyncActive: true,
  lastBackendSyncTime: null,
  backendStatus: 'connected'
};

let syncBackendTimeout: any = null;
let initialized = false;

function isHttpServerAvailable(): boolean {
  return typeof window !== 'undefined' && window.location.protocol.startsWith('http');
}

async function syncStateToBackend() {
  if (!isHttpServerAvailable()) {
    syncTelemetry.backendStatus = 'connected';
    return;
  }
  try {
    const store = useStore.getState();
    const payload = {
      groupStates: store.groupStates,
      alert: store.alert,
      activeSchedule: store.activeSchedule,
    };
    
    syncTelemetry.backendStatus = 'syncing';
    const res = await fetch('/api/sync/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      syncTelemetry.backendStatus = 'connected';
      syncTelemetry.lastBackendSyncTime = Date.now();
      window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
    } else {
      syncTelemetry.backendStatus = 'disconnected';
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

    // Polling for REST sync (remote control apps)
    setInterval(async () => {
      if (!isHttpServerAvailable()) return;
      try {
        const timeSinceLocalChange = Date.now() - lastLocalUpdateTime;
        if (timeSinceLocalChange < 1500) return;
        const res = await fetch('/api/sync/state');
        if (res.ok) {
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('application/json')) return;
          const payload = await res.json();
          if (payload.success && payload.data) {
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
