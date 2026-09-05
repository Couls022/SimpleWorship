import { Asset, PresentationItem } from '../types';
import { getDB } from '../db';

export class MediaStreamController {
  private objectUrl: string | null = null;
  private videoElement: HTMLVideoElement | HTMLAudioElement | null = null;
  private generation = 0;
  private currentSourceId: string | null = null;

  async load(sourceId: string | undefined, fallbackUrl: string | undefined): Promise<string | null> {
    const currentGen = ++this.generation;

    if (!sourceId && !fallbackUrl) {
      this.revokeCurrent();
      return null;
    }

    try {
      if (sourceId) {
        const db = await getDB();
        const asset = await db.get('assets', sourceId);
        
        // If the component unmounted or a new load was requested while fetching DB
        if (currentGen !== this.generation) {
          console.warn(`[MediaStreamController] Cancelled stale load for ${sourceId}`);
          return null;
        }

        if (asset?.blob) {
          this.revokeCurrent();
          this.objectUrl = URL.createObjectURL(asset.blob);
          this.currentSourceId = sourceId;

          if (this.videoElement) {
            this.videoElement.src = this.objectUrl;
            this.videoElement.load();
          }
          return this.objectUrl;
        } else if (asset?.url && !asset.url.startsWith('blob:')) {
          // Fallback for remote URLs or non-blob assets
          this.revokeCurrent();
          this.currentSourceId = sourceId;
          if (this.videoElement) {
            this.videoElement.src = asset.url;
            this.videoElement.load();
          }
          return asset.url;
        }
      }
      
      // Fallback if item itself has a valid non-blob URL
      if (fallbackUrl && !fallbackUrl.startsWith('blob:')) {
        this.revokeCurrent();
        this.currentSourceId = sourceId || fallbackUrl;
        return fallbackUrl;
      }
      
      // If the fallbackUrl IS a blob URL, we can't recreate it easily unless we know the sourceId.
      // If we don't have a sourceId, we just have to trust the existing blob URL (e.g. from local window).
      if (fallbackUrl && fallbackUrl.startsWith('blob:')) {
        this.revokeCurrent();
        this.currentSourceId = sourceId || fallbackUrl;
        return fallbackUrl;
      }

      return null;
    } catch (err) {
      console.error('[MediaStreamController] Failed to load media:', err);
      return null;
    }
  }

  replace(sourceId: string | undefined, fallbackUrl: string | undefined): Promise<string | null> {
    return this.load(sourceId, fallbackUrl);
  }

  attach(element: HTMLVideoElement | HTMLAudioElement | null) {
    this.videoElement = element;
    if (this.videoElement && this.objectUrl) {
      this.videoElement.src = this.objectUrl;
    }
  }

  play() {
    if (this.videoElement) {
      this.videoElement.play().catch(e => console.warn('[MediaStreamController] Play rejected:', e));
    }
  }

  pause() {
    if (this.videoElement) {
      this.videoElement.pause();
    }
  }

  seek(time: number) {
    if (this.videoElement && Number.isFinite(time)) {
      this.videoElement.currentTime = time;
    }
  }

  stop() {
    this.pause();
    this.seek(0);
  }

  private revokeCurrent() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.currentSourceId = null;
  }

  dispose() {
    this.generation++; // Cancel pending loads
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute('src');
      this.videoElement.load(); // Flush internal buffers
    }
    this.revokeCurrent();
    this.videoElement = null;
  }
}
