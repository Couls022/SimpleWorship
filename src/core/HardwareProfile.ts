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

    // 3. Device Memory API (Browser fallback)
    if ((navigator as any)?.deviceMemory) {
      const devMemGb = (navigator as any).deviceMemory;
      if (totalRamMb === 8192) {
        totalRamMb = devMemGb * 1024;
        freeRamMb = Math.round(totalRamMb * 0.5);
        usedRamMb = Math.round(totalRamMb * 0.5);
      }
    }

    // 4. Calculate Hardware Tier based on CPU, RAM, & GPU capability
    let tier: HardwareTier = 'high';
    const isSwiftShader = gpuRenderer.toLowerCase().includes('swiftshader') || gpuRenderer.toLowerCase().includes('software');
    const isIntelIntegrated = gpuRenderer.toLowerCase().includes('intel') && !gpuRenderer.toLowerCase().includes('arc');

    if (totalRamMb < 4500 || cpuCores <= 2 || isSwiftShader) {
      tier = 'eco'; // Low-spec laptop or software-only rasterization
    } else if (totalRamMb < 12000 || cpuCores <= 4 || isIntelIntegrated) {
      tier = 'medium'; // Standard office/church laptop with integrated graphics
    } else {
      tier = 'high'; // High-performance desktop or laptop with dedicated NVIDIA/AMD GPU
    }

    // 5. Automatically tune system components according to detected hardware
    const maxCacheFrames = tier === 'eco' ? 8 : tier === 'medium' ? 14 : 20;
    slideRenderCache.setMaxCacheSize(maxCacheFrames);

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
