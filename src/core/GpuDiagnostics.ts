export interface GpuDeviceInfo {
  name: string;
  vendor: string;
  type: 'discrete' | 'integrated' | 'virtual' | 'software' | 'unknown';
  driverVersion?: string;
  vramMb?: number;
  isActive?: boolean;
  isPrimary?: boolean;
}

export interface GpuDiagnosticInfo {
  gpuVendor: string;
  gpuDevice: string;
  gpus: GpuDeviceInfo[];
  isDualGpu: boolean;
  discreteGpu: GpuDeviceInfo | null;
  integratedGpu: GpuDeviceInfo | null;
  hardwareCompositingStatus: 'Active (GPU)' | 'Software / Disabled';
  hardwareRasterizationStatus: 'Active (GPU)' | 'Software / Disabled';
  webglStatus: 'WebGL 2 Active' | 'WebGL 1 Active' | 'Disabled / Unsupported';
  hardwareVideoDecodeStatus: 'Hardware Accelerated (GPU)' | 'Software Decoding' | 'Limited Support';
  canvasAccelerationStatus: 'GPU Accelerated' | 'Software Fallback';
  currentRendererBackend: string;
  detectedFallbackConditions: string[];
  isSoftwareRendering: boolean;
  videoCodecSupport: {
    h264: boolean;
    hevc: boolean;
    vp9: boolean;
    av1: boolean;
  };
  maxTextureSize: number;
  maxViewportDims: [number, number];
}

export function cleanGpuRendererName(raw: string): string {
  if (!raw) return 'Graphics Adapter';
  const angleMatch = raw.match(/ANGLE\s*\([^,]+,\s*([^,]+?)(?:\s*(?:Direct3D|\(0x|vs_\d|OpenGL|\bVulkan\b|$))/i);
  if (angleMatch && angleMatch[1]) {
    return angleMatch[1].trim();
  }
  return raw.replace(/\s+/g, ' ').trim();
}

export function cleanGpuVendor(vendor: string, name: string): string {
  const s = `${vendor} ${name}`.toLowerCase();
  if (s.includes('nvidia') || s.includes('geforce')) return 'NVIDIA';
  if (s.includes('intel')) return 'Intel';
  if (s.includes('amd') || s.includes('ati') || s.includes('radeon')) return 'AMD';
  if (s.includes('apple')) return 'Apple';
  if (s.includes('qualcomm')) return 'Qualcomm';
  if (s.includes('microsoft')) return 'Microsoft';
  return vendor || 'Vendor';
}

export function classifyGpuType(name: string, vendor: string, hint?: 'discrete' | 'integrated'): 'discrete' | 'integrated' | 'virtual' | 'software' | 'unknown' {
  const s = `${name} ${vendor}`.toLowerCase();
  if (s.includes('swiftshader') || s.includes('llvmpipe') || s.includes('software') || s.includes('lavapipe') || s.includes('basic render')) {
    return 'software';
  }
  if (s.includes('virtualbox') || s.includes('vmware') || s.includes('hyper-v') || s.includes('qemu')) {
    return 'virtual';
  }
  if (/nvidia|geforce|rtx|gtx|quadro|titan|tesla/i.test(s)) {
    return 'discrete';
  }
  if (/radeon\s+(rx|pro|vii|hd\s+[789]\d{3})|discrete|dedicated/i.test(s)) {
    return 'discrete';
  }
  if (/arc(\s+pro|\s+a\d{3})/i.test(s)) {
    return 'discrete';
  }
  if (/intel.*(uhd|iris|hd\s+graphics)|amd\s+radeon(\(tm\))?\s+graphics|apu|vega\s+\d+|integrated/i.test(s)) {
    return 'integrated';
  }
  if (hint) return hint;
  if (/intel/i.test(s)) return 'integrated';
  if (/nvidia|amd/i.test(s)) return 'discrete';
  return 'unknown';
}

function addGpuIfUnique(list: GpuDeviceInfo[], gpu: GpuDeviceInfo) {
  if (!gpu.name || gpu.name === 'Unknown GPU Device' || gpu.name === 'Graphics Adapter') return;
  const cleanName = cleanGpuRendererName(gpu.name);
  const cleanVen = cleanGpuVendor(gpu.vendor, cleanName);
  
  // Only match as existing if the normalized names are truly identical or one is a strict substring of the other from the same vendor
  const existing = list.find(g => {
    const a = g.name.toLowerCase().trim();
    const b = cleanName.toLowerCase().trim();
    if (a === b) return true;
    if (g.vendor.toLowerCase() === cleanVen.toLowerCase()) {
      if ((a.includes(b) || b.includes(a)) && (g.type === gpu.type || g.type === 'unknown' || gpu.type === 'unknown')) {
        return true;
      }
    }
    return false;
  });

  if (!existing) {
    list.push({
      ...gpu,
      name: cleanName,
      vendor: cleanVen
    });
  } else {
    if (gpu.driverVersion && !existing.driverVersion) existing.driverVersion = gpu.driverVersion;
    if (gpu.vramMb && !existing.vramMb) existing.vramMb = gpu.vramMb;
    if (gpu.isActive) existing.isActive = true;
    if (cleanName.length > existing.name.length) existing.name = cleanName;
    if (gpu.type !== 'unknown' && existing.type === 'unknown') existing.type = gpu.type;
  }
}

class GpuDiagnosticsEngine {
  private static instance: GpuDiagnosticsEngine;
  private cachedDiagnostics: GpuDiagnosticInfo | null = null;

  public static getInstance(): GpuDiagnosticsEngine {
    if (!GpuDiagnosticsEngine.instance) {
      GpuDiagnosticsEngine.instance = new GpuDiagnosticsEngine();
    }
    return GpuDiagnosticsEngine.instance;
  }

  private hostGpus: GpuDeviceInfo[] = [];

  public registerHostGpus(gpus: GpuDeviceInfo[]) {
    if (Array.isArray(gpus) && gpus.length > 0) {
      for (const g of gpus) {
        addGpuIfUnique(this.hostGpus, g);
      }
      if (this.cachedDiagnostics) {
        // Refresh cached diagnostics with newly registered host GPUs
        this.runDiagnostics();
      }
    }
  }

  public async runDiagnostics(): Promise<GpuDiagnosticInfo> {
    const detectedGpus: GpuDeviceInfo[] = [];

    // Incorporate any previously registered host GPUs (from Electron or /api/system/status)
    for (const hg of this.hostGpus) {
      addGpuIfUnique(detectedGpus, hg);
    }

    let gpuVendor = 'Unknown Vendor';
    let gpuDevice = 'Unknown GPU Device';
    let webglStatus: GpuDiagnosticInfo['webglStatus'] = 'Disabled / Unsupported';
    let hardwareCompositingStatus: GpuDiagnosticInfo['hardwareCompositingStatus'] = 'Software / Disabled';
    let hardwareRasterizationStatus: GpuDiagnosticInfo['hardwareRasterizationStatus'] = 'Software / Disabled';
    let canvasAccelerationStatus: GpuDiagnosticInfo['canvasAccelerationStatus'] = 'Software Fallback';
    let hardwareVideoDecodeStatus: GpuDiagnosticInfo['hardwareVideoDecodeStatus'] = 'Software Decoding';
    let currentRendererBackend = 'Software / Unaccelerated Canvas';
    let isSoftwareRendering = false;
    const detectedFallbackConditions: string[] = [];
    let maxTextureSize = 4096;
    let maxViewportDims: [number, number] = [4096, 4096];

    const videoCodecSupport = {
      h264: true,
      hevc: false,
      vp9: false,
      av1: false,
    };

    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;

        // 1. WebGL & GPU Hardware Context Validation (Requests High-Performance Discrete GPU)
        let gl: WebGL2RenderingContext | WebGLRenderingContext | null = canvas.getContext('webgl2', {
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false,
          desynchronized: true
        }) as WebGL2RenderingContext | null;

        let versionLabel = 'WebGL 2 Active';
        if (gl) {
          webglStatus = 'WebGL 2 Active';
        } else {
          gl = (canvas.getContext('webgl', { powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }) ||
            canvas.getContext('experimental-webgl', { powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false })) as WebGLRenderingContext | null;
          if (gl) {
            webglStatus = 'WebGL 1 Active';
            versionLabel = 'WebGL 1 Active';
          }
        }

        // Proactive Modern WebGPU Adapter Driver Detection (Dual Probing: High-Performance & Low-Power)
        if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
          try {
            // A. Request High-Performance Adapter (Discrete GPU: NVIDIA/AMD/Arc)
            const highPerfAdapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' });
            if (highPerfAdapter) {
              const info = highPerfAdapter.info || (typeof highPerfAdapter.requestAdapterInfo === 'function' ? await highPerfAdapter.requestAdapterInfo() : null);
              if (info) {
                const rawName = info.description || `${info.vendor || ''} ${info.architecture || ''} ${info.device || ''}`.trim() || 'High-Performance GPU';
                const v = info.vendor || cleanGpuVendor('', rawName);
                const gType = classifyGpuType(rawName, v, 'discrete');
                addGpuIfUnique(detectedGpus, {
                  name: cleanGpuRendererName(rawName),
                  vendor: cleanGpuVendor(v, rawName),
                  type: gType,
                  isPrimary: true,
                  isActive: true
                });
              }
            }

            // B. Request Low-Power Adapter (Integrated GPU: Intel UHD/Iris/AMD APU)
            const lowPowerAdapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'low-power' });
            if (lowPowerAdapter) {
              const info = lowPowerAdapter.info || (typeof lowPowerAdapter.requestAdapterInfo === 'function' ? await lowPowerAdapter.requestAdapterInfo() : null);
              if (info) {
                const rawName = info.description || `${info.vendor || ''} ${info.architecture || ''} ${info.device || ''}`.trim() || 'Integrated GPU';
                const v = info.vendor || cleanGpuVendor('', rawName);
                const gType = classifyGpuType(rawName, v, 'integrated');
                addGpuIfUnique(detectedGpus, {
                  name: cleanGpuRendererName(rawName),
                  vendor: cleanGpuVendor(v, rawName),
                  type: gType,
                  isPrimary: false,
                  isActive: true
                });
              }
            }
          } catch (e) {}
        }

        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          let glVen = '';
          let glDev = '';
          if (debugInfo) {
            glVen = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
            glDev = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
          } else {
            glVen = gl.getParameter(gl.VENDOR) || '';
            glDev = gl.getParameter(gl.RENDERER) || '';
          }

          if (glDev) {
            addGpuIfUnique(detectedGpus, {
              name: cleanGpuRendererName(glDev),
              vendor: cleanGpuVendor(glVen, glDev),
              type: classifyGpuType(glDev, glVen),
              isActive: true,
              isPrimary: true
            });
          }

          // Probe low-power WebGL context to uncover built-in/integrated GPU if distinct
          try {
            const lowCanvas = document.createElement('canvas');
            const lowGl = (lowCanvas.getContext('webgl2', { powerPreference: 'low-power' }) ||
              lowCanvas.getContext('webgl', { powerPreference: 'low-power' })) as WebGL2RenderingContext | WebGLRenderingContext | null;
            if (lowGl) {
              const lowExt = lowGl.getExtension('WEBGL_debug_renderer_info');
              const lowDev = lowExt ? lowGl.getParameter(lowExt.UNMASKED_RENDERER_WEBGL) : lowGl.getParameter(lowGl.RENDERER);
              const lowVen = lowExt ? lowGl.getParameter(lowExt.UNMASKED_VENDOR_WEBGL) : lowGl.getParameter(lowGl.VENDOR);
              if (lowDev && lowDev !== glDev) {
                addGpuIfUnique(detectedGpus, {
                  name: cleanGpuRendererName(lowDev),
                  vendor: cleanGpuVendor(lowVen, lowDev),
                  type: classifyGpuType(lowDev, lowVen, 'integrated'),
                  isActive: true,
                  isPrimary: false
                });
              }
            }
          } catch (e) {}

          const texSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
          if (texSize && typeof texSize === 'number') maxTextureSize = texSize;

          const viewDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
          if (viewDims && Array.isArray(viewDims)) {
            maxViewportDims = [viewDims[0] || 4096, viewDims[1] || 4096];
          }

          // Check software rendering signatures
          const rawCheck = (glDev || '').toLowerCase();
          const softwareKeywords = ['swiftshader', 'llvmpipe', 'softpipe', 'software rasterizer', 'mesa', 'basic render driver', 'lavapipe'];
          isSoftwareRendering = softwareKeywords.some(kw => rawCheck.includes(kw));

          if (isSoftwareRendering) {
            detectedFallbackConditions.push(`Software rasterizer detected in GPU renderer (${glDev})`);
          }

          // Test Hardware Performance Caveat
          const hwCheckCanvas = document.createElement('canvas');
          const hwGl = hwCheckCanvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ||
                       hwCheckCanvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });

          if (hwGl && !isSoftwareRendering) {
            hardwareCompositingStatus = 'Active (GPU)';
            hardwareRasterizationStatus = 'Active (GPU)';
          } else {
            hardwareCompositingStatus = 'Software / Disabled';
            hardwareRasterizationStatus = 'Software / Disabled';
            detectedFallbackConditions.push('Browser triggered performance caveat / fallback rasterization');
          }
        } else {
          detectedFallbackConditions.push('WebGL context initialization failed completely');
          isSoftwareRendering = true;
        }

        // 2. Canvas 2D Acceleration Check (using an independent 2D canvas to avoid WebGL context collision)
        try {
          const canvas2d = document.createElement('canvas');
          canvas2d.width = 16;
          canvas2d.height = 16;
          const ctx2d = canvas2d.getContext('2d', { willReadFrequently: false });
          if (ctx2d && !isSoftwareRendering && webglStatus !== 'Disabled / Unsupported') {
            canvasAccelerationStatus = 'GPU Accelerated';
          } else {
            canvasAccelerationStatus = 'Software Fallback';
            if (!isSoftwareRendering) {
              detectedFallbackConditions.push('2D Canvas context running without WebGL backing');
            }
          }
        } catch (e) {
          canvasAccelerationStatus = 'Software Fallback';
        }

        // 3. Hardware Video Decoding Capability Check
        if (typeof navigator !== 'undefined' && navigator.mediaCapabilities) {
          try {
            const h264Check = await navigator.mediaCapabilities.decodingInfo({
              type: 'file',
              video: {
                contentType: 'video/mp4; codecs="avc1.42E01E"',
                width: 1920,
                height: 1080,
                bitrate: 5000000,
                framerate: 60,
              },
            });
            videoCodecSupport.h264 = h264Check.supported;

            const vp9Check = await navigator.mediaCapabilities.decodingInfo({
              type: 'file',
              video: {
                contentType: 'video/webm; codecs="vp09.00.10.08"',
                width: 1920,
                height: 1080,
                bitrate: 5000000,
                framerate: 60,
              },
            });
            videoCodecSupport.vp9 = vp9Check.supported;

            const av1Check = await navigator.mediaCapabilities.decodingInfo({
              type: 'file',
              video: {
                contentType: 'video/mp4; codecs="av01.0.04M.08"',
                width: 1920,
                height: 1080,
                bitrate: 5000000,
                framerate: 60,
              },
            });
            videoCodecSupport.av1 = av1Check.supported;

            if (h264Check.powerEfficient || vp9Check.powerEfficient) {
              hardwareVideoDecodeStatus = 'Hardware Accelerated (GPU)';
            } else if (h264Check.supported) {
              hardwareVideoDecodeStatus = 'Limited Support';
            } else {
              hardwareVideoDecodeStatus = 'Software Decoding';
              detectedFallbackConditions.push('Platform video decoding requires CPU fallback');
            }
          } catch (e) {
            hardwareVideoDecodeStatus = 'Software Decoding';
          }
        }
      } catch (e) {
        console.warn('[GpuDiagnostics] Diagnostic detection error:', e);
      }
    }

    // Determine Discrete vs Integrated GPUs
    const nonSoftwareGpus = detectedGpus.filter(g => g.type !== 'software' && g.type !== 'virtual');
    let discreteGpu = nonSoftwareGpus.find(g => g.type === 'discrete') || null;
    let integratedGpu = nonSoftwareGpus.find(g => g.type === 'integrated') || null;

    if (nonSoftwareGpus.length >= 2) {
      if (!discreteGpu) {
        discreteGpu = nonSoftwareGpus.find(g => /nvidia|geforce|rtx|gtx|radeon|discrete/i.test(g.name + ' ' + g.vendor)) || nonSoftwareGpus[0];
        discreteGpu.type = 'discrete';
      }
      if (!integratedGpu) {
        integratedGpu = nonSoftwareGpus.find(g => g !== discreteGpu) || null;
        if (integratedGpu) integratedGpu.type = 'integrated';
      }
    }

    const isDualGpu = (discreteGpu !== null && integratedGpu !== null) || nonSoftwareGpus.length > 1;

    if (isDualGpu && discreteGpu && integratedGpu) {
      gpuDevice = `${discreteGpu.name} (Dedicated) + ${integratedGpu.name} (Integrated)`;
      gpuVendor = `${discreteGpu.vendor} / ${integratedGpu.vendor}`;
      currentRendererBackend = `Dual GPU Hardware (${discreteGpu.name} & ${integratedGpu.name})`;
    } else if (nonSoftwareGpus.length > 0) {
      const primary = discreteGpu || nonSoftwareGpus[0];
      gpuDevice = primary.name;
      gpuVendor = primary.vendor;
      currentRendererBackend = `DirectX/Hardware (${primary.name})`;
    } else if (detectedGpus.length > 0) {
      gpuDevice = detectedGpus[0].name;
      gpuVendor = detectedGpus[0].vendor;
      currentRendererBackend = detectedGpus[0].name;
    }

    const info: GpuDiagnosticInfo = {
      gpuVendor,
      gpuDevice,
      gpus: detectedGpus,
      isDualGpu,
      discreteGpu,
      integratedGpu,
      hardwareCompositingStatus,
      hardwareRasterizationStatus,
      webglStatus,
      hardwareVideoDecodeStatus,
      canvasAccelerationStatus,
      currentRendererBackend,
      detectedFallbackConditions,
      isSoftwareRendering,
      videoCodecSupport,
      maxTextureSize,
      maxViewportDims,
    };

    this.cachedDiagnostics = info;
    return info;
  }

  public getCachedDiagnostics(): GpuDiagnosticInfo | null {
    return this.cachedDiagnostics;
  }
}

export const gpuDiagnosticsEngine = GpuDiagnosticsEngine.getInstance();
