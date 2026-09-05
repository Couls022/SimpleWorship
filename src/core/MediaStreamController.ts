import { Asset, PresentationItem } from '../types';
import { getDB } from '../db';
import { dbApi } from '../db';

export class MediaStreamController {
  private objectUrl: string | null = null;
  private isOwnedBlob = false;
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
        // Fast path: Check the memory cache first to avoid IndexedDB latency
        let resolvedUrl: string | undefined;
        if (typeof dbApi !== 'undefined' && dbApi?.getCachedUrl) {
          resolvedUrl = dbApi.getCachedUrl(sourceId);
        }

        if (!resolvedUrl) {
          // Check IndexedDB
          const db = await getDB();
          const asset: any = await db.get('assets', sourceId);

          // If component unmounted or new load was requested while waiting
          if (currentGen !== this.generation) {
            console.warn(`[MediaStreamController] Cancelled stale load for ${sourceId}`);
            return null;
          }

          if (asset?.blob) {
            this.revokeCurrent();
            this.objectUrl = URL.createObjectURL(asset.blob);
            this.isOwnedBlob = true;
            this.currentSourceId = sourceId;

            if (this.videoElement) {
              this.videoElement.src = this.objectUrl;
              this.videoElement.load();
            }
            return this.objectUrl;
          } else if (asset?.url) {
            resolvedUrl = asset.url;
          }
        }

        if (currentGen !== this.generation) {
          console.warn(`[MediaStreamController] Cancelled stale load for ${sourceId}`);
          return null;
        }

        if (resolvedUrl) {
          this.revokeCurrent();
          this.objectUrl = resolvedUrl;
          this.isOwnedBlob = false;
          this.currentSourceId = sourceId;

          if (this.videoElement) {
            this.videoElement.src = this.objectUrl;
            this.videoElement.load();
          }
          return this.objectUrl;
        }
      }

      // Fallback if item itself has a valid non-blob URL
      if (fallbackUrl && !fallbackUrl.startsWith('blob:')) {
        this.revokeCurrent();
        this.objectUrl = fallbackUrl;
        this.isOwnedBlob = false;
        this.currentSourceId = sourceId || fallbackUrl;
        if (this.videoElement) {
          this.videoElement.src = this.objectUrl;
          this.videoElement.load();
        }
        return fallbackUrl;
      }

      // If the fallbackUrl IS a blob URL, we just have to trust the existing blob URL
      if (fallbackUrl && fallbackUrl.startsWith('blob:')) {
        this.revokeCurrent();
        this.objectUrl = fallbackUrl;
        this.isOwnedBlob = false;
        this.currentSourceId = sourceId || fallbackUrl;
        if (this.videoElement) {
          this.videoElement.src = this.objectUrl;
          this.videoElement.load();
        }
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
    if (this.isOwnedBlob && this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
    this.objectUrl = null;
    this.isOwnedBlob = false;
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
