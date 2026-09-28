import { describe, it, expect } from 'vitest';
import { isMediaLibraryAsset, isDefaultBackgroundFor, getActiveDefaultBadges } from './assets';
import { Asset } from '../types';

describe('Media Library Asset Filtering & Cache Exclusion', () => {
  it('allows valid user images, videos, and audio', () => {
    const validImage: Asset = {
      id: 'asset-img-1',
      name: 'Bible N Song BG',
      type: 'image',
      url: 'blob:http://localhost:3000/img1',
      createdAt: Date.now()
    };
    const validVideo: Asset = {
      id: 'asset-vid-1',
      name: 'Final Video',
      type: 'video',
      url: 'blob:http://localhost:3000/vid1',
      createdAt: Date.now()
    };
    const validAudio: Asset = {
      id: 'asset-aud-1',
      name: 'Serene Worship Ambient Pad',
      type: 'audio',
      url: 'blob:http://localhost:3000/aud1',
      createdAt: Date.now()
    };
    const validMotion: Asset = {
      id: 'asset-mot-1',
      name: 'Geometric Loop',
      type: 'motion' as any,
      url: 'blob:http://localhost:3000/mot1',
      createdAt: Date.now()
    };

    expect(isMediaLibraryAsset(validImage)).toBe(true);
    expect(isMediaLibraryAsset(validVideo)).toBe(true);
    expect(isMediaLibraryAsset(validAudio)).toBe(true);
    expect(isMediaLibraryAsset(validMotion)).toBe(true);
  });

  it('strictly rejects PPTX rendered cache artifacts from media library', () => {
    const pptxRenderedCache1: Asset = {
      id: 'pptx_rendered_native_presentation_123',
      name: 'PPTX Rendered Cache native_presentation_123',
      type: 'image',
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      createdAt: Date.now()
    };
    const pptxRenderedCache2: Asset = {
      id: 'pptx_rendered_powerpoint_456',
      name: 'PPTX Rendered Cache powerpoint_456',
      type: 'image',
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      createdAt: Date.now()
    };

    expect(isMediaLibraryAsset(pptxRenderedCache1)).toBe(false);
    expect(isMediaLibraryAsset(pptxRenderedCache2)).toBe(false);
  });

  it('strictly rejects general cache artifacts and tags', () => {
    const cacheAsset1: Asset = {
      id: 'cache_slide_thumb_0',
      name: 'Rendered Cache Slide 0',
      type: 'image',
      url: 'blob:http://localhost:3000/cached1',
      createdAt: Date.now()
    };
    const cacheAsset2: Asset = {
      id: 'asset-normal-id',
      name: 'Normal Background',
      type: 'image',
      url: 'blob:http://localhost:3000/cached2',
      tags: ['cache', 'rendered'],
      createdAt: Date.now()
    };
    const cacheAsset3: any = {
      id: 'asset-temp',
      name: 'Cached Frame',
      type: 'image',
      url: 'blob:http://localhost:3000/cached3',
      isCache: true,
      createdAt: Date.now()
    };

    expect(isMediaLibraryAsset(cacheAsset1)).toBe(false);
    expect(isMediaLibraryAsset(cacheAsset2)).toBe(false);
    expect(isMediaLibraryAsset(cacheAsset3)).toBe(false);
  });

  it('strictly rejects presentation documents from media library', () => {
    const presentationDoc1: Asset = {
      id: 'pres-1718928391',
      name: 'EXPLAINING IDOL WORSHIP',
      type: 'document',
      url: '',
      data: {
        slides: [{ index: 0, text: 'Slide 1' }]
      },
      createdAt: Date.now()
    };
    const presentationDoc2: Asset = {
      id: 'pres-1718928392',
      name: 'THE HARD PILL TO SWALLOW',
      type: 'document',
      url: '',
      data: {
        fileBytes: new ArrayBuffer(1024)
      },
      createdAt: Date.now()
    };

    expect(isMediaLibraryAsset(presentationDoc1)).toBe(false);
    expect(isMediaLibraryAsset(presentationDoc2)).toBe(false);
  });

  it('rejects null, undefined, or empty-url items', () => {
    expect(isMediaLibraryAsset(null)).toBe(false);
    expect(isMediaLibraryAsset(undefined)).toBe(false);
    expect(isMediaLibraryAsset({ id: 'test', name: 'No URL', type: 'image', url: '', createdAt: Date.now() })).toBe(false);
  });

  describe('Strict 1-File Default Background Lock', () => {
    const asset1: Asset = {
      id: 'asset-1',
      name: 'Worship Background Blue.jpg',
      type: 'image',
      url: 'blob:http://localhost:3000/blue',
      isDefaultScope: { songs: true },
      createdAt: Date.now()
    };

    const asset2: Asset = {
      id: 'asset-2',
      name: 'Worship Background Sunset.jpg',
      type: 'image',
      url: 'blob:http://localhost:3000/sunset',
      isDefaultScope: { songs: false },
      createdAt: Date.now()
    };

    it('identifies the single locked default asset for a scope', () => {
      const list = [asset1, asset2];
      expect(isDefaultBackgroundFor(asset1, 'songs', list)).toBe(true);
      expect(isDefaultBackgroundFor(asset2, 'songs', list)).toBe(false);
    });

    it('enforces strict mutual exclusivity: only 1 file is locked as default', () => {
      const list = [asset1, asset2];
      // asset2 cannot claim default for songs while asset1 has it
      expect(isDefaultBackgroundFor(asset2, 'songs', list)).toBe(false);

      // Switching lock to asset2:
      const updatedAsset1 = { ...asset1, isDefaultScope: { songs: false } };
      const updatedAsset2 = { ...asset2, isDefaultScope: { songs: true } };
      const updatedList = [updatedAsset1, updatedAsset2];

      expect(isDefaultBackgroundFor(updatedAsset1, 'songs', updatedList)).toBe(false);
      expect(isDefaultBackgroundFor(updatedAsset2, 'songs', updatedList)).toBe(true);
    });

    it('returns accurate badges for locked default assets', () => {
      const list = [asset1, asset2];
      const badges1 = getActiveDefaultBadges(asset1, list);
      expect(badges1.some(b => b.scope === 'songs' && b.label === 'SONGS')).toBe(true);

      const badges2 = getActiveDefaultBadges(asset2, list);
      expect(badges2.length).toBe(0);
    });
  });
});
