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
            ...(payload.annotationState ? { annotationState: payload.annotationState } : {}),
            ...(payload.activeControlGroupId !== undefined ? { activeControlGroupId: payload.activeControlGroupId } : {}),
            ...(payload.outputGroups ? { outputGroups: payload.outputGroups } : {}),
            ...(payload.activeSchedule ? { activeSchedule: payload.activeSchedule } : {}),
            ...(payload.themesList ? { themesList: payload.themesList } : {}),
            ...(payload.systemOptions ? { systemOptions: payload.systemOptions } : {})
          });
          
          window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
        }
      };
      
      // Request initial state via BroadcastChannel
      channel.postMessage({ type: 'REQUEST_STATE' });
    }

    // Also fetch initial state from backend as fallback if HTTP server is available
    if (isHttpServerAvailable()) {
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
    }
  } else {
    // Moderator listens for requests and broadcasts updates
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === 'REQUEST_STATE') {
          const store = useStore.getState();
          channel?.postMessage({
            type: 'SYNC_STATE',
            groupStates: store.groupStates,
            activeControlGroupId: store.activeControlGroupId,
            outputGroups: store.outputGroups,
            alert: store.alert,
            annotationState: store.annotationState,
            activeSchedule: store.activeSchedule,
            themesList: store.themesList,
            systemOptions: store.systemOptions,
          });
          syncTelemetry.lastBroadcastTime = Date.now();
          syncTelemetry.messageCount++;
          window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
        }
      };
    }

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
        if (channel) {
          channel.postMessage({
            type: 'SYNC_STATE',
            groupStates: state.groupStates,
            activeControlGroupId: state.activeControlGroupId,
            outputGroups: state.outputGroups,
            alert: state.alert,
            annotationState: state.annotationState,
            activeSchedule: state.activeSchedule,
            themesList: state.themesList,
            systemOptions: state.systemOptions,
          });
          syncTelemetry.lastBroadcastTime = Date.now();
          syncTelemetry.messageCount++;
        }
        
        // Push state update to backend
        debouncedBackendSync();
        window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
      }
    });

    // ─── POLLING SYSTEM FOR BI-DIRECTIONAL REMOTE CONTROL ───
    // Poll the server state periodically to instantly grab updates pushed by a phone remote (only when running via HTTP)
    setInterval(async () => {
      if (!isHttpServerAvailable()) return;
      try {
        const timeSinceLocalChange = Date.now() - lastLocalUpdateTime;
        // Only fetch external updates if we haven't modified state locally in the last 1.5 seconds
        if (timeSinceLocalChange < 1500) return;

        const res = await fetch('/api/sync/state');
        if (res.ok) {
          const payload = await res.json();
          if (payload.success && payload.data) {
            const serverState = payload.data;
            
            // If the server state is newer than our last known update, apply it
            if (serverState.lastUpdated > lastLocalUpdateTime) {
              lastLocalUpdateTime = serverState.lastUpdated;
              
              useStore.setState({
                groupStates: serverState.groupStates || {},
                alert: serverState.alert || useStore.getState().alert,
                ...(serverState.activeSchedule ? { activeSchedule: serverState.activeSchedule } : {})
              });

              // Trigger custom local notification or render update
              window.dispatchEvent(
                new CustomEvent('simpleworship:notify', { 
                  detail: 'Synchronized remote control command from mobile device' 
                })
              );
            }
          }
        }
      } catch (err) {
        // Silent fail for polling
      }
    }, 500);
  }
}

export function broadcastState() {
  if (channel) {
    const store = useStore.getState();
    channel.postMessage({
      type: 'SYNC_STATE',
      groupStates: store.groupStates,
      activeControlGroupId: store.activeControlGroupId,
      outputGroups: store.outputGroups,
      alert: store.alert,
      activeSchedule: store.activeSchedule,
      themesList: store.themesList,
      systemOptions: store.systemOptions,
    });
    syncTelemetry.lastBroadcastTime = Date.now();
    syncTelemetry.messageCount++;
    debouncedBackendSync();
    window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
  }
}
