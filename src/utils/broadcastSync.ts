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
  type: 'GROUP_STATES_UPDATE' | 'SCHEDULE_UPDATE' | 'SYSTEM_UPDATE' | 'SYSTEM_OPTIONS' | 'ALERT_UPDATE' | 'GO_LIVE';
  data: any;
  timestamp?: number;
}

export const broadcastStateChange = (payload: BroadcastPayload) => {
  if (typeof window === 'undefined') return;
  const fullPayload = { ...payload, timestamp: Date.now() };

  try {
    if (channel) {
      channel.postMessage(fullPayload);
    }
  } catch (err) {
    console.error('Error posting to BroadcastChannel:', err);
  }

  try {
    localStorage.setItem('simpleworship_live_sync_event', JSON.stringify(fullPayload));
  } catch (err) {
    console.error('Error writing live sync event to localStorage:', err);
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
