// Helper utility to sync live output presentation state across tabs and projector popup windows
const BROADCAST_CHANNEL_NAME = 'simpleworship_live_channel';

let channel: BroadcastChannel | null = null;
const activeSubscribers = new Set<(payload: BroadcastPayload) => void>();

function dispatchToSubscribers(msg: BroadcastPayload) {
  if (isDuplicateMessage(msg)) return;
  activeSubscribers.forEach((cb) => {
    try {
      cb(msg);
    } catch (err) {
      console.error('[BroadcastSync] Subscriber error:', err);
    }
  });
}

function handleChannelMessage(event: MessageEvent) {
  if (event.data && typeof event.data === 'object') {
    const msg = event.data as BroadcastPayload;
    dispatchToSubscribers(msg);
  }
}

function handleChannelError(e: MessageEvent | Event) {
  console.warn('[BroadcastSync] BroadcastChannel encountered an error, triggering auto-reconnect:', e);
  reconnectBroadcastChannel();
}

export function initBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return null;
  }

  try {
    if (channel) {
      try {
        channel.removeEventListener('message', handleChannelMessage);
        channel.removeEventListener('messageerror', handleChannelError);
        channel.close();
      } catch {}
    }

    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.addEventListener('message', handleChannelMessage);
    channel.addEventListener('messageerror', handleChannelError);
    return channel;
  } catch (e) {
    console.error('[BroadcastSync] BroadcastChannel initialization error:', e);
    return null;
  }
}

// Initial boot
if (typeof window !== 'undefined') {
  initBroadcastChannel();

  // Watch for tab wakeups and network changes to maintain live channel health
  window.addEventListener('online', () => {
    reconnectBroadcastChannel();
  });
  window.addEventListener('focus', () => {
    if (!channel) {
      reconnectBroadcastChannel();
    }
  });
}

export function getBroadcastChannel(): BroadcastChannel | null {
  if (!channel && typeof window !== 'undefined') {
    return initBroadcastChannel();
  }
  return channel;
}

export function reconnectBroadcastChannel(): BroadcastChannel | null {
  const newChan = initBroadcastChannel();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('simpleworship:broadcast-channel-reconnected', {
      detail: { timestamp: Date.now() }
    }));
  }
  return newChan;
}

export interface BroadcastPayload {
  type: 'GROUP_STATES_UPDATE' | 'SCHEDULE_UPDATE' | 'SYSTEM_UPDATE' | 'SYSTEM_OPTIONS' | 'SYSTEM_OVERLAY_UPDATE' | 'ALERT_UPDATE' | 'ALERT_PRESETS_UPDATE' | 'GO_LIVE' | 'ANNOTATION_UPDATE' | 'LASER_UPDATE' | 'IDENTIFY_DISPLAYS' | 'REQUEST_STATE' | 'SYNC_STATE' | 'PREVIEW_UPDATE' | 'HEARTBEAT' | 'HEARTBEAT_ACK';
  data: any;
  timestamp?: number;
  msgId?: string;
}

// Global deduplication cache to eliminate duplicate execution cycles between BroadcastChannel and StorageEvent
const recentProcessedIds = new Set<string>();
const recentProcessedQueue: string[] = [];
let broadcastSeqCounter = 0;

function isDuplicateMessage(msg: BroadcastPayload): boolean {
  if (msg.type === 'HEARTBEAT' || msg.type === 'HEARTBEAT_ACK') {
    return false;
  }
  if (!msg.msgId) {
    return false;
  }
  if (recentProcessedIds.has(msg.msgId)) {
    return true;
  }
  recentProcessedIds.add(msg.msgId);
  recentProcessedQueue.push(msg.msgId);
  // Keep ring buffer at max 100 entries to prevent memory growth
  if (recentProcessedQueue.length > 100) {
    const oldest = recentProcessedQueue.shift();
    if (oldest) recentProcessedIds.delete(oldest);
  }
  return false;
}

// Enterprise-grade safe cloner for BroadcastChannel (fast in-memory structured clone)
// Strips functions, DOM elements, and symbols while keeping complete pristine data URLs,
// renderFrame canonical layouts, typed arrays, and nested structures with zero corruption.
export function cloneSafeForBroadcast(val: any, seen = new WeakSet(), depth = 0): any {
  if (val === null || val === undefined) return val;
  if (depth > 16) return undefined;

  const t = typeof val;
  if (t === 'string' || t === 'number' || t === 'boolean') return val;
  if (t === 'function' || t === 'symbol') return undefined;

  // Handle DOM nodes and window objects
  if (typeof Node !== 'undefined' && val instanceof Node) return undefined;
  if (typeof Window !== 'undefined' && val instanceof Window) return undefined;

  // Preserve binary buffers and typed arrays
  if (
    val instanceof Uint8Array ||
    val instanceof ArrayBuffer ||
    (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(val))
  ) {
    return val;
  }

  if (typeof val === 'object') {
    if (seen.has(val)) return undefined;
    seen.add(val);

    if (Array.isArray(val)) {
      return val.map(item => cloneSafeForBroadcast(item, seen, depth + 1));
    }

    const copy: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      const cloned = cloneSafeForBroadcast(val[key], seen, depth + 1);
      if (cloned !== undefined) {
        copy[key] = cloned;
      }
    }
    return copy;
  }

  return undefined;
}

// Lightweight sanitizer for localStorage fallback ONLY (quota constrained to 5MB)
// Crucial: NEVER truncate a data URL with a corrupt marker string!
// If too large for localStorage, omit it cleanly (undefined) so decoders never receive broken bytes.
export const sanitizeForSync = (val: any, seen = new WeakSet(), depth = 0): any => {
  if (val === null || val === undefined) return val;
  if (depth > 12) return undefined;

  if (typeof val === 'string') {
    // Large data URLs (> 64KB) shouldn't blow up localStorage quota; omit them cleanly instead of corrupting them
    if (val.startsWith('data:') && val.length > 65536) {
      return undefined;
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

  if (seen.has(val)) return undefined;
  seen.add(val);

  if (Array.isArray(val)) {
    if (val.length > 200 && typeof val[0] === 'number') {
      return undefined;
    }
    return val.map(item => sanitizeForSync(item, seen, depth + 1)).filter(x => x !== undefined);
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(val)) {
    // Strip heavy raw binary buffers from disk storage
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

    const sanitized = sanitizeForSync(item, seen, depth + 1);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }

  return result;
};

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key: string, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return;
      seen.add(value);
    }
    return value;
  };
};

export const broadcastStateChange = (payload: BroadcastPayload) => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const seq = ++broadcastSeqCounter;
  const fullPayload: BroadcastPayload = {
    ...payload,
    timestamp: now,
    msgId: payload.msgId || `${payload.type}_${now}_${seq}_${Math.random().toString(36).slice(2, 7)}`
  };

  // 1. Post to BroadcastChannel (fast in-memory IPC with zero delay and no storage quota)
  // Use cloneSafeForBroadcast to ensure complete fidelity without DataCloneError
  const activeChannel = getBroadcastChannel();
  if (activeChannel) {
    try {
      const safePayload = cloneSafeForBroadcast(fullPayload);
      activeChannel.postMessage(safePayload || fullPayload);
    } catch (err) {
      try {
        const lightweight = sanitizeForSync(fullPayload);
        activeChannel.postMessage(lightweight);
      } catch (e2) {
        try {
          const ultraLight = JSON.parse(JSON.stringify(sanitizeForSync(fullPayload), getCircularReplacer()));
          activeChannel.postMessage(ultraLight);
        } catch (e3) {
          reconnectBroadcastChannel();
        }
      }
    }
  }

  // Notify window listeners of broadcast telemetry update
  try {
    window.dispatchEvent(new CustomEvent('simpleworship:broadcast-sent', { detail: fullPayload }));
  } catch {}

  // 2. Non-blocking fallback to localStorage for older browsers or cross-origin fallback
  // Executed asynchronously to never block frame rendering or UI interactions
  // Heartbeats and high-frequency laser pointer tracking are purely in-memory IPC and do not need disk storage writes
  if (typeof window !== 'undefined' && window.localStorage && payload.type !== 'HEARTBEAT' && payload.type !== 'HEARTBEAT_ACK' && payload.type !== 'LASER_UPDATE') {
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

  activeSubscribers.add(callback);

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

  window.addEventListener('storage', handleStorage);

  return () => {
    activeSubscribers.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
};
