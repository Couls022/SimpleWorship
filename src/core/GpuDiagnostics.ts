export interface GpuDiagnosticInfo {
  gpuVendor: string;
  gpuDevice: string;
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

class GpuDiagnosticsEngine {
  private static instance: GpuDiagnosticsEngine;
  private cachedDiagnostics: GpuDiagnosticInfo | null = null;

  public static getInstance(): GpuDiagnosticsEngine {
    if (!GpuDiagnosticsEngine.instance) {
      GpuDiagnosticsEngine.instance = new GpuDiagnosticsEngine();
    }
    return GpuDiagnosticsEngine.instance;
  }

  public async runDiagnostics(): Promise<GpuDiagnosticInfo> {
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

        // Proactive Modern WebGPU Adapter Driver Detection
        if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
          try {
            const adapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' });
            if (adapter) {
              const info = adapter.info || (typeof adapter.requestAdapterInfo === 'function' ? await adapter.requestAdapterInfo() : null);
              if (info) {
                if (info.vendor) gpuVendor = info.vendor;
                if (info.description || info.device || info.architecture) {
                  gpuDevice = info.description || `${info.vendor || ''} ${info.architecture || ''} ${info.device || ''}`.trim();
                  currentRendererBackend = `WebGPU Hardware (${gpuDevice})`;
                  hardwareCompositingStatus = 'Active (GPU)';
                  hardwareRasterizationStatus = 'Active (GPU)';
                }
              }
            }
          } catch (e) {}
        }

        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || gpuVendor;
            gpuDevice = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || gpuDevice;
          } else {
            gpuVendor = gl.getParameter(gl.VENDOR) || gpuVendor;
            gpuDevice = gl.getParameter(gl.RENDERER) || gpuDevice;
          }

          currentRendererBackend = `${versionLabel} (${gpuDevice})`;

          const texSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
          if (texSize && typeof texSize === 'number') maxTextureSize = texSize;

          const viewDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
          if (viewDims && Array.isArray(viewDims)) {
            maxViewportDims = [viewDims[0] || 4096, viewDims[1] || 4096];
          }

          // Check software rendering signatures
          const lowerDevice = gpuDevice.toLowerCase();
          const lowerVendor = gpuVendor.toLowerCase();
          const softwareKeywords = ['swiftshader', 'llvmpipe', 'softpipe', 'software rasterizer', 'mesa', 'basic render driver', 'lavapipe'];

          isSoftwareRendering = softwareKeywords.some(kw => lowerDevice.includes(kw) || lowerVendor.includes(kw));

          if (isSoftwareRendering) {
            detectedFallbackConditions.push(`Software rasterizer detected in GPU renderer (${gpuDevice})`);
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

    const info: GpuDiagnosticInfo = {
      gpuVendor,
      gpuDevice,
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
