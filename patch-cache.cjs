const fs = require('fs');
let code = fs.readFileSync('src/utils/SlideRenderCache.ts', 'utf8');

// Replace html2canvas capture logic
const oldCapture = `      } else if (sourceCanvasOrElement instanceof HTMLElement) {
        try {
          const captureCanvas = await html2canvas(sourceCanvasOrElement, {
            scale: 1,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            logging: false
          });
          
          if (ctx) {
            ctx.drawImage(captureCanvas, 0, 0, width, height);
          }
          base64Url = captureCanvas.toDataURL('image/jpeg', 0.85);
          
          const blob = await new Promise<Blob | null>(res => captureCanvas.toBlob(res, 'image/jpeg', 0.85));
          if (blob) {
            objectUrl = URL.createObjectURL(blob);
          }
        } catch (captureErr) {
          const innerCanvas = sourceCanvasOrElement.querySelector('canvas');
          if (innerCanvas && ctx) {
            ctx.drawImage(innerCanvas, 0, 0, width, height);
            try {
              base64Url = offscreenCanvas.toDataURL('image/jpeg', 0.85);
              const blob = await new Promise<Blob | null>(res => offscreenCanvas.toBlob(res, 'image/jpeg', 0.85));
              if (blob) {
                objectUrl = URL.createObjectURL(blob);
              }
            } catch {
              // ignore
            }
          }
        }
      }`;

const newCapture = `      } else if (sourceCanvasOrElement instanceof HTMLElement) {
        try {
          if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
             await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))]);
          }

          // Wait for images
          const images = Array.from(sourceCanvasOrElement.querySelectorAll('img'));
          await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
               img.onload = resolve;
               img.onerror = resolve;
               setTimeout(resolve, 3000); // Max wait per image
            });
          }));

          const capturePromise = html2canvas(sourceCanvasOrElement, {
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
            base64Url = captureCanvas.toDataURL('image/jpeg', 0.85);
            
            const blob = await new Promise<Blob | null>(res => captureCanvas.toBlob(res, 'image/jpeg', 0.85));
            if (blob) {
              objectUrl = URL.createObjectURL(blob);
            }
          }
        } catch (captureErr) {
          console.warn('[SlideRenderCache] html2canvas capture failed or timed out', captureErr);
          const innerCanvas = sourceCanvasOrElement.querySelector('canvas');
          if (innerCanvas && ctx) {
            ctx.drawImage(innerCanvas, 0, 0, width, height);
            try {
              base64Url = offscreenCanvas.toDataURL('image/jpeg', 0.85);
              const blob = await new Promise<Blob | null>(res => offscreenCanvas.toBlob(res, 'image/jpeg', 0.85));
              if (blob) {
                objectUrl = URL.createObjectURL(blob);
              }
            } catch {
              // ignore
            }
          } else {
             throw captureErr;
          }
        }
      }`;

code = code.replace(oldCapture, newCapture);

// Also add dispatchEvent to putFrame
code = code.replace(`        try {
          const channel = new BroadcastChannel('pptx_render_sync');
          channel.postMessage({
            type: 'FRAME_RENDERED',
            key,
            slideIndex,
            base64Url
          });
          channel.close();
        } catch (e) {
          // ignore
        }`, `        try {
          const channel = new BroadcastChannel('pptx_render_sync');
          channel.postMessage({
            type: 'FRAME_RENDERED',
            key,
            slideIndex,
            base64Url
          });
          channel.close();
        } catch (e) {
          // ignore
        }
        window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex } }));`);

fs.writeFileSync('src/utils/SlideRenderCache.ts', code);
