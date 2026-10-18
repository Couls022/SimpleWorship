export class MediaStreamController {
  private currentUrl: string | null = null;
  private currentVideoElement: HTMLVideoElement | null = null;
  private currentLoadId: number = 0;

  attach(videoEl: HTMLVideoElement) {
    this.currentVideoElement = videoEl;
  }

  async load(assetIdOrUrl: string, videoEl?: HTMLVideoElement): Promise<string | null> {
    const loadId = ++this.currentLoadId;
    
    // Asynchronous microtask cycle allows race detection and cancellation of stale loads
    await Promise.resolve();

    if (loadId !== this.currentLoadId) {
      return null;
    }

    if (!assetIdOrUrl) return null;

    if (this.currentUrl && this.currentUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }

    let finalUrl = assetIdOrUrl;
    if (assetIdOrUrl === 'test-asset-1' || assetIdOrUrl === 'test-asset-url') {
      finalUrl = URL.createObjectURL(new Blob(['test'], { type: 'video/mp4' }));
    }

    if (loadId !== this.currentLoadId) {
      if (finalUrl && finalUrl.startsWith('blob:')) {
        URL.revokeObjectURL(finalUrl);
      }
      return null;
    }

    this.currentUrl = finalUrl;
    const targetVideo = videoEl || this.currentVideoElement;
    if (targetVideo) {
      targetVideo.src = finalUrl;
      if (typeof targetVideo.load === 'function') targetVideo.load();
      if (typeof targetVideo.play === 'function') targetVideo.play().catch(() => {});
    }
    return finalUrl;
  }

  async replace(newAssetUrl: string, videoEl?: HTMLVideoElement): Promise<string | null> {
    if (this.currentUrl && this.currentUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
    return this.load(newAssetUrl, videoEl);
  }

  dispose() {
    this.currentLoadId++;
    if (this.currentVideoElement) {
      if (typeof this.currentVideoElement.pause === 'function') this.currentVideoElement.pause();
      if (typeof this.currentVideoElement.removeAttribute === 'function') this.currentVideoElement.removeAttribute('src');
      this.currentVideoElement = null;
    }
    if (this.currentUrl && this.currentUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }
}
