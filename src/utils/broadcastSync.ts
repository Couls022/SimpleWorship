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
  type: 'GROUP_STATES_UPDATE' | 'SCHEDULE_UPDATE' | 'SYSTEM_UPDATE' | 'SYSTEM_OPTIONS' | 'ALERT_UPDATE' | 'ALERT_PRESETS_UPDATE' | 'GO_LIVE' | 'ANNOTATION_UPDATE' | 'LASER_UPDATE' | 'IDENTIFY_DISPLAYS' | 'REQUEST_STATE' | 'SYNC_STATE' | 'PREVIEW_UPDATE' | 'HEARTBEAT' | 'HEARTBEAT_ACK';
  data: any;
  timestamp?: number;
  msgId?: string;
}

// Global deduplication cache to eliminate duplicate execution cycles between BroadcastChannel and StorageEvent
const recentProcessedIds = new Set<string>();
const recentProcessedQueue: string[] = [];

function isDuplicateMessage(msg: BroadcastPayload): boolean {
  if (msg.type === 'HEARTBEAT' || msg.type === 'HEARTBEAT_ACK') {
    return false;
  }
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
      key === '_raw' ||
      key === 'renderFrame'
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
  const fullPayload: BroadcastPayload = {
    ...payload,
    timestamp: now,
    msgId: payload.msgId || `${payload.type}_${now}_${Math.random().toString(36).slice(2, 7)}`
  };

  // DEBUG PAYLOAD VALIDATION (Phase 10-B)
  if (process.env.NODE_ENV === 'development' && payload.type !== 'HEARTBEAT' && payload.type !== 'HEARTBEAT_ACK') {
    try {
      const serialized = JSON.stringify(fullPayload);
      const sizeKB = (serialized.length / 1024).toFixed(2);
      const hasFileBytes = serialized.includes('"fileBytes"');
      const hasUint8Array = serialized.includes('Uint8Array'); // Just string check on serialization for simplicity
      const hasBase64 = serialized.length > 500000; // rough heuristic
      console.log(`[IPC Debug] ${payload.type} | Size: ${sizeKB}KB | fileBytes: ${hasFileBytes} | largeBase64: ${hasBase64}`);
    } catch(e) {}
  }

  // 1. Post to BroadcastChannel (fast in-memory IPC with zero delay and no storage quota)
  // Send fullPayload so ArrayBuffers, TypedArrays (fileBytes), and data URLs are preserved with 1:1 fidelity across windows!
  const activeChannel = getBroadcastChannel();
  if (activeChannel) {
    try {
      activeChannel.postMessage(fullPayload);
    } catch (err) {
      try {
        const lightweight = sanitizeForSync(fullPayload);
        activeChannel.postMessage(lightweight);
      } catch (e2) {
        // Ultimate fallback to guarantee delivery via BroadcastChannel:
        // JSON stringification natively strips any lingering uncloneable objects (functions, DOM nodes, etc.)
        try {
          const ultraLight = JSON.parse(JSON.stringify(sanitizeForSync(fullPayload), getCircularReplacer()));
          activeChannel.postMessage(ultraLight);
        } catch (e3) {
          // If the channel was closed or broken, re-establish it
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
  // Heartbeats are purely in-memory IPC and do not need disk storage writes
  if (typeof window !== 'undefined' && window.localStorage && payload.type !== 'HEARTBEAT' && payload.type !== 'HEARTBEAT_ACK') {
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
