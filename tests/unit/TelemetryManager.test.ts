import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryManager } from '../../src/utils/TelemetryManager';

describe('TelemetryManager', () => {
  beforeEach(() => {
    TelemetryManager.clear();
    TelemetryManager.stop();
  });

  afterEach(() => {
    TelemetryManager.stop();
    TelemetryManager.clear();
  });

  it('starts and stops safely', () => {
    TelemetryManager.start();
    const snapshot1 = TelemetryManager.getSnapshot();
    expect(snapshot1).toBeDefined();

    TelemetryManager.stop();
  });

  it('records marks and measures without throwing', () => {
    TelemetryManager.start();
    expect(() => {
      TelemetryManager.mark('start-test');
      TelemetryManager.mark('end-test');
      TelemetryManager.measure('test-measure', 'start-test', 'end-test');
    }).not.toThrow();
  });

  it('does not record when disabled', () => {
    TelemetryManager.recordMediaOperation();
    const snapshot = TelemetryManager.getSnapshot();
    expect(snapshot.metrics.mediaOperations).toBe(0);
  });

  it('records media operations when enabled', () => {
    TelemetryManager.start();
    TelemetryManager.recordMediaOperation();
    const snapshot = TelemetryManager.getSnapshot();
    expect(snapshot.metrics.mediaOperations).toBe(1);
  });

  it('detects memory capabilities gracefully', () => {
    const snapshot = TelemetryManager.getSnapshot();
    if ((performance as any).memory) {
      expect(snapshot.memory).not.toBe('Unavailable');
    } else {
      expect(snapshot.memory).toBe('Unavailable');
    }
  });

  it('clears state correctly', () => {
    TelemetryManager.start();
    TelemetryManager.recordMediaOperation();
    TelemetryManager.clear();
    const snapshot = TelemetryManager.getSnapshot();
    expect(snapshot.metrics.mediaOperations).toBe(0);
  });
});
