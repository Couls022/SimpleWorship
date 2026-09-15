import { Asset, PresentationItem } from '../types';
import { useStore } from '../store/useStore';
import { getDB, resolveAssetUrl, unresolveAssetUrl } from '../db';
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

    // Fast path: if the source has not changed and objectUrl is already valid, return immediately
    const effectiveSourceId = sourceId || (fallbackUrl && !fallbackUrl.startsWith('http') && !fallbackUrl.startsWith('blob:') && !fallbackUrl.startsWith('data:') ? fallbackUrl : undefined);
    const targetSource = effectiveSourceId || fallbackUrl;
    if (targetSource && this.currentSourceId === targetSource && this.objectUrl) {
      return this.objectUrl;
    }

    try {
      // Step 1: Check memory caches first (0ms latency, zero I/O)
      let resolvedUrl: string | undefined;
      if (effectiveSourceId) {
        resolvedUrl = resolveAssetUrl(effectiveSourceId) || dbApi.getCachedUrl(effectiveSourceId);
      }
      if (!resolvedUrl && fallbackUrl) {
        resolvedUrl = resolveAssetUrl(fallbackUrl) || dbApi.getCachedUrl(fallbackUrl);
      }

      // Step 2: If not in memory cache, query IndexedDB directly by key (never getAll!)
      if (!resolvedUrl && effectiveSourceId) {
        const db = await getDB();
        const asset: any = await db.get('assets', effectiveSourceId);

        if (currentGen !== this.generation) {
          return null;
        }

        if (asset?.blob) {
          resolvedUrl = dbApi.getOrCreateAssetUrl(effectiveSourceId, asset.blob);
        } else if (asset?.url) {
          resolvedUrl = asset.url;
        }
      }

      // Step 3: If fallbackUrl is provided, reverse-lookup asset ID to find local window object URL
      if (!resolvedUrl && fallbackUrl) {
        const potentialId = unresolveAssetUrl(fallbackUrl);
        if (potentialId && potentialId !== fallbackUrl) {
          resolvedUrl = resolveAssetUrl(potentialId) || dbApi.getCachedUrl(potentialId);
          if (!resolvedUrl) {
            const db = await getDB();
            const asset: any = await db.get('assets', potentialId);
            if (asset?.blob) {
              resolvedUrl = dbApi.getOrCreateAssetUrl(potentialId, asset.blob);
            }
          }
        }
        if (!resolvedUrl) {
          resolvedUrl = fallbackUrl;
        }
      }

      if (currentGen !== this.generation) {
        return null;
      }

      if (resolvedUrl) {
        if (this.objectUrl !== resolvedUrl) {
          this.revokeCurrent();
          this.objectUrl = resolvedUrl;
          this.isOwnedBlob = false;
          this.currentSourceId = targetSource || resolvedUrl;

          if (this.videoElement) {
            this.videoElement.src = this.objectUrl;
            this.videoElement.load();
          }
        } else {
          this.currentSourceId = targetSource || resolvedUrl;
        }
        return this.objectUrl;
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
    if (this.videoElement && this.objectUrl && this.videoElement.src !== this.objectUrl) {
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
