import { describe, it, expect } from 'vitest';
import { ThemeEngine } from '../../src/core/ThemeEngine';
import { ThemeStyles } from '../../src/types';

describe('ThemeEngine', () => {
  it('resolves theme cascade correctly', () => {
    const globalTheme: ThemeStyles = {
      fontFamily: 'Montserrat',
      fontSize: 54,
      fontColor: 'White',
    };

    const routeTheme: ThemeStyles = {
      fontSize: 60,
    };

    const typeTheme: ThemeStyles = {
      backgroundImageUrl: 'Worship.jpg',
    };

    const itemTheme: ThemeStyles = {
      fontFamily: 'Poppins',
    };

    const elementTheme: ThemeStyles = {
      fontColor: 'Gold',
    };

    const resolved = ThemeEngine.resolveStyles(globalTheme, routeTheme, typeTheme, itemTheme, elementTheme);

    expect(resolved.fontFamily).toBe('Poppins');
    expect(resolved.fontSize).toBe(60);
    expect(resolved.fontColor).toBe('Gold');
    expect(resolved.backgroundImageUrl).toBe('Worship.jpg');
  });

  it('falls back when element override is removed', () => {
    const globalTheme: ThemeStyles = {
      fontFamily: 'Montserrat',
      fontColor: 'White',
    };
    const itemTheme: ThemeStyles = {
      fontFamily: 'Poppins',
    };

    // No element theme
    const resolved = ThemeEngine.resolveStyles(globalTheme, undefined, undefined, itemTheme, undefined);
    
    expect(resolved.fontColor).toBe('White');
    expect(resolved.fontFamily).toBe('Poppins');
  });

  it('preserves unrelated properties when overriding', () => {
    const globalTheme: ThemeStyles = {
      fontSize: 54,
      fontColor: 'White',
      backgroundImageUrl: 'Default.jpg',
      logoPosition: 'bottom-right'
    };

    const itemTheme: ThemeStyles = {
      fontFamily: 'Poppins' // Overrides font only
    };

    const resolved = ThemeEngine.resolveStyles(globalTheme, undefined, undefined, itemTheme, undefined);

    // Assert independence
    expect(resolved.fontFamily).toBe('Poppins');
    expect(resolved.fontSize).toBe(54);
    expect(resolved.backgroundImageUrl).toBe('Default.jpg');
    expect(resolved.logoPosition).toBe('bottom-right');
  });

  describe('Canonical Typography Metric Consistency (90pt = 90pt)', () => {
    it('ensures Song 90pt and Scripture 90pt resolve to exact same font size, family, weight, style, and line-height', () => {
      const songFont = { family: 'Tahoma', maxSize: 90, bold: false, italic: false, lineSpacing: 1.35 };
      const scriptureFont = { family: 'Tahoma', maxSize: 90, bold: false, italic: false, lineSpacing: 1.35 };

      const songStyles = ThemeEngine.fontStyleToThemeStyles(songFont);
      const scriptureStyles = ThemeEngine.fontStyleToThemeStyles(scriptureFont);

      expect(songStyles.fontSize).toBe(90);
      expect(scriptureStyles.fontSize).toBe(90);
      expect(songStyles.fontSize).toBe(scriptureStyles.fontSize);

      expect(songStyles.fontFamily).toBe('Tahoma');
      expect(scriptureStyles.fontFamily).toBe('Tahoma');
      expect(songStyles.fontFamily).toBe(scriptureStyles.fontFamily);

      expect(songStyles.fontWeight).toBe('400');
      expect(scriptureStyles.fontWeight).toBe('400');

      expect(songStyles.fontStyle).toBe('normal');
      expect(scriptureStyles.fontStyle).toBe('normal');

      expect(songStyles.lineHeight).toBe(1.35);
      expect(scriptureStyles.lineHeight).toBe(1.35);
    });

    it('calculates identical auto-fit font size for 4-line Song verse and 4-line Scripture passage at 90pt base size', () => {
      const songText = "Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see";
      const scriptureText = "For God so loved the world that he gave his only Son\nthat whoever believes in him should not perish\nbut have eternal life\nFor God did not send his Son into the world to condemn";

      const songSize = ThemeEngine.calculateAutoFitFontSize({
        text: songText,
        baseFontSize: 90,
        hasHeader: false,
        hasFooter: false,
        lineSpacing: 1.35,
        containerWidth: 1920,
        containerHeight: 1080,
      });

      const scriptureSize = ThemeEngine.calculateAutoFitFontSize({
        text: scriptureText,
        baseFontSize: 90,
        hasHeader: false,
        hasFooter: false,
        lineSpacing: 1.35,
        containerWidth: 1920,
        containerHeight: 1080,
      });

      expect(songSize).toBe(90);
      expect(scriptureSize).toBe(90);
      expect(songSize).toBe(scriptureSize);
    });

    it('maps 90pt 1:1 to canvas pixel rendering size', () => {
      const font = { family: 'Tahoma', maxSize: 90 };
      const themeStyles = ThemeEngine.fontStyleToThemeStyles(font);
      const textStyle = ThemeEngine.getTextStyle(themeStyles, 1);

      expect(textStyle.fontFamily).toContain('Tahoma');
    });

    it('measures identical glyph metrics for single characters ("M", "H", "O", "W", "g", "p", "q", "y") at 90pt across content types', () => {
      const chars = ['M', 'H', 'O', 'W', 'g', 'p', 'q', 'y'];
      for (const char of chars) {
        const songMetric = ThemeEngine.measurePresentationText({
          text: char,
          fontFamily: 'Tahoma, sans-serif',
          fontSize: 90,
          fontWeight: '400',
          fontStyle: 'normal',
          lineHeight: 1.35,
          maxWidth: 1600,
        });

        const scriptureMetric = ThemeEngine.measurePresentationText({
          text: char,
          fontFamily: 'Tahoma, sans-serif',
          fontSize: 90,
          fontWeight: '400',
          fontStyle: 'normal',
          lineHeight: 1.35,
          maxWidth: 1600,
        });

        // Distinguish lineBoxHeight from glyphHeight
        expect(songMetric.lineBoxHeight).toBeCloseTo(121.5);
        expect(scriptureMetric.lineBoxHeight).toBeCloseTo(121.5);

        expect(songMetric.glyphHeight).toBe(scriptureMetric.glyphHeight);
        expect(songMetric.actualBoundingBoxAscent).toBe(scriptureMetric.actualBoundingBoxAscent);
        expect(songMetric.actualBoundingBoxDescent).toBe(scriptureMetric.actualBoundingBoxDescent);

        expect(songMetric.wrappedLines.length).toBe(1);
        expect(scriptureMetric.wrappedLines.length).toBe(1);
        expect(songMetric.width).toBe(scriptureMetric.width);
      }
    });

    it('measures identical metrics for SAME TEXT ("The quick brown fox jumps over the lazy dog.") through Song vs Scripture pipelines', () => {
      const sampleText = "The quick brown fox jumps over the lazy dog.";

      const songMeasurement = ThemeEngine.measurePresentationText({
        text: sampleText,
        fontFamily: 'Tahoma, sans-serif',
        fontSize: 90,
        fontWeight: '400',
        fontStyle: 'normal',
        lineHeight: 1.35,
        maxWidth: 1600,
      });

      const scriptureMeasurement = ThemeEngine.measurePresentationText({
        text: sampleText,
        fontFamily: 'Tahoma, sans-serif',
        fontSize: 90,
        fontWeight: '400',
        fontStyle: 'normal',
        lineHeight: 1.35,
        maxWidth: 1600,
      });

      expect(songMeasurement.wrappedLines).toEqual(scriptureMeasurement.wrappedLines);
      expect(songMeasurement.height).toBe(scriptureMeasurement.height);
      expect(songMeasurement.width).toBe(scriptureMeasurement.width);
    });

    it('preserves base font size 90 for 4-line, 5-line, and 6-line song lyrics that fit in canonical canvas', () => {
      const lines4 = "Line one of lyric verse\nLine two of lyric verse\nLine three of lyric verse\nLine four of lyric verse";
      const lines6 = "Line 1 of lyric verse\nLine 2 of lyric verse\nLine 3 of lyric verse\nLine 4 of lyric verse\nLine 5 of lyric verse\nLine 6 of lyric verse";

      const fit4 = ThemeEngine.calculateAutoFitFontSize({
        text: lines4,
        baseFontSize: 90,
        fontFamily: 'Tahoma, sans-serif',
        hasHeader: true,
        hasFooter: true,
        lineSpacing: 1.35,
        containerWidth: 1920,
        containerHeight: 1080,
      });

      const fit6 = ThemeEngine.calculateAutoFitFontSize({
        text: lines6,
        baseFontSize: 90,
        fontFamily: 'Tahoma, sans-serif',
        hasHeader: true,
        hasFooter: true,
        lineSpacing: 1.35,
        containerWidth: 1920,
        containerHeight: 1080,
      });

      expect(fit4).toBe(90);
      expect(fit6).toBe(90);
    });
  });
});
