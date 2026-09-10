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
  type: 'GROUP_STATES_UPDATE' | 'SCHEDULE_UPDATE' | 'SYSTEM_UPDATE' | 'SYSTEM_OPTIONS' | 'ALERT_UPDATE' | 'ALERT_PRESETS_UPDATE' | 'GO_LIVE' | 'ANNOTATION_UPDATE' | 'LASER_UPDATE' | 'IDENTIFY_DISPLAYS' | 'REQUEST_STATE' | 'SYNC_STATE' | 'PREVIEW_UPDATE';
  data: any;
  timestamp?: number;
  msgId?: string;
}

// Global deduplication cache to eliminate duplicate execution cycles between BroadcastChannel and StorageEvent
const recentProcessedIds = new Set<string>();
const recentProcessedQueue: string[] = [];

function isDuplicateMessage(msg: BroadcastPayload): boolean {
  const id = msg.msgId || `${msg.type}_${msg.timestamp || 0}`;
  if (recentProcessedIds.has(id)) {
    return true;
  }
  recentProcessedIds.add(id);
  recentProcessedQueue.push(id);
  // Keep ring buffer at max 50 entries to prevent memory growth
  if (recentProcessedQueue.length > 50) {
    const oldest = recentProcessedQueue.shift();
    if (oldest) recentProcessedIds.delete(oldest);
  }
  return false;
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
  const now = Date.now();
  const fullPayload: BroadcastPayload = {
    ...payload,
    timestamp: now,
    msgId: payload.msgId || `${payload.type}_${now}_${Math.random().toString(36).slice(2, 7)}`
  };

  // 1. Post to BroadcastChannel (fast in-memory IPC with zero delay and no storage quota)
  // Send fullPayload so ArrayBuffers, TypedArrays (fileBytes), and data URLs are preserved with 1:1 fidelity across windows!
  if (channel) {
    try {
      channel.postMessage(fullPayload);
    } catch (err) {
      try {
        const lightweight = sanitizeForSync(fullPayload);
        channel.postMessage(lightweight);
      } catch (e2) {}
    }
  }

  // Notify window listeners of broadcast telemetry update
  try {
    window.dispatchEvent(new CustomEvent('simpleworship:broadcast-sent', { detail: fullPayload }));
  } catch {}

  // 2. Non-blocking fallback to localStorage for older browsers or cross-origin fallback
  // Executed asynchronously to never block frame rendering or UI interactions
  if (typeof window !== 'undefined' && window.localStorage) {
    setTimeout(() => {
      try {
        const lightweightPayload = sanitizeForSync(fullPayload);
        const jsonString = JSON.stringify(lightweightPayload);
        localStorage.setItem('simpleworship_live_sync_event', jsonString);
      } catch (err: any) {
        if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.number === -2147024882) {
          try {
            localStorage.removeItem('simpleworship_live_sync_event');
            const minimalSignal = {
              type: payload.type,
              timestamp: now,
              msgId: fullPayload.msgId,
              data: { type: payload.type }
            };
            localStorage.setItem('simpleworship_live_sync_event', JSON.stringify(minimalSignal));
          } catch (e) {}
        }
      }
    }, 0);
  }
};

export const subscribeToBroadcast = (callback: (payload: BroadcastPayload) => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (event.data && typeof event.data === 'object') {
      const msg = event.data as BroadcastPayload;
      if (!isDuplicateMessage(msg)) {
        callback(msg);
      }
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === 'simpleworship_live_sync_event' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue) as BroadcastPayload;
        if (parsed && typeof parsed === 'object' && !isDuplicateMessage(parsed)) {
          callback(parsed);
        }
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
