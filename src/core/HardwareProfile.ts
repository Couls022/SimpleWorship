import { slideRenderCache } from '../utils/SlideRenderCache';
import { gpuDiagnosticsEngine, GpuDiagnosticInfo, GpuDeviceInfo } from './GpuDiagnostics';

export type HardwareTier = 'high' | 'medium' | 'eco';
export type GpuPreferenceMode = 'discrete' | 'integrated' | 'auto';

const GPU_PREFERENCE_STORAGE_KEY = 'simpleworship_gpu_preference';

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
  gpus?: GpuDeviceInfo[];
  isDualGpu?: boolean;
  discreteGpu?: GpuDeviceInfo | null;
  integratedGpu?: GpuDeviceInfo | null;
  activeGpu?: GpuDeviceInfo | null;
  preferredGpuMode?: GpuPreferenceMode;
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
  private preferredGpuMode: GpuPreferenceMode = 'discrete';

  private constructor() {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(GPU_PREFERENCE_STORAGE_KEY) as GpuPreferenceMode | null;
      if (stored === 'discrete' || stored === 'integrated' || stored === 'auto') {
        this.preferredGpuMode = stored;
      }
    }
    this.detectHardware();
  }

  public static getInstance(): HardwareProfileManager {
    if (!HardwareProfileManager.instance) {
      HardwareProfileManager.instance = new HardwareProfileManager();
    }
    return HardwareProfileManager.instance;
  }

  public getPreferredGpuMode(): GpuPreferenceMode {
    return this.preferredGpuMode;
  }

  public setPreferredGpuMode(mode: GpuPreferenceMode): HardwareInfo {
    return this.switchGpu(mode);
  }

  public switchGpu(mode: GpuPreferenceMode): HardwareInfo {
    this.preferredGpuMode = mode;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(GPU_PREFERENCE_STORAGE_KEY, mode);
      } catch {}
    }

    if (this.info) {
      const updated = this.applyGpuPreference(this.info, mode);
      this.info = updated;
      this.notifyListeners(updated);
      return updated;
    }

    // If info is not yet populated, return baseline
    return this.getHardwareInfoSync();
  }

  private applyGpuPreference(currentInfo: HardwareInfo, mode: GpuPreferenceMode): HardwareInfo {
    const discrete = currentInfo.discreteGpu || currentInfo.gpus?.find(g => g.type === 'discrete') || null;
    const integrated = currentInfo.integratedGpu || currentInfo.gpus?.find(g => g.type === 'integrated') || null;
    
    let activeGpu: GpuDeviceInfo | null = null;
    if (mode === 'integrated') {
      activeGpu = integrated || discrete || currentInfo.gpus?.[0] || null;
    } else if (mode === 'discrete') {
      activeGpu = discrete || integrated || currentInfo.gpus?.[0] || null;
    } else {
      // Auto: prefer discrete if available
      activeGpu = discrete || integrated || currentInfo.gpus?.[0] || null;
    }

    const isDiscreteActive = activeGpu?.type === 'discrete' || (activeGpu && /nvidia|geforce|rtx|gtx|radeon|discrete|arc/i.test(activeGpu.name));
    
    let gpuRenderer = activeGpu ? activeGpu.name : currentInfo.gpuRenderer;
    let gpuVendor = activeGpu ? activeGpu.vendor : currentInfo.gpuVendor;

    // Recalculate tier based on selected GPU
    let tier: HardwareTier = currentInfo.tier;
    if (isDiscreteActive || currentInfo.cpuCores >= 8 || currentInfo.totalRamMb >= 16000) {
      tier = 'high';
    } else if (currentInfo.cpuCores <= 2 && currentInfo.totalRamMb < 3000) {
      tier = 'eco';
    } else {
      tier = 'medium';
    }

    // Tune slide render cache size
    const maxCacheFrames = tier === 'eco' ? 8 : tier === 'medium' ? 16 : 28;
    slideRenderCache.setMaxCacheSize(maxCacheFrames);

    // Update document root classes
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('hw-tier-eco', 'hw-tier-medium', 'hw-tier-high', 'gpu-discrete-active', 'gpu-integrated-active');
      root.classList.add(`hw-tier-${tier}`);
      if (isDiscreteActive) {
        root.classList.add('gpu-discrete-active');
      } else {
        root.classList.add('gpu-integrated-active');
      }
      if (currentInfo.isHardwareAccelerated) {
        root.classList.add('gpu-accelerated');
      } else {
        root.classList.remove('gpu-accelerated');
      }
    }

    return {
      ...currentInfo,
      gpuRenderer,
      gpuVendor,
      activeGpu,
      preferredGpuMode: mode,
      tier,
    };
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
    const electron = typeof window !== 'undefined' ? (window as any)?.electronAPI : undefined;
    const detectedGpus: GpuDeviceInfo[] = [];

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

          if (Array.isArray(nativeInfo.gpus) && nativeInfo.gpus.length > 0) {
            for (const g of nativeInfo.gpus) {
              detectedGpus.push(g);
            }
          }

          if (nativeInfo.gpuInfo && nativeInfo.gpuInfo.auxAttributes) {
            const aux = nativeInfo.gpuInfo.auxAttributes;
            if (aux.glRenderer) {
              gpuRenderer = aux.glRenderer;
            }
            if (aux.glVendor) {
              gpuVendor = aux.glVendor;
            }
          }
        }
      } catch (e) {
        console.warn('[HardwareProfile] Electron hardware query error:', e);
      }
    }

    // Query host server specs if running in browser / dev server
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
            const gpus = sysData.hardware.gpus || (sysData as any).hostGpus || [];
            if (Array.isArray(gpus)) {
              for (const g of gpus) {
                detectedGpus.push(g);
              }
            }
            if (sysData.hardware.discreteGpu) {
              detectedGpus.push(sysData.hardware.discreteGpu);
            }
            if (sysData.hardware.integratedGpu) {
              detectedGpus.push(sysData.hardware.integratedGpu);
            }
          }
        }
      }
    } catch {}

    if (detectedGpus.length > 0) {
      gpuDiagnosticsEngine.registerHostGpus(detectedGpus);
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

    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      if (mem.usedJSHeapSize) {
        processMemMb = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      }
    }

    // 4. Calculate Hardware Tier based on CPU, RAM, & Dual/Discrete GPU capability
    const allGpus = gpuDiag?.gpus || detectedGpus;
    const isDualGpu = Boolean(gpuDiag?.isDualGpu || (allGpus && allGpus.length > 1));
    const discreteGpu = gpuDiag?.discreteGpu || allGpus.find(g => g.type === 'discrete') || null;
    const integratedGpu = gpuDiag?.integratedGpu || allGpus.find(g => g.type === 'integrated') || null;
    const hasDedicatedGpu = isDualGpu || Boolean(discreteGpu) || /nvidia|geforce|radeon|rtx|gtx|quadro|amd|apple|m1|m2|m3|m4|arc/i.test(gpuRenderer);
    const isIntelIntegrated = !hasDedicatedGpu && gpuRenderer.toLowerCase().includes('intel') && !gpuRenderer.toLowerCase().includes('arc');

    // Adjust total RAM estimate if browser clamped deviceMemory for privacy
    if ((hasDedicatedGpu || cpuCores >= 8) && totalRamMb < 8192) {
      totalRamMb = 8192;
      freeRamMb = Math.round(totalRamMb * 0.55);
      usedRamMb = totalRamMb - freeRamMb;
    }

    const isSwiftShader = gpuRenderer.toLowerCase().includes('swiftshader') || gpuRenderer.toLowerCase().includes('software') || gpuRenderer.toLowerCase().includes('llvmpipe');
    let tier: HardwareTier = 'high';
    if (isSwiftShader || (cpuCores <= 2 && totalRamMb < 3000 && !hasDedicatedGpu)) {
      tier = 'eco'; // Low-spec laptop or software-only rasterization
    } else if (hasDedicatedGpu || cpuCores >= 8 || (totalRamMb >= 8000 && !isIntelIntegrated)) {
      tier = 'high'; // Dedicated NVIDIA/AMD GPU, Dual-GPU architecture, or high-performance 8+ thread multi-core CPU
    } else {
      tier = 'medium'; // Standard office/church laptop with integrated graphics
    }

    // Automatically prioritize discrete high-performance GPU if available
    let activeGpu: GpuDeviceInfo | null = null;
    if (this.preferredGpuMode === 'integrated') {
      activeGpu = integratedGpu || discreteGpu || allGpus[0] || null;
    } else {
      // Default to discrete GPU when present to avoid defaulting to low-power onboard chip
      activeGpu = discreteGpu || integratedGpu || allGpus[0] || null;
    }

    if (activeGpu) {
      gpuRenderer = activeGpu.name;
      gpuVendor = activeGpu.vendor;
    }

    // 5. Automatically tune system components and GPU acceleration according to detected hardware
    const maxCacheFrames = tier === 'eco' ? 8 : tier === 'medium' ? 16 : 28;
    slideRenderCache.setMaxCacheSize(maxCacheFrames);

    // Apply hardware acceleration CSS flags to document root
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('hw-tier-eco', 'hw-tier-medium', 'hw-tier-high', 'gpu-discrete-active', 'gpu-integrated-active');
      root.classList.add(`hw-tier-${tier}`);
      if (activeGpu?.type === 'discrete' || (activeGpu && /nvidia|geforce|rtx|gtx|radeon|discrete|arc/i.test(activeGpu.name))) {
        root.classList.add('gpu-discrete-active');
      } else {
        root.classList.add('gpu-integrated-active');
      }
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
      gpus: allGpus,
      isDualGpu,
      discreteGpu,
      integratedGpu,
      activeGpu,
      preferredGpuMode: this.preferredGpuMode,
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
      tier: 'high',
      preferredGpuMode: this.preferredGpuMode
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
