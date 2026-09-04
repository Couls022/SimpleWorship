import { PresentationItem } from '../types';
import { getDB } from '../db';
import { isValidPptxBinary } from '../utils/pptxValidator';

export type ResolvedContentType = 'song' | 'bible' | 'image' | 'video' | 'audio' | 'pptx' | 'camera' | 'announcement' | 'countdown' | 'unknown';

export class PresentationContentResolver {
  static detectContentType(item: PresentationItem | null | undefined): ResolvedContentType {
    if (!item) return 'unknown';
    
    // Explicit types
    if (item.type === 'song') return 'song';
    if (item.type === 'bible') return 'bible';
    if (item.type === 'video') return 'video';
    if (item.type === 'audio') return 'audio';
    if (item.type === 'image') return 'image';
    if (item.type === 'presentation' || item.type === 'ppt') return 'pptx';
    if (item.type === 'camera') return 'camera';
    if (item.type === 'announcement') return 'announcement';
    if (item.type === 'countdown') return 'countdown';
    
    // Media type analysis
    if (item.type === 'media') {
      const type = item.data?.type || '';
      const url = item.data?.url || item.customBackgroundUrl || '';
      const isVideo = item.data?.isVideo ?? false;
      const isAudio = item.data?.isAudio ?? false;
      
      if (isAudio || type === 'audio' || this.isAudioUrl(url)) {
        return 'audio';
      }
      if (isVideo || type === 'video' || type === 'motion' || this.isVideoUrl(url)) {
        return 'video';
      }
      if (type === 'image' || this.isImageUrl(url)) {
        return 'image';
      }
    }
    
    return 'unknown';
  }

  static getMediaFormat(item: PresentationItem | null | undefined): string {
    if (!item) return '';
    const name = item.name || '';
    const url = item.data?.url || item.customBackgroundUrl || '';
    const str = `${name} ${url}`.toLowerCase();
    
    // Audio formats
    if (str.includes('.mp3') || str.includes('audio/mp3') || str.includes('audio/mpeg')) return 'MP3';
    if (str.includes('.wav') || str.includes('audio/wav')) return 'WAV';
    if (str.includes('.m4a') || str.includes('audio/m4a') || str.includes('audio/x-m4a')) return 'M4A';
    if (str.includes('.aac') || str.includes('audio/aac')) return 'AAC';
    if (str.includes('.ogg') || str.includes('audio/ogg')) return 'OGG';
    if (str.includes('.flac') || str.includes('audio/flac')) return 'FLAC';
    if (str.includes('.wma')) return 'WMA';
    
    // Video formats
    if (str.includes('.mp4') || str.includes('video/mp4')) return 'MP4';
    if (str.includes('.webm') || str.includes('video/webm')) return 'WEBM';
    if (str.includes('.mov') || str.includes('video/quicktime')) return 'MOV';
    if (str.includes('.m4v')) return 'M4V';
    if (str.includes('.avi') || str.includes('video/x-msvideo')) return 'AVI';
    if (str.includes('.mkv')) return 'MKV';
    
    // Image formats
    if (str.includes('.png') || str.includes('image/png')) return 'PNG';
    if (str.includes('.jpg') || str.includes('.jpeg') || str.includes('image/jpeg')) return 'JPEG';
    if (str.includes('.webp') || str.includes('image/webp')) return 'WEBP';
    if (str.includes('.gif') || str.includes('image/gif')) return 'GIF';
    if (str.includes('.svg') || str.includes('image/svg+xml')) return 'SVG';
    
    if (item.type === 'audio' || item.data?.type === 'audio') return 'AUDIO';
    if (item.type === 'video' || item.data?.type === 'video' || item.data?.type === 'motion') return 'VIDEO';
    if (item.type === 'image' || item.data?.type === 'image') return 'IMAGE';
    if (item.type === 'presentation' || item.type === 'ppt') return 'PPTX';
    if (item.type === 'camera') return 'CAMERA';
    
    return '';
  }

  static isVideoUrl(url?: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.startsWith('data:video/') || lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.avi') || lower.endsWith('.ogv');
  }

  static isImageUrl(url?: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.startsWith('data:image/') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif') || lower.endsWith('.svg');
  }

  static isAudioUrl(url?: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.startsWith('data:audio/') || lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.m4a') || lower.endsWith('.aac') || lower.endsWith('.flac');
  }

  /**
   * Resolves and hydrates binary fileBytes (such as PPTX) for an item that may have been stripped during IPC broadcast.
   */
  static async hydrateItemBinaryIfNeeded(item: PresentationItem | null | undefined): Promise<PresentationItem | null | undefined> {
    if (!item || !item.contentId) return item;
    
    // Only PPTX needs hydration from broadcast currently
    const type = this.detectContentType(item);
    if (type !== 'pptx') return item;
    
    if (isValidPptxBinary(item.data?.fileBytes)) {
      return item; // Already hydrated
    }
    
    try {
      const db = await getDB();
      const asset = await db.get('assets', item.contentId);
      
      if (asset?.data?.fileBytes && isValidPptxBinary(asset.data.fileBytes)) {
        return {
          ...item,
          data: {
            ...item.data,
            fileBytes: asset.data.fileBytes
          }
        };
      }
    } catch (e) {
      console.error('[PresentationContentResolver] Failed to hydrate PPTX binary:', e);
    }
    
    return item;
  }
}
