import { slideRenderCache } from '../utils/SlideRenderCache';
import { gpuDiagnosticsEngine, GpuDiagnosticInfo } from './GpuDiagnostics';

export type HardwareTier = 'high' | 'medium' | 'eco';

export interface HardwareInfo {
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  cpuSpeedMhz?: number;
  totalRamMb: number;
  freeRamMb: number;
  usedRamMb: number;
  processMemMb?: number | null;
  gpuRenderer: string;
  gpuVendor: string;
  isHardwareAccelerated: boolean;
  directXStatus: string;
  tier: HardwareTier;
  gpuDiagnostics?: GpuDiagnosticInfo;
}

class HardwareProfileManager {
  private static instance: HardwareProfileManager;
  private info: HardwareInfo | null = null;
  private listeners: Array<(info: HardwareInfo) => void> = [];
  private isInitialized = false;

  private constructor() {
    this.detectHardware();
  }

  public static getInstance(): HardwareProfileManager {
    if (!HardwareProfileManager.instance) {
      HardwareProfileManager.instance = new HardwareProfileManager();
    }
    return HardwareProfileManager.instance;
  }

  public async detectHardware(): Promise<HardwareInfo> {
    let cpuModel = 'Standard CPU';
    let cpuCores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
    let cpuSpeedMhz = 0;
    let totalRamMb = 8192;
    let freeRamMb = 4096;
    let usedRamMb = 4096;
    let processMemMb: number | null = null;
    let gpuRenderer = 'Hardware Accelerated GPU';
    let gpuVendor = 'Vendor';
    let isHardwareAccelerated = true;
    let directXStatus = 'Direct3D 11 Active';
    let platform = typeof navigator !== 'undefined' ? (navigator.platform || 'win32') : 'win32';
    let arch = 'x64';

    // 1. Try Native Electron Hardware API (Direct hardware access to CPU, RAM, & Drivers)
    const electron = (window as any)?.electronAPI;
    if (electron && typeof electron.getHardwareInfo === 'function') {
      try {
        const nativeInfo = await electron.getHardwareInfo();
        if (nativeInfo && nativeInfo.success) {
          platform = nativeInfo.platform || platform;
          arch = nativeInfo.arch || arch;
          cpuModel = nativeInfo.cpuModel || cpuModel;
          cpuCores = nativeInfo.cpuCores || cpuCores;
          cpuSpeedMhz = nativeInfo.cpuSpeedMhz || cpuSpeedMhz;
          totalRamMb = nativeInfo.totalRamMb || totalRamMb;
          freeRamMb = nativeInfo.freeRamMb || freeRamMb;
          usedRamMb = nativeInfo.usedRamMb || usedRamMb;
          processMemMb = nativeInfo.processMemMb || null;
          isHardwareAccelerated = nativeInfo.isHardwareAccelerated ?? true;
          directXStatus = nativeInfo.directXStatus || directXStatus;

          if (nativeInfo.gpuInfo && nativeInfo.gpuInfo.auxAttributes) {
            const aux = nativeInfo.gpuInfo.auxAttributes;
            gpuRenderer = aux.glRenderer || gpuRenderer;
            gpuVendor = aux.glVendor || gpuVendor;
          }
        }
      } catch (e) {
        console.warn('[HardwareProfile] Electron hardware query error:', e);
      }
    }

    // 2. Browser GPU Diagnostics Engine
    let gpuDiag: GpuDiagnosticInfo | undefined = undefined;
    try {
      gpuDiag = await gpuDiagnosticsEngine.runDiagnostics();
      if (gpuDiag) {
        if (gpuDiag.gpuDevice && gpuDiag.gpuDevice !== 'Unknown GPU Device') {
          gpuRenderer = gpuDiag.gpuDevice;
        }
        if (gpuDiag.gpuVendor && gpuDiag.gpuVendor !== 'Unknown Vendor') {
          gpuVendor = gpuDiag.gpuVendor;
        }
        isHardwareAccelerated = !gpuDiag.isSoftwareRendering && gpuDiag.webglStatus !== 'Disabled / Unsupported';
        directXStatus = gpuDiag.isSoftwareRendering
          ? 'Software Rasterization Active'
          : `${gpuDiag.webglStatus} | ${gpuDiag.hardwareCompositingStatus}`;
      }
    } catch (e) {
      console.warn('[HardwareProfile] GPU Diagnostics engine error:', e);
    }

    // 3. Device Memory & JS Heap Detection (Browser, Backend Bridge & Electron fallback)
    if ((navigator as any)?.deviceMemory) {
      const devMemGb = (navigator as any).deviceMemory;
      if (totalRamMb === 8192) {
        totalRamMb = devMemGb * 1024;
        freeRamMb = Math.round(totalRamMb * 0.5);
        usedRamMb = Math.round(totalRamMb * 0.5);
      }
    }

    // Attempt to query real host server hardware specs if running in browser
    try {
      if (typeof fetch !== 'undefined') {
        const sysRes = await fetch('/api/system/status', { cache: 'no-cache' }).catch(() => null);
        if (sysRes && sysRes.ok) {
          const sysData = await sysRes.json();
          if (sysData?.hardware) {
            if (sysData.hardware.totalRamMb && totalRamMb <= 8192) {
              totalRamMb = sysData.hardware.totalRamMb;
              freeRamMb = sysData.hardware.freeRamMb || Math.round(totalRamMb * 0.4);
              usedRamMb = totalRamMb - freeRamMb;
            }
            if (sysData.hardware.cpuModel && (cpuModel === 'Standard CPU' || !cpuModel)) {
              cpuModel = sysData.hardware.cpuModel;
            }
            if (sysData.hardware.cpuCores && cpuCores <= 4) {
              cpuCores = sysData.hardware.cpuCores;
            }
          }
        }
      }
    } catch {}

    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      if (mem.usedJSHeapSize) {
        processMemMb = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      }
    }

    // 4. Calculate Hardware Tier based on CPU, RAM, & GPU capability
    let tier: HardwareTier = 'high';
    const isSwiftShader = gpuRenderer.toLowerCase().includes('swiftshader') || gpuRenderer.toLowerCase().includes('software') || gpuRenderer.toLowerCase().includes('llvmpipe');
    const isIntelIntegrated = gpuRenderer.toLowerCase().includes('intel') && !gpuRenderer.toLowerCase().includes('arc');
    const hasDedicatedGpu = /nvidia|geforce|radeon|rtx|gtx|quadro|amd|apple|m1|m2|m3|m4|arc/i.test(gpuRenderer);

    // Adjust total RAM estimate if browser clamped deviceMemory for privacy
    if ((hasDedicatedGpu || cpuCores >= 8) && totalRamMb < 8192) {
      totalRamMb = 8192;
      freeRamMb = Math.round(totalRamMb * 0.55);
      usedRamMb = totalRamMb - freeRamMb;
    }

    if (isSwiftShader || (cpuCores <= 2 && totalRamMb < 3000 && !hasDedicatedGpu)) {
      tier = 'eco'; // Low-spec laptop or software-only rasterization
    } else if (hasDedicatedGpu || cpuCores >= 8 || (totalRamMb >= 8000 && !isIntelIntegrated)) {
      tier = 'high'; // Dedicated NVIDIA/AMD GPU or high-performance 8+ thread multi-core CPU
    } else {
      tier = 'medium'; // Standard office/church laptop with integrated graphics
    }

    // 5. Automatically tune system components and GPU acceleration according to detected hardware
    const maxCacheFrames = tier === 'eco' ? 8 : tier === 'medium' ? 16 : 28;
    slideRenderCache.setMaxCacheSize(maxCacheFrames);

    // Apply hardware acceleration CSS flags to document root
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('hw-tier-eco', 'hw-tier-medium', 'hw-tier-high');
      root.classList.add(`hw-tier-${tier}`);
      if (isHardwareAccelerated) {
        root.classList.add('gpu-accelerated');
      } else {
        root.classList.remove('gpu-accelerated');
      }
    }

    const hardwareInfo: HardwareInfo = {
      platform,
      arch,
      cpuModel,
      cpuCores,
      cpuSpeedMhz,
      totalRamMb,
      freeRamMb,
      usedRamMb,
      processMemMb,
      gpuRenderer,
      gpuVendor,
      isHardwareAccelerated,
      directXStatus,
      tier,
      gpuDiagnostics: gpuDiag
    };

    this.info = hardwareInfo;
    this.isInitialized = true;
    this.notifyListeners(hardwareInfo);
    return hardwareInfo;
  }

  public getHardwareInfoSync(): HardwareInfo {
    if (this.info) return this.info;

    // Default baseline while async query completes
    return {
      platform: 'win32',
      arch: 'x64',
      cpuModel: 'Detecting CPU...',
      cpuCores: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4,
      totalRamMb: 8192,
      freeRamMb: 4096,
      usedRamMb: 4096,
      gpuRenderer: 'DirectX Hardware Accelerated',
      gpuVendor: 'GPU Vendor',
      isHardwareAccelerated: true,
      directXStatus: 'Direct3D 11 Active',
      tier: 'medium'
    };
  }

  public shouldSimplifyBlur(): boolean {
    const info = this.getHardwareInfoSync();
    return info.tier === 'eco';
  }

  public onHardwareChanged(cb: (info: HardwareInfo) => void): () => void {
    this.listeners.push(cb);
    if (this.info) {
      cb(this.info);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notifyListeners(info: HardwareInfo) {
    for (const listener of this.listeners) {
      try {
        listener(info);
      } catch (e) {
        console.error('[HardwareProfile] Listener error:', e);
      }
    }
  }
}

export const hardwareProfile = HardwareProfileManager.getInstance();
