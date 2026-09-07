const fs = require('fs');
let code = fs.readFileSync('src/utils/SlideRenderCache.ts', 'utf8');

code = code.replace(
  `  public async putFrame(
    presKey: string,
    slideIndex: number,
    sourceCanvasOrElement: HTMLCanvasElement | HTMLElement | string,
    width = 1920,
    height = 1080
  ): Promise<OffscreenSlideFrame | null> {
    if (!presKey || typeof document === 'undefined') return null;
    const key = this.buildKey(presKey, slideIndex);

    try {`,
  `  public async putFrame(
    presKey: string,
    slideIndex: number,
    sourceCanvasOrElement: HTMLCanvasElement | HTMLElement | string,
    width = 1920,
    height = 1080
  ): Promise<OffscreenSlideFrame | null> {
    if (!presKey || typeof document === 'undefined') return null;
    const key = this.buildKey(presKey, slideIndex);
    
    console.log('[SlideRenderCache] 🎬 Capture started for', { presKey, slideIndex, key, width, height });

    try {`
);

code = code.replace(
  `          const capturePromise = html2canvas(sourceCanvasOrElement, {
            scale: 1,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            logging: false
          });
          
          const captureCanvas = await Promise.race([
             capturePromise,
             new Promise<null>((_, reject) => setTimeout(() => reject(new Error("html2canvas timeout")), 8000))
          ]);
          
          if (captureCanvas && ctx) {
            ctx.drawImage(captureCanvas, 0, 0, width, height);
            base64Url = captureCanvas.toDataURL('image/jpeg', 0.85);`,
  `          const capturePromise = html2canvas(sourceCanvasOrElement, {
            scale: 1,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            logging: false
          });
          
          const captureCanvas = await Promise.race([
             capturePromise,
             new Promise<null>((_, reject) => setTimeout(() => reject(new Error("html2canvas timeout")), 8000))
          ]);
          
          if (captureCanvas && ctx) {
            console.log('[SlideRenderCache] ✅ Capture completed', { width: captureCanvas.width, height: captureCanvas.height });
            console.log('[SlideRenderCache] 🔄 toDataURL started');
            base64Url = captureCanvas.toDataURL('image/jpeg', 0.85);
            console.log('[SlideRenderCache] ✅ toDataURL completed, bytes:', base64Url.length);`
);

fs.writeFileSync('src/utils/SlideRenderCache.ts', code);
