import { useState, useEffect, useCallback } from 'react';
import { useStore } from './useStore';
import { broadcastStateChange, subscribeToBroadcast, reconnectBroadcastChannel, sanitizeForSync } from '../utils/broadcastSync';
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

export interface StageConnectionState {
  status: 'connected' | 'reconnecting' | 'disconnected';
  lastHeartbeat: number | null;
  reconnectAttempts: number;
  lastReconnectTime: number | null;
  latency: number;
  error?: string | null;
}

export const stageConnectionState: StageConnectionState = {
  status: 'connected',
  lastHeartbeat: typeof window !== 'undefined' ? Date.now() : null,
  reconnectAttempts: 0,
  lastReconnectTime: null,
  latency: 12,
  error: null
};

export function dispatchStageConnectionUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('simpleworship:stage-connection-status', {
      detail: { ...stageConnectionState }
    }));
  }
}

export async function attemptStageReconnect(isManual = false): Promise<boolean> {
  stageConnectionState.status = 'reconnecting';
  stageConnectionState.reconnectAttempts = isManual ? 1 : stageConnectionState.reconnectAttempts + 1;
  stageConnectionState.lastReconnectTime = Date.now();
  dispatchStageConnectionUpdate();

  // 1. Re-initialize / re-establish the underlying BroadcastChannel
  reconnectBroadcastChannel();

  // 2. Transmit high-priority state recovery request across IPC & storage channels
  broadcastStateChange({
    type: 'REQUEST_STATE',
    data: {
      origin: 'stage_display_reconnect',
      isManual,
      attempt: stageConnectionState.reconnectAttempts,
      timestamp: Date.now()
    }
  });

  // 3. Resilient fallback hydration from localStorage
  try {
    const cachedStates = localStorage.getItem('simpleworship_group_states_v1');
    if (cachedStates) {
      const parsed = JSON.parse(cachedStates);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        useStore.setState((prev) => ({
          groupStates: { ...prev.groupStates, ...parsed }
        }));
      }
    }
  } catch (e) {}

  // 4. Query Express backend sync REST endpoint as fallback
  if (isHttpServerAvailable()) {
    try {
      const res = await fetch('/api/sync/state');
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const payload = await res.json();
          if (payload && payload.success && payload.data) {
            useStore.setState((prev) => ({
              groupStates: { ...prev.groupStates, ...(payload.data.groupStates || {}) },
              alert: payload.data.alert || prev.alert,
              ...(payload.data.activeSchedule ? { activeSchedule: payload.data.activeSchedule } : {})
            }));
            stageConnectionState.status = 'connected';
            stageConnectionState.lastHeartbeat = Date.now();
            stageConnectionState.reconnectAttempts = 0;
            stageConnectionState.error = null;
            dispatchStageConnectionUpdate();
            return true;
          }
        }
      }
    } catch (err) {}
  }

  return false;
}

let stageWatchdogTimer: any = null;
let watchdogRefCount = 0;

export function startStageConnectionWatchdog(): () => void {
  if (typeof window === 'undefined') return () => {};
  watchdogRefCount++;

  if (!stageWatchdogTimer) {
    stageWatchdogTimer = setInterval(() => {
      const now = Date.now();
      const lastSeen = stageConnectionState.lastHeartbeat || now;
      const silentDuration = now - lastSeen;

      // If no broadcast packet or heartbeat has arrived in > 5000ms, flag as interrupted / reconnecting
      if (silentDuration > 5000) {
        if (stageConnectionState.status === 'connected') {
          stageConnectionState.status = 'reconnecting';
          dispatchStageConnectionUpdate();
        }

        // Throttle auto-reconnection attempts with progressive backoff (2s up to 5s)
        const timeSinceLastAttempt = now - (stageConnectionState.lastReconnectTime || 0);
        const backoffInterval = Math.min(2000 * Math.pow(1.2, Math.min(stageConnectionState.reconnectAttempts, 4)), 5000);

        if (timeSinceLastAttempt >= backoffInterval) {
          attemptStageReconnect(false);
        }
      }
    }, 1000);
  }

  const handleWake = () => {
    const silent = Date.now() - (stageConnectionState.lastHeartbeat || 0);
    if (silent > 3500) {
      attemptStageReconnect(true);
    }
  };

  window.addEventListener('online', handleWake);
  window.addEventListener('focus', handleWake);

  return () => {
    watchdogRefCount--;
    window.removeEventListener('online', handleWake);
    window.removeEventListener('focus', handleWake);
    if (watchdogRefCount <= 0 && stageWatchdogTimer) {
      clearInterval(stageWatchdogTimer);
      stageWatchdogTimer = null;
      watchdogRefCount = 0;
    }
  };
}

export function useStageConnection() {
  const [connection, setConnection] = useState<StageConnectionState>({ ...stageConnectionState });

  useEffect(() => {
    const cleanupWatchdog = startStageConnectionWatchdog();

    const handleUpdate = (e: any) => {
      if (e?.detail) {
        setConnection({ ...e.detail });
      }
    };

    window.addEventListener('simpleworship:stage-connection-status', handleUpdate);
    return () => {
      cleanupWatchdog();
      window.removeEventListener('simpleworship:stage-connection-status', handleUpdate);
    };
  }, []);

  const reconnect = useCallback(() => {
    return attemptStageReconnect(true);
  }, []);

  return {
    ...connection,
    reconnect
  };
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
      activeRouterId: store.activeRouterId,
      routeActivationStack: store.routeActivationStack,
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

// Global listener for all broadcast events sent across windows
if (typeof window !== 'undefined') {
  window.addEventListener('simpleworship:broadcast-sent', () => {
    syncTelemetry.lastBroadcastTime = Date.now();
    syncTelemetry.messageCount++;
    window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
  });
}

export function executeRemoteCommandLocally(cmd: { action: string; params?: any }) {
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
      store.toggleBlack(store.activeControlGroupId || store.outputGroups[0]?.id || "");
      break;
    case 'toggle_clear':
      store.toggleClear(store.activeControlGroupId || store.outputGroups[0]?.id || "");
      break;
    case 'toggle_logo':
      store.toggleLogo(store.activeControlGroupId || store.outputGroups[0]?.id || "");
      break;
    case 'toggle_live':
    case 'toggle_master_live':
      store.toggleMasterLive(cmd.params?.groupId || store.activeControlGroupId || store.outputGroups[0]?.id || "");
      break;
    case 'commit':
    case 'commit_staged':
      store.commitStagedState(cmd.params?.groupId || store.activeControlGroupId || store.outputGroups[0]?.id || "");
      break;
    case 'go_live':
      store.goLive();
      break;
    case 'select_item':
    case 'go_live_item':
      if (cmd.params?.itemId) {
        store.goLiveItem(cmd.params.itemId, cmd.params.slideIndex || 0, store.activeControlGroupId || store.outputGroups[0]?.id || "");
      }
      break;
    case 'select_slide':
    case 'go_live_slide':
      if (cmd.params?.slideIndex !== undefined) {
        store.goLiveSlide(cmd.params.slideIndex, store.activeControlGroupId || store.outputGroups[0]?.id || "");
      }
      break;
    case 'set_alert':
      if (cmd.params) {
        store.setAlert({
          active: cmd.params.active ?? cmd.params.enabled ?? true,
          message: cmd.params.message || cmd.params.text || store.alert.message,
          position: cmd.params.position || store.alert.position || 'bottom',
          backgroundColor: cmd.params.backgroundColor || store.alert.backgroundColor,
          textColor: cmd.params.textColor || store.alert.textColor
        }, store.activeControlGroupId || store.outputGroups[0]?.id || "");
      }
      break;
    case 'set_nursery':
      if (cmd.params) {
        store.setAlert({
          showNursery: cmd.params.active ?? true,
          nurseryText: cmd.params.code || cmd.params.nurseryText || ''
        }, store.activeControlGroupId || store.outputGroups[0]?.id || "");
      }
      break;
    case 'clear_alert':
      store.setAlert({ active: false, showNursery: false }, store.activeControlGroupId || store.outputGroups[0]?.id || "");
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
    const payload = sanitizeForSync({
      groupStates: store.groupStates,
      alert: store.alert,
      activeSchedule: store.activeSchedule,
      activeControlGroupId: store.activeControlGroupId,
      outputGroups: store.outputGroups,
      themesList: store.themesList,
      systemOptions: store.systemOptions
    });
    
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
    // Start connection watchdog for projector and stage displays
    startStageConnectionWatchdog();

    // Projector listens for real-time state updates across all channel message types
    subscribeToBroadcast((payload) => {
      if (!payload) return;

      // Track connection health
      stageConnectionState.lastHeartbeat = Date.now();
      if (payload.timestamp) {
        stageConnectionState.latency = Math.max(1, Math.min(999, Date.now() - payload.timestamp));
      }
      if (stageConnectionState.status !== 'connected') {
        stageConnectionState.status = 'connected';
        stageConnectionState.reconnectAttempts = 0;
        stageConnectionState.error = null;
        dispatchStageConnectionUpdate();
      }

      if (payload.type === 'HEARTBEAT') {
        return;
      }

      if (!payload.data) return;
      syncTelemetry.lastReceivedTime = Date.now();
      syncTelemetry.messageCount++;

      const data = payload.data;

      if (payload.type === 'SYNC_STATE') {
        const currentGroupStates = useStore.getState().groupStates || {};
        const incomingGroupStates = data.groupStates;
        const mergedGroupStates = (incomingGroupStates && typeof incomingGroupStates === 'object' && Object.keys(incomingGroupStates).length > 0)
          ? { ...currentGroupStates, ...incomingGroupStates }
          : currentGroupStates;

        useStore.setState({
          groupStates: mergedGroupStates,
          alert: data.alert || useStore.getState().alert,
          ...(data.annotationState ? { annotationState: data.annotationState } : {}),
          ...(data.activeRouterId !== undefined ? { activeRouterId: data.activeRouterId } : {}),
          ...(data.activeControlGroupId !== undefined ? { activeControlGroupId: data.activeControlGroupId } : {}),
          ...(data.routeActivationStack && Array.isArray(data.routeActivationStack) && data.routeActivationStack.length > 0 ? { routeActivationStack: data.routeActivationStack } : {}),
          ...(data.outputGroups && Array.isArray(data.outputGroups) && data.outputGroups.length > 0 ? { outputGroups: data.outputGroups } : {}),
          ...(data.routerPanels && Array.isArray(data.routerPanels) && data.routerPanels.length > 0 ? { routerPanels: data.routerPanels } : {}),
          ...(data.activeSchedule ? { activeSchedule: data.activeSchedule } : {}),
          ...(data.themesList ? { themesList: data.themesList } : {}),
          ...(data.systemOptions ? { systemOptions: data.systemOptions } : {})
        });
      } else if (payload.type === 'GROUP_STATES_UPDATE' || payload.type === 'PREVIEW_UPDATE') {
        const currentGroupStates = useStore.getState().groupStates || {};
        if (data.groupStates && typeof data.groupStates === 'object' && Object.keys(data.groupStates).length > 0) {
          useStore.setState({ 
            groupStates: {
              ...currentGroupStates,
              ...data.groupStates
            },
            ...(data.routeActivationStack && Array.isArray(data.routeActivationStack) && data.routeActivationStack.length > 0 ? { routeActivationStack: data.routeActivationStack } : {}),
            ...(data.outputGroups && Array.isArray(data.outputGroups) && data.outputGroups.length > 0 ? { outputGroups: data.outputGroups } : {}),
            ...(data.routerPanels && Array.isArray(data.routerPanels) && data.routerPanels.length > 0 ? { routerPanels: data.routerPanels } : {}),
          });
        } else if (data.groupId && (data.isLiveEnabled !== undefined || data.activeItemId !== undefined)) {
          const currentGroupStates = useStore.getState().groupStates || {};
          let nextStack = useStore.getState().routeActivationStack || [];
          if (data.isLiveEnabled === true) {
            nextStack = [data.groupId, ...nextStack.filter(id => id !== data.groupId)];
          }
          useStore.setState({
            groupStates: {
              ...currentGroupStates,
              [data.groupId]: {
                ...(currentGroupStates[data.groupId] || {}),
                ...data
              }
            },
            ...(data.isLiveEnabled === true ? { routeActivationStack: nextStack } : {})
          });
        }
      } else if (payload.type === 'GO_LIVE') {
        if (data.groupId && data.state) {
          const currentGroupStates = useStore.getState().groupStates || {};
          const currentStack = useStore.getState().routeActivationStack || [];
          const nextStack = [data.groupId, ...currentStack.filter(id => id !== data.groupId)];
          useStore.setState({
            groupStates: {
              ...currentGroupStates,
              [data.groupId]: {
                ...(currentGroupStates[data.groupId] || {}),
                ...data.state
              }
            },
            routeActivationStack: nextStack
          });
        }
      } else if (payload.type === 'SCHEDULE_UPDATE') {
        if (data.activeSchedule) {
          useStore.setState({ activeSchedule: data.activeSchedule });
        }
      } else if (payload.type === 'SYSTEM_UPDATE' || payload.type === 'SYSTEM_OPTIONS') {
        if (data.systemOptions) {
          useStore.setState({ systemOptions: data.systemOptions });
        }
      } else if (payload.type === 'ALERT_UPDATE') {
        if (data.alert) {
          useStore.setState({ alert: data.alert });
        }
      } else if (payload.type === 'ALERT_PRESETS_UPDATE') {
        if (data.presets && Array.isArray(data.presets)) {
          useStore.setState({ alertPresets: data.presets });
        }
      } else if (payload.type === 'ANNOTATION_UPDATE') {
        if (data.annotationState) {
          useStore.setState({ annotationState: data.annotationState });
        }
      }

      window.dispatchEvent(new CustomEvent('simpleworship:sync-update', { detail: { ...syncTelemetry } }));
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
    // Moderator broadcasts a periodic heartbeat so stage display can verify active engine connectivity
    const sendHeartbeat = () => {
      broadcastStateChange({
        type: 'HEARTBEAT',
        data: {
          timestamp: Date.now(),
          engine: 'simpleworship_master',
          uptime: performance.now()
        }
      });
    };
    sendHeartbeat();
    setInterval(sendHeartbeat, 2500);

    // Moderator listens for requests and broadcasts updates
    subscribeToBroadcast((payload) => {
      if (payload.type === 'REQUEST_STATE') {
        const store = useStore.getState();
        broadcastStateChange({
          type: 'SYNC_STATE',
          data: {
            groupStates: store.groupStates,
            activeControlGroupId: store.activeControlGroupId,
            activeRouterId: store.activeRouterId,
            routerPanels: store.routerPanels,
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

    // Adaptive Polling for REST sync & Remote Command execution
    let isFetchingSync = false;
    let consecutiveSyncFailures = 0;
    let pollTimer: any = null;

    const runPoll = async () => {
      if (!isHttpServerAvailable() || isFetchingSync) {
        pollTimer = setTimeout(runPoll, 3000);
        return;
      }
      isFetchingSync = true;
      try {
        const res = await fetch('/api/sync/state');
        if (res.ok) {
          consecutiveSyncFailures = 0;
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
              const currentStates = useStore.getState().groupStates || {};
              const mergedGroupStates = serverState.groupStates ? { ...serverState.groupStates } : { ...currentStates };
              
              // Preserve local binary arrays and fileBytes if server payload stripped them
              for (const gid of Object.keys(mergedGroupStates)) {
                const curState = currentStates[gid];
                const newState = mergedGroupStates[gid];
                if (curState?.directLiveItem?.data?.fileBytes && newState?.directLiveItem?.data && !newState.directLiveItem.data.fileBytes) {
                  newState.directLiveItem.data.fileBytes = curState.directLiveItem.data.fileBytes;
                }
              }

              useStore.setState({
                groupStates: mergedGroupStates,
                alert: serverState.alert || useStore.getState().alert,
                ...(serverState.activeSchedule ? { activeSchedule: serverState.activeSchedule } : {})
              });
            }
          }
        } else {
          consecutiveSyncFailures++;
        }
      } catch (err) {
        consecutiveSyncFailures++;
      } finally {
        isFetchingSync = false;
        // Adaptive backoff: 2000ms on success, exponentially scales to 8000ms on network failures
        const nextDelay = consecutiveSyncFailures > 2 
          ? Math.min(8000, 2000 + consecutiveSyncFailures * 1000) 
          : 2000;
        pollTimer = setTimeout(runPoll, nextDelay);
      }
    };

    activeRunPoll = runPoll;
    pollTimer = setTimeout(runPoll, 1500);
  }
}

let activeRunPoll: (() => Promise<void>) | null = null;

export async function triggerSyncPollNow() {
  if (activeRunPoll) {
    await activeRunPoll();
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
