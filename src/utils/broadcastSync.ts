// Helper utility to sync live output presentation state across tabs and projector popup windows
const BROADCAST_CHANNEL_NAME = 'simpleworship_live_channel';

let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch (e) {
    console.error('BroadcastChannel initialization error:', e);
  }
}

export interface BroadcastPayload {
  type: 'GROUP_STATES_UPDATE' | 'SCHEDULE_UPDATE' | 'SYSTEM_UPDATE' | 'SYSTEM_OPTIONS' | 'ALERT_UPDATE' | 'GO_LIVE' | 'ANNOTATION_UPDATE' | 'LASER_UPDATE' | 'IDENTIFY_DISPLAYS' | 'REQUEST_STATE' | 'SYNC_STATE' | 'PREVIEW_UPDATE';
  data: any;
  timestamp?: number;
}

// Helper to recursively strip heavy binary buffers, TypedArrays, base64 data URLs, and bloated structures
export const sanitizeForSync = (val: any, depth = 0): any => {
  if (val === null || val === undefined) return val;
  if (depth > 12) return undefined;

  if (typeof val === 'string') {
    if (val.startsWith('data:') && val.length > 1024) {
      return val.slice(0, 128) + '...[TRUNCATED_DATA_URL]';
    }
    return val;
  }

  if (typeof val !== 'object') return val;

  if (
    val instanceof Uint8Array ||
    val instanceof ArrayBuffer ||
    (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(val))
  ) {
    return undefined;
  }

  if (Array.isArray(val)) {
    if (val.length > 200 && typeof val[0] === 'number') {
      return undefined;
    }
    return val.map(item => sanitizeForSync(item, depth + 1));
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(val)) {
    if (
      key === 'fileBytes' ||
      key === 'buffer' ||
      key === 'rawBytes' ||
      key === 'binaryData' ||
      key === '_raw'
    ) {
      continue;
    }

    const item = val[key];
    if (
      item instanceof Uint8Array ||
      item instanceof ArrayBuffer ||
      (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(item))
    ) {
      continue;
    }

    result[key] = sanitizeForSync(item, depth + 1);
  }

  return result;
};

export const broadcastStateChange = (payload: BroadcastPayload) => {
  if (typeof window === 'undefined') return;
  const fullPayload = { ...payload, timestamp: Date.now() };

  let lightweightPayload: BroadcastPayload;
  try {
    lightweightPayload = sanitizeForSync(fullPayload);
  } catch (err) {
    console.warn('[Sync] Failed to sanitize payload for broadcast:', err);
    lightweightPayload = fullPayload;
  }

  // 1. Post to BroadcastChannel (fast in-memory IPC with no storage quota)
  if (channel) {
    try {
      channel.postMessage(lightweightPayload);
    } catch (err) {
      console.warn('[Sync] Error posting to BroadcastChannel:', err);
    }
  }

  // 2. Safe setItem to localStorage for cross-window StorageEvent listeners
  try {
    const jsonString = JSON.stringify(lightweightPayload);
    localStorage.setItem('simpleworship_live_sync_event', jsonString);
  } catch (err: any) {
    // Gracefully handle QuotaExceededError without throwing unhandled exceptions
    if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.number === -2147024882) {
      try {
        localStorage.removeItem('simpleworship_live_sync_event');
        // Retry with an ultra-lightweight signal
        const minimalSignal = {
          type: payload.type,
          timestamp: Date.now(),
          data: { type: payload.type }
        };
        localStorage.setItem('simpleworship_live_sync_event', JSON.stringify(minimalSignal));
      } catch (e) {
        // Storage completely full from other keys; BroadcastChannel already delivered the event.
      }
    } else {
      console.warn('[Sync] Storage write error:', err);
    }
  }
};

export const subscribeToBroadcast = (callback: (payload: BroadcastPayload) => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (event.data && typeof event.data === 'object') {
      callback(event.data as BroadcastPayload);
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === 'simpleworship_live_sync_event' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        callback(parsed);
      } catch (err) {}
    }
  };

  if (channel) {
    channel.addEventListener('message', handleMessage);
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    if (channel) {
      channel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
  };
};
