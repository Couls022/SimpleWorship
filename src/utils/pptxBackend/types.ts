export type PptxEngineMode = 'auto' | 'native' | 'powerpoint';

export interface PptxBackendCapabilities {
  backendType: 'powerpoint' | 'native';
  available: boolean;
  platform: string;
  executablePath?: string;
  version?: string;
  reason?: string;
  supportsNativeTypography: boolean;
  supportsHardwareRasterization: boolean;
  supportsVectorFallback: boolean;
}

export interface PptxRenderOptions {
  width?: number;
  height?: number;
  quality?: number;
  forceRefresh?: boolean;
  slideIndices?: number[];
}

export interface PptxRenderedSlide {
  slideIndex: number;
  dataUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  backend: 'powerpoint' | 'native';
  renderedAt: number;
  canvasProps?: any;
}

export interface CanonicalSlideRender {
  presentationId: string;
  slideIndex: number;
  width: number;
  height: number;
  aspectRatio: number;
  aspectRatioLabel?: string;
  engine: PptxEngineMode;
  dataUrl?: string; // High-res image (PowerPoint COM or rasterized canvas)
  canvasProps?: any; // Native OpenXML canvas props if rendered via native vector canvas
  renderVersion: number;
  timestamp: number;
}

export interface PptxPresentationSession {
  presentationId: string;
  slideCount: number;
  aspectRatio: number;
  width: number;
  height: number;
  slides: PptxRenderedSlide[];
  backendUsed: 'powerpoint' | 'native';
}

export interface PptxRenderingBackend {
  readonly id: string;
  readonly name: string;
  
  isAvailable(): Promise<boolean>;
  getCapabilities(): Promise<PptxBackendCapabilities>;
  
  loadPresentation(
    presentationId: string, 
    fileBytes: Uint8Array | ArrayBuffer | string,
    options?: PptxRenderOptions
  ): Promise<PptxPresentationSession>;
  
  renderSlide(
    presentationId: string, 
    slideIndex: number, 
    options?: PptxRenderOptions
  ): Promise<PptxRenderedSlide | null>;
  
  renderThumbnail(
    presentationId: string, 
    slideIndex: number, 
    options?: PptxRenderOptions
  ): Promise<PptxRenderedSlide | null>;
  
  clearCache(presentationId?: string): Promise<void>;
  dispose(): Promise<void>;
}
