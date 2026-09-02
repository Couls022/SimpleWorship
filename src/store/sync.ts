import { useStore } from './useStore';

const CHANNEL_NAME = 'simpleworship_sync';
let channel: BroadcastChannel | null = null;

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
  channelActive: false,
  channelName: CHANNEL_NAME,
  lastBroadcastTime: null,
  lastReceivedTime: null,
  messageCount: 0,
  backendSyncActive: true,
  lastBackendSyncTime: null,
  backendStatus: 'connected'
};

let syncBackendTimeout: any = null;

async function syncStateToBackend() {
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
  if (channel) return;
  
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    syncTelemetry.channelActive = true;
  } catch (e) {
    console.warn('BroadcastChannel not supported in this browser, falling back to REST sync', e);
    syncTelemetry.channelActive = false;
  }

  if (isProjector) {
    // Projector listens for state updates
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === 'SYNC_STATE') {
          const payload = event.data;
          syncTelemetry.lastReceivedTime = Date.now();
          syncTelemetry.messageCount++;
          
          useStore.setState({
            groupStates: payload.groupStates || {},
            alert: payload.alert || useStore.getState().alert,
            ...(payload.activeSchedule ? { activeSchedule: payload.activeSchedule } : {})
          });
          
          window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
        }
      };
      
      // Request initial state via BroadcastChannel
      channel.postMessage({ type: 'REQUEST_STATE' });
    }

    // Also fetch initial state from backend as fallback
    fetch('/api/sync/state')
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          useStore.setState({
            groupStates: res.data.groupStates || {},
            alert: res.data.alert || useStore.getState().alert,
            ...(res.data.activeSchedule ? { activeSchedule: res.data.activeSchedule } : {})
          });
        }
      })
      .catch(() => {});
  } else {
    // Moderator listens for requests and broadcasts updates
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === 'REQUEST_STATE') {
          const store = useStore.getState();
          channel?.postMessage({
            type: 'SYNC_STATE',
            groupStates: store.groupStates,
            alert: store.alert,
            activeSchedule: store.activeSchedule,
          });
          syncTelemetry.lastBroadcastTime = Date.now();
          syncTelemetry.messageCount++;
          window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
        }
      };
    }

    // Subscribe to local state changes to broadcast them & sync with backend
    useStore.subscribe((state, prevState) => {
      if (
        state.groupStates !== prevState.groupStates ||
        state.alert !== prevState.alert ||
        state.activeSchedule !== prevState.activeSchedule
      ) {
        if (channel) {
          channel.postMessage({
            type: 'SYNC_STATE',
            groupStates: state.groupStates,
            alert: state.alert,
            activeSchedule: state.activeSchedule,
          });
          syncTelemetry.lastBroadcastTime = Date.now();
          syncTelemetry.messageCount++;
        }
        
        // Push state update to backend
        debouncedBackendSync();
        window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
      }
    });
  }
}

export function broadcastState() {
  if (channel) {
    const store = useStore.getState();
    channel.postMessage({
      type: 'SYNC_STATE',
      groupStates: store.groupStates,
      alert: store.alert,
      activeSchedule: store.activeSchedule,
    });
    syncTelemetry.lastBroadcastTime = Date.now();
    syncTelemetry.messageCount++;
    debouncedBackendSync();
    window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
  }
}
