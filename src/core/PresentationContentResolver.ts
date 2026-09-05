import { PresentationItem } from '../types';
import { getDB } from '../db';
import { isValidPptxBinary } from '../utils/pptxValidator';

export type ResolvedContentType = 'song' | 'bible' | 'image' | 'video' | 'audio' | 'pptx' | 'camera' | 'announcement' | 'countdown' | 'unknown';

export interface FormatBadgeInfo {
  category: ResolvedContentType;
  format: string;
  badgeLabel: string;
  badgeColorClass: string;
  borderColorClass: string;
  bgColorClass: string;
  textColorClass: string;
  subLabel: string;
}

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
    
    // Check item.data flags and types
    const type = item.data?.type || '';
    const url = item.data?.url || item.customBackgroundUrl || '';
    const isVideo = item.data?.isVideo === true;
    const isAudio = item.data?.isAudio === true;
    
    if (isAudio || type === 'audio' || (typeof type === 'string' && type.startsWith('audio/')) || this.isAudioUrl(url) || this.isAudioName(item.name || '')) {
      return 'audio';
    }
    if (isVideo || type === 'video' || type === 'motion' || (typeof type === 'string' && type.startsWith('video/')) || this.isVideoUrl(url) || this.isVideoName(item.name || '')) {
      return 'video';
    }
    if (type === 'image' || (typeof type === 'string' && type.startsWith('image/')) || this.isImageUrl(url) || this.isImageName(item.name || '')) {
      return 'image';
    }
    if (item.type === 'media') {
      return 'image';
    }
    
    return 'unknown';
  }

  static getMediaFormat(item: PresentationItem | null | undefined): string {
    if (!item) return '';
    
    // Check explicit format stored in item.data
    if (item.data?.format && typeof item.data.format === 'string') {
      return item.data.format.toUpperCase();
    }

    const name = item.name || '';
    const url = item.data?.url || item.customBackgroundUrl || '';
    const srcFile = item.data?.sourceFileName || '';
    const str = `${name} ${url} ${srcFile}`.toLowerCase();
    
    // Video formats
    if (str.includes('.mp4') || str.includes('video/mp4')) return 'MP4';
    if (str.includes('.webm') || str.includes('video/webm')) return 'WEBM';
    if (str.includes('.mov') || str.includes('video/quicktime')) return 'MOV';
    if (str.includes('.m4v')) return 'M4V';
    if (str.includes('.avi') || str.includes('video/x-msvideo')) return 'AVI';
    if (str.includes('.mkv')) return 'MKV';
    
    // Audio formats
    if (str.includes('.mp3') || str.includes('audio/mp3') || str.includes('audio/mpeg')) return 'MP3';
    if (str.includes('.wav') || str.includes('audio/wav')) return 'WAV';
    if (str.includes('.m4a') || str.includes('audio/m4a') || str.includes('audio/x-m4a')) return 'M4A';
    if (str.includes('.aac') || str.includes('audio/aac')) return 'AAC';
    if (str.includes('.ogg') || str.includes('audio/ogg')) return 'OGG';
    if (str.includes('.flac') || str.includes('audio/flac')) return 'FLAC';
    if (str.includes('.wma')) return 'WMA';
    
    // Presentation formats
    if (str.includes('.pptx') || item.type === 'presentation') return 'PPTX';
    if (str.includes('.ppt') || item.type === 'ppt') return 'PPT';

    // Image formats
    if (str.includes('.png') || str.includes('image/png')) return 'PNG';
    if (str.includes('.jpg') || str.includes('.jpeg') || str.includes('image/jpeg')) return 'JPG';
    if (str.includes('.webp') || str.includes('image/webp')) return 'WEBP';
    if (str.includes('.gif') || str.includes('image/gif')) return 'GIF';
    if (str.includes('.svg') || str.includes('image/svg+xml')) return 'SVG';
    if (str.includes('.bmp')) return 'BMP';
    
    if (item.type === 'song') return 'SONG';
    if (item.type === 'bible') return 'BIBLE';
    if (item.type === 'audio' || item.data?.isAudio || item.data?.type === 'audio') return 'AUDIO';
    if (item.type === 'video' || item.data?.isVideo || item.data?.type === 'video' || item.data?.type === 'motion') return 'VIDEO';
    if (item.type === 'image' || item.data?.type === 'image') return 'IMAGE';
    if (item.type === 'camera') return 'CAM';
    if (item.type === 'countdown') return 'TIMER';
    if (item.type === 'announcement') return 'NOTICE';
    
    return 'MEDIA';
  }

  static getFormatBadgeInfo(item: PresentationItem | null | undefined): FormatBadgeInfo {
    const category = this.detectContentType(item);
    const format = this.getMediaFormat(item);

    switch (category) {
      case 'video':
        return {
          category: 'video',
          format,
          badgeLabel: format || 'VIDEO',
          badgeColorClass: 'bg-cyan-950/90 text-cyan-300 border-cyan-500/50',
          borderColorClass: 'border-cyan-500/30',
          bgColorClass: 'bg-[#0b1b24]',
          textColorClass: 'text-cyan-400',
          subLabel: `${format} Video`
        };
      case 'audio':
        return {
          category: 'audio',
          format,
          badgeLabel: format || 'AUDIO',
          badgeColorClass: 'bg-purple-950/90 text-purple-300 border-purple-500/50',
          borderColorClass: 'border-purple-500/30',
          bgColorClass: 'bg-[#180f24]',
          textColorClass: 'text-purple-400',
          subLabel: `${format} Audio Track`
        };
      case 'image':
        return {
          category: 'image',
          format,
          badgeLabel: format || 'IMAGE',
          badgeColorClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50',
          borderColorClass: 'border-emerald-500/30',
          bgColorClass: 'bg-[#0f1f16]',
          textColorClass: 'text-emerald-400',
          subLabel: `${format} Image`
        };
      case 'pptx':
        return {
          category: 'pptx',
          format,
          badgeLabel: format || 'PPTX',
          badgeColorClass: 'bg-amber-950/90 text-amber-300 border-amber-500/50',
          borderColorClass: 'border-amber-500/30',
          bgColorClass: 'bg-[#221808]',
          textColorClass: 'text-amber-400',
          subLabel: `${item?.data?.slides?.length || 1} Slides • PowerPoint`
        };
      case 'song':
        return {
          category: 'song',
          format: 'SONG',
          badgeLabel: 'SONG',
          badgeColorClass: 'bg-sky-950/90 text-sky-300 border-sky-500/50',
          borderColorClass: 'border-sky-500/30',
          bgColorClass: 'bg-[#0c1926]',
          textColorClass: 'text-sky-400',
          subLabel: 'Worship Song'
        };
      case 'bible':
        return {
          category: 'bible',
          format: 'BIBLE',
          badgeLabel: 'BIBLE',
          badgeColorClass: 'bg-rose-950/90 text-rose-300 border-rose-500/50',
          borderColorClass: 'border-rose-500/30',
          bgColorClass: 'bg-[#240e16]',
          textColorClass: 'text-rose-400',
          subLabel: 'Scripture Verse'
        };
      case 'camera':
        return {
          category: 'camera',
          format: 'CAM',
          badgeLabel: 'CAMERA',
          badgeColorClass: 'bg-lime-950/90 text-lime-300 border-lime-500/50',
          borderColorClass: 'border-lime-500/30',
          bgColorClass: 'bg-[#15200c]',
          textColorClass: 'text-lime-400',
          subLabel: 'Live Video Feed'
        };
      case 'announcement':
        return {
          category: 'announcement',
          format: 'NOTICE',
          badgeLabel: 'NOTICE',
          badgeColorClass: 'bg-blue-950/90 text-blue-300 border-blue-500/50',
          borderColorClass: 'border-blue-500/30',
          bgColorClass: 'bg-[#0e1626]',
          textColorClass: 'text-blue-400',
          subLabel: 'Announcement Slide'
        };
      case 'countdown':
        return {
          category: 'countdown',
          format: 'TIMER',
          badgeLabel: 'COUNTDOWN',
          badgeColorClass: 'bg-orange-950/90 text-orange-300 border-orange-500/50',
          borderColorClass: 'border-orange-500/30',
          bgColorClass: 'bg-[#24150b]',
          textColorClass: 'text-orange-400',
          subLabel: 'Timer Display'
        };
      default:
        return {
          category: 'unknown',
          format: 'MEDIA',
          badgeLabel: 'MEDIA',
          badgeColorClass: 'bg-gray-800 text-gray-300 border-gray-600/50',
          borderColorClass: 'border-gray-700',
          bgColorClass: 'bg-[#16171d]',
          textColorClass: 'text-gray-400',
          subLabel: 'Presentation Item'
        };
    }
  }

  static isVideoUrl(url?: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.startsWith('data:video/') || lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.avi') || lower.endsWith('.ogv') || lower.endsWith('.mkv');
  }

  static isImageUrl(url?: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.startsWith('data:image/') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif') || lower.endsWith('.svg') || lower.endsWith('.bmp');
  }

  static isAudioUrl(url?: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.startsWith('data:audio/') || lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.m4a') || lower.endsWith('.aac') || lower.endsWith('.flac') || lower.endsWith('.wma');
  }

  static isVideoName(name?: string): boolean {
    if (!name || typeof name !== 'string') return false;
    return /\.(mp4|webm|mov|mkv|m4v|avi|ogv)$/i.test(name);
  }

  static isAudioName(name?: string): boolean {
    if (!name || typeof name !== 'string') return false;
    return /\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i.test(name);
  }

  static isImageName(name?: string): boolean {
    if (!name || typeof name !== 'string') return false;
    return /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(name);
  }
}
