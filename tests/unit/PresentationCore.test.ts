import { describe, it, expect } from 'vitest';
import { PresentationCore } from '../../src/core/PresentationCore';
import { PresentationItem, Song, Schedule } from '../../src/types';

describe('PresentationCore', () => {
  it('generates correct slides for a song item from availableSongs', () => {
    const item: PresentationItem = {
      id: 'item-1',
      type: 'song',
      contentId: 'song-1',
      name: 'Amazing Grace',
    };

    const availableSongs: Song[] = [
      {
        id: 'song-1',
        title: 'Amazing Grace',
        lyrics: '[Verse 1]\nAmazing grace how sweet the sound\n\n[Chorus]\nI once was lost',
        sections: [],
      }
    ];

    const slides = PresentationCore.generateSlides(item, availableSongs);
    
    expect(slides).toHaveLength(2);
    expect(slides[0].title).toBe('Verse 1');
    expect(slides[0].text).toContain('Amazing grace');
    expect(slides[1].title).toBe('Chorus');
    expect(slides[1].text).toContain('I once was lost');
  });

  it('generates correct slides for bible verses', () => {
    const item: PresentationItem = {
      id: 'item-2',
      type: 'bible',
      name: "John 3:16",
      contentId: "bible-1",
      data: {
        text: 'For God so loved the world...\n\nthat he gave his one and only Son...',
        reference: 'John 3:16'
      }
    };

    const slides = PresentationCore.generateSlides(item);
    
    expect(slides).toHaveLength(2);
    expect(slides[0].text).toBe('For God so loved the world...');
    expect(slides[1].text).toBe('that he gave his one and only Son...');
  });

  it('generates a slide for media', () => {
    const item: PresentationItem = {
      id: 'item-3',
      type: 'video',
      name: "Welcome Loop",
      contentId: "video-1",
      data: {
        url: 'video.mp4',
        type: 'video'
      }
    };

    const slides = PresentationCore.generateSlides(item);
    
    expect(slides).toHaveLength(1);
    expect(slides[0].isVideo).toBe(true);
    expect(slides[0].backgroundUrl).toBe('video.mp4');
  });

  it('safely handles empty or missing content', () => {
    const item: any = null;
    const slides = PresentationCore.generateSlides(item);
    expect(slides).toEqual([]);
  });
});
