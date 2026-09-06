import { useState, useEffect, useCallback } from 'react';
import { backendApi, BackendHealth, BackendSystemStatus } from '../services/backendApi';

export function useBackendConnection() {
  const [status, setStatus] = useState(() => backendApi.getStatus());
  const [health, setHealth] = useState<BackendHealth | null>(null);

  useEffect(() => {
    const unsub = backendApi.subscribe((nextStatus) => {
      setStatus({ ...nextStatus, lastPingTime: Date.now() });
    });
    return unsub;
  }, []);

  const refreshHealth = useCallback(async () => {
    const res = await backendApi.checkHealth();
    if (res) setHealth(res);
    return res;
  }, []);

  const pingNow = useCallback(async () => {
    return await backendApi.checkHealth();
  }, []);

  return {
    isOnline: status.isOnline,
    latency: status.latency,
    isSyncing: status.isSyncing,
    health,
    refreshHealth,
    pingNow
  };
}
