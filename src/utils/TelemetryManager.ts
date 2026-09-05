export interface TelemetrySnapshot {
  metrics: Record<string, number>;
  frames: { count: number; averageDuration: number; longFrames: number };
  memory?: { jsHeapSizeLimit: number; totalJSHeapSize: number; usedJSHeapSize: number } | 'Unavailable';
}

class TelemetryManagerImpl {
  private enabled = false;
  private frameCount = 0;
  private longFrames = 0;
  private lastFrameTime = 0;
  private frameDurations: number[] = [];
  private rafId: number | null = null;
  private mediaOps = 0;

  start() {
    if (this.enabled) return;
    this.enabled = true;
    this.clear();
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.recordFrame);
  }

  stop() {
    this.enabled = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  mark(name: string) {
    if (!this.enabled) return;
    try {
      performance.mark(name);
    } catch (e) {}
  }

  measure(name: string, startMark: string, endMark?: string) {
    if (!this.enabled) return;
    try {
      performance.measure(name, startMark, endMark);
    } catch (e) {}
  }

  recordFrame = (timestamp: number) => {
    if (!this.enabled) return;
    if (this.lastFrameTime !== 0) {
      const delta = timestamp - this.lastFrameTime;
      this.frameCount++;
      this.frameDurations.push(delta);
      if (this.frameDurations.length > 300) {
        this.frameDurations.shift(); // Keep last 300 frames (~5 seconds at 60fps)
      }
      if (delta > 33.4) { // Target is 16.6ms for 60fps. > 33.4ms means at least one dropped frame (under 30fps)
        this.longFrames++;
      }
    }
    this.lastFrameTime = timestamp;
    this.rafId = requestAnimationFrame(this.recordFrame);
  };

  recordMediaOperation() {
    if (!this.enabled) return;
    this.mediaOps++;
  }

  recordMemorySample() {
    if (!this.enabled) return;
    // Memory sampling logic (hooked into getSnapshot for actual values)
  }

  getSnapshot(): TelemetrySnapshot {
    const perfMemory = (performance as any).memory;
    const avgDuration = this.frameDurations.length > 0 
      ? this.frameDurations.reduce((a, b) => a + b, 0) / this.frameDurations.length 
      : 0;

    return {
      metrics: {
        mediaOperations: this.mediaOps,
      },
      frames: {
        count: this.frameCount,
        averageDuration: avgDuration,
        longFrames: this.longFrames
      },
      memory: perfMemory ? {
        jsHeapSizeLimit: perfMemory.jsHeapSizeLimit,
        totalJSHeapSize: perfMemory.totalJSHeapSize,
        usedJSHeapSize: perfMemory.usedJSHeapSize
      } : 'Unavailable'
    };
  }

  clear() {
    this.frameCount = 0;
    this.longFrames = 0;
    this.lastFrameTime = 0;
    this.frameDurations = [];
    this.mediaOps = 0;
    try {
      performance.clearMarks();
      performance.clearMeasures();
    } catch (e) {}
  }
}

export const TelemetryManager = new TelemetryManagerImpl();
