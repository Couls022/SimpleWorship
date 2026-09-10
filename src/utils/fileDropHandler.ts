import { PresentationItem } from '../types';
import { processAssetFile } from '../db/assets';
import { dbApi } from '../db';
import { parsePptxOffline } from './pptxParser';
import { savePresentation } from '../db/presentations';
import { readSwsFile } from '../services/swsService';

export interface ProcessedDropResult {
  items: PresentationItem[];
  schedule?: any;
  error?: string;
}

export function isMediaOrPresentationFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type.startsWith('image/') ||
    type.startsWith('video/') ||
    type.startsWith('audio/') ||
    type.includes('presentation') ||
    type.includes('powerpoint') ||
    /\.(png|jpe?g|webp|gif|svg|bmp|mp4|webm|mov|mkv|m4v|avi|mp3|wav|m4a|aac|ogg|flac|pptx|ppt|sws|worship)$/i.test(name)
  );
}

/**
 * Fast, non-blocking processor for individual dropped files.
 * Handles Images, Videos, Audio tracks, PPTX/PPT presentations, and Worship schedules.
 */
export async function processSingleDroppedFile(file: File): Promise<PresentationItem | { schedule: any } | null> {
  const name = file.name.toLowerCase();
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(name);
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v|avi)$/i.test(name);
  const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name);
  const isPptx = name.endsWith('.pptx');
  const isPpt = name.endsWith('.ppt');
  const isSws = /\.(sws|json|worship)$/i.test(name);

  // 1. Service Schedule (.sws, .json, .worship)
  if (isSws) {
    try {
      const swsResult = await readSwsFile(file);
      if (swsResult.bundledSongs && swsResult.bundledSongs.length > 0) {
        for (const s of swsResult.bundledSongs) {
          await dbApi.addSong(s).catch(() => {});
        }
      }
      if (swsResult.bundledThemes && swsResult.bundledThemes.length > 0) {
        for (const t of swsResult.bundledThemes) {
          await dbApi.addTheme(t).catch(() => {});
        }
      }
      if (swsResult.schedule) {
        await dbApi.addSchedule(swsResult.schedule).catch(() => {});
      }
      return { schedule: swsResult.schedule };
    } catch (err) {
      console.error('[fileDropHandler] Error reading SWS file:', err);
      return null;
    }
  }

  // 2. Presentations (.pptx, .ppt)
  if (isPptx || isPpt) {
    try {
      window.dispatchEvent(new CustomEvent('simpleworship:notify', {
        detail: `Importing presentation: ${file.name}...`
      }));

      // Non-blocking wait to allow UI to render notification banner
      await new Promise(resolve => setTimeout(resolve, 20));

      let slides;
      let usingNativeCom = false;
      let parsedMetadata: any[] = [];
      
      // Parse presentation offline directly into hardware-accelerated slides & vector overlay
      if (isPptx) {
        try {
          parsedMetadata = await parsePptxOffline(file);
          if (parsedMetadata && parsedMetadata.length > 0) {
            slides = parsedMetadata;
          }
        } catch (e) {
          console.warn('[fileDropHandler] Metadata extraction failed:', e);
        }
      }

      // Fallback for legacy .ppt format if no slides parsed
      if (!slides || slides.length === 0) {
        if (isPpt) {
          window.dispatchEvent(new CustomEvent('simpleworship:notify', {
            detail: `Legacy .ppt file detected. Converting ${file.name} to presentation...`
          }));
          slides = [
            {
              id: `slide-${Date.now()}`,
              title: file.name.replace(/\.ppt$/i, ''),
              text: 'Legacy PowerPoint (.ppt) presentation. For full animation & shape extraction, save as modern .pptx in PowerPoint.',
              backgroundColor: '#1e293b',
              fontColor: '#ffffff',
              fontSize: 36,
              textAlign: 'center' as const
            }
          ];
        } else {
          throw new Error('Failed to parse presentation.');
        }
      }

      const presName = file.name.replace(/\.pptx?$/i, '');
      const savedAsset = await savePresentation(presName, slides, file);

      // Lightweight schedule item: do NOT duplicate massive fileBytes in item.data
      const presItem: PresentationItem = {
        id: `pres-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: 'presentation',
        name: presName,
        contentId: savedAsset.id,
        notes: `${slides.length} slides • ${isPptx ? 'PowerPoint' : 'Legacy PPT'}${usingNativeCom ? ' (Native)' : ''}`,
        data: {
          slides: slides,
          sourceFileName: file.name,
          format: isPptx ? 'PPTX' : 'PPT',
          isNativeRasterized: usingNativeCom
        },
        isExpanded: true
      };

      window.dispatchEvent(new CustomEvent('simpleworship:notify', {
        detail: `Loaded "${presName}" (${slides.length} slides)!`
      }));

      return presItem;
    } catch (err: any) {
      console.error('[fileDropHandler] Failed to import presentation:', err);
      window.dispatchEvent(new CustomEvent('simpleworship:notify', {
        detail: `Could not parse ${file.name}. Ensure it is a valid .pptx file.`
      }));
      return null;
    }
  }

  // 3. Media: Image, Video, or Audio
  if (isImage || isVideo || isAudio) {
    try {
      const asset = await processAssetFile(file);
      await dbApi.addAsset(asset).catch(e => console.warn('[fileDropHandler] Asset cache warning:', e));

      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const itemId = `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toUpperCase() : (isVideo ? 'MP4' : isAudio ? 'MP3' : 'JPG');

      const mediaItem: PresentationItem = {
        id: itemId,
        type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
        name: cleanName,
        contentId: asset.id,
        customBackgroundUrl: isImage ? asset.url : undefined,
        notes: isVideo 
          ? `${ext} Video` 
          : isAudio 
          ? `${ext} Audio Track` 
          : `${ext} Image Asset`,
        data: {
          url: asset.url,
          sourceFileName: file.name,
          format: ext,
          type: asset.type,
          isVideo: isVideo,
          isAudio: isAudio,
          thumbnailUrl: isImage ? asset.url : undefined
        },
        isExpanded: true
      };

      window.dispatchEvent(new CustomEvent('simpleworship:notify', {
        detail: `Added ${isVideo ? 'Video' : isAudio ? 'Audio' : 'Image'} (${ext}): "${cleanName}"`
      }));

      return mediaItem;
    } catch (err) {
      console.error('[fileDropHandler] Failed to process media file:', err);
      return null;
    }
  }

  return null;
}

/**
 * Handles batch processing of multiple dropped files sequentially and non-blockingly.
 */
export async function processDroppedFileList(files: FileList | File[]): Promise<ProcessedDropResult> {
  const result: ProcessedDropResult = { items: [] };
  const fileArray = Array.from(files);

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const processed = await processSingleDroppedFile(file);

    if (processed) {
      if ('schedule' in processed && processed.schedule) {
        result.schedule = processed.schedule;
      } else {
        result.items.push(processed as PresentationItem);
      }
    }

    // Yield to the browser event loop between multiple files
    if (i < fileArray.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  return result;
}
