import type { CSSProperties } from 'react';
import { ThemeStyles, Theme, ContentType, SystemOptions, FontStyleOptions } from '../types';

export const DEFAULT_PRESENTATION_FONT_SIZE = 90;

export function normalizeFontSize(value?: any): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_PRESENTATION_FONT_SIZE;
}

export class ThemeEngine {
  static readonly DEFAULT_PRESENTATION_FONT_SIZE = DEFAULT_PRESENTATION_FONT_SIZE;
  static normalizeFontSize = normalizeFontSize;

  static fontStyleToThemeStyles(font?: FontStyleOptions | Partial<FontStyleOptions>): ThemeStyles {
    if (!font) return {};
    const normalizedFamily = font.family ? font.family : undefined;
    return {
      fontFamily: normalizedFamily,
      fontSize: font.maxSize ? normalizeFontSize(font.maxSize) : undefined,
      fontColor: font.color,
      fontWeight: font.bold ? '700' : '400',
      fontStyle: font.italic ? 'italic' : 'normal',
      textDecoration: font.underline ? 'underline' : 'none',
      textTransform: font.casing === 'uppercase' ? 'uppercase' : (font.casing === 'lowercase' ? 'lowercase' : (font.casing === 'titlecase' ? 'capitalize' : 'none')),
      textAlign: font.alignHorizontal,
      alignVertical: font.alignVertical,
      textShadow: font.shadowEnabled ?? true,
      shadowColor: font.shadowColor || 'rgba(0, 0, 0, 0.85)',
      shadowBlur: font.shadowBlur ?? 4,
      shadowOffsetX: font.shadowOffset ?? 0,
      shadowOffsetY: font.shadowOffset ?? 2,
      textOutline: font.outlineEnabled ?? true,
      outlineColor: font.outlineColor || 'rgba(0, 0, 0, 0.95)',
      outlineSize: font.outlineSize ?? 3,
      lineHeight: font.lineSpacing ?? 1.35,
      paddingHorizontal: font.marginLeft || font.marginRight ? Math.max(4, ((font.marginLeft || 0) + (font.marginRight || 0)) / 20) : undefined,
      paddingVertical: font.marginTop || font.marginBottom ? Math.max(3, ((font.marginTop || 0) + (font.marginBottom || 0)) / 20) : undefined,
    };
  }

  static getSystemFontForContent(systemOptions?: SystemOptions, contentType?: string): ThemeStyles {
    if (!systemOptions || !systemOptions.mainOutput) return {};
    const main = systemOptions.mainOutput;
    let font: FontStyleOptions | undefined;

    if (contentType === 'song') {
      font = main.song?.songFont;
    } else if (contentType === 'bible' || contentType === 'scripture') {
      font = main.scripture?.scriptureFont;
    } else if (contentType === 'presentation' || contentType === 'ppt' || contentType === 'announcement') {
      font = main.presentations?.contentFont || main.presentations?.titleFont;
    } else {
      font = main.general?.defaultFont;
    }

    font = font || main.general?.defaultFont;
    return this.fontStyleToThemeStyles(font);
  }

  // Merges themes: Global -> Output Group -> Content Type -> System Options Font -> Item (Editor Override) -> Element Override
  static resolveStyles(
    globalTheme: ThemeStyles,
    groupTheme?: ThemeStyles,
    typeTheme?: ThemeStyles,
    systemFontOverride?: ThemeStyles,
    itemTheme?: ThemeStyles,
    elementOverride?: ThemeStyles
  ): ThemeStyles {
    const layers = [globalTheme, groupTheme, typeTheme, systemFontOverride, itemTheme, elementOverride];
    const resolved: ThemeStyles = {};

    const legacyFonts = [
      'montserrat, sans-serif',
      'tahoma, sans-serif',
      'arial, sans-serif',
      'aptos, calibri, sans-serif',
      'inter, sans-serif',
      'montserrat',
      'tahoma',
      'arial',
      'aptos',
      'calibri',
      'inter'
    ];

    const isLegacyFont = (font?: string) => {
      if (!font) return false;
      const lower = font.toLowerCase().trim();
      return legacyFonts.some(f => lower === f || lower.startsWith(f));
    };

    for (const layer of layers) {
      if (!layer) continue;
      for (const [key, value] of Object.entries(layer)) {
        if (value !== undefined && value !== null) {
          (resolved as any)[key] = value;
        }
      }
    }

    if (systemFontOverride && systemFontOverride.fontFamily) {
      const itemFont = itemTheme?.fontFamily;
      const elemFont = elementOverride?.fontFamily;

      const itemHasExplicit = itemTheme?.isExplicitFont || (itemFont && !isLegacyFont(itemFont));
      const elemHasExplicit = elementOverride?.isExplicitFont || (elemFont && !isLegacyFont(elemFont));

      if (!elemHasExplicit && !itemHasExplicit) {
        resolved.fontFamily = systemFontOverride.fontFamily;
      }
    }

    resolved.fontSize = normalizeFontSize(resolved.fontSize);
    return resolved;
  }

  static getDefaultGlobalTheme(): ThemeStyles {
    return {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: DEFAULT_PRESENTATION_FONT_SIZE,
      fontColor: '#ffffff',
      fontWeight: '700',
      fontStyle: 'normal',
      textTransform: 'none',
      textAlign: 'center',
      alignVertical: 'middle',
      textShadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.85)',
      shadowBlur: 12,
      shadowOffsetX: 0,
      shadowOffsetY: 3,
      textOutline: true,
      outlineColor: 'rgba(0, 0, 0, 0.95)',
      outlineSize: 2,
      backgroundType: 'color',
      backgroundColor: '#000000',
      backgroundOverlayColor: '#000000',
      backgroundOverlayOpacity: 0,
      backgroundBlur: 0,
      logoPosition: 'bottom-right',
      logoSize: 72,
      logoOpacity: 0.85,
      showLogo: true,
      padding: '4rem',
      paddingHorizontal: 8,
      paddingVertical: 5,
      lineHeight: 1.35,
      letterSpacing: 0,
    };
  }

  private static sharedCanvas: HTMLCanvasElement | null = null;
  private static sharedCtx: CanvasRenderingContext2D | null = null;
  private static measurementCache = new Map<string, {
    wrappedLines: string[];
    lineCount: number;
    width: number;
    height: number;
    fontSize: number;
    lineHeight: number;
    lineBoxHeight: number;
    actualBoundingBoxAscent: number;
    actualBoundingBoxDescent: number;
    glyphHeight: number;
    ascent: number;
    descent: number;
  }>();

  private static getMeasurementContext(): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') return null;
    if (this.sharedCtx) return this.sharedCtx;
    try {
      this.sharedCanvas = document.createElement('canvas');
      this.sharedCtx = this.sharedCanvas.getContext('2d');
      return this.sharedCtx;
    } catch {
      return null;
    }
  }

  // Canonical Presentation Text Measurement Pipeline
  static measurePresentationText(options: {
    text: string;
    fontFamily?: string;
    fontSize: number;
    fontWeight?: string;
    fontStyle?: string;
    lineHeight?: number;
    maxWidth: number;
    isUppercase?: boolean;
  }): {
    wrappedLines: string[];
    lineCount: number;
    width: number;
    height: number;
    fontSize: number;
    lineHeight: number;
    lineBoxHeight: number;
    actualBoundingBoxAscent: number;
    actualBoundingBoxDescent: number;
    glyphHeight: number;
    ascent: number;
    descent: number;
  } {
    const {
      text,
      fontFamily = 'Tahoma, sans-serif',
      fontSize,
      fontWeight = '700',
      fontStyle = 'normal',
      lineHeight = 1.35,
      maxWidth,
      isUppercase = false,
    } = options;

    if (!text || text.trim().length === 0 || maxWidth <= 0 || fontSize <= 0) {
      const fallbackAscent = fontSize * 0.72;
      const fallbackDescent = fontSize * 0.08;
      return {
        wrappedLines: [],
        lineCount: 0,
        width: 0,
        height: 0,
        fontSize,
        lineHeight,
        lineBoxHeight: fontSize * lineHeight,
        actualBoundingBoxAscent: fallbackAscent,
        actualBoundingBoxDescent: fallbackDescent,
        glyphHeight: fallbackAscent + fallbackDescent,
        ascent: fallbackAscent,
        descent: fallbackDescent,
      };
    }

    const processedText = isUppercase ? text.toUpperCase() : text;
    const cacheKey = `${processedText}|${fontFamily}|${fontSize}|${fontWeight}|${fontStyle}|${lineHeight}|${Math.round(maxWidth)}|${isUppercase}`;
    const cached = this.measurementCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const ctx = this.getMeasurementContext();

    if (ctx) {
      try {
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      } catch {
        // Ignore canvas font set error
      }
    }

    let ascent = fontSize * 0.72;
    let descent = fontSize * 0.08;

    if (ctx) {
      try {
        const sampleText = processedText.trim() || 'M';
        const m = ctx.measureText(sampleText);
        if (m && typeof m.actualBoundingBoxAscent === 'number' && typeof m.actualBoundingBoxDescent === 'number' && m.actualBoundingBoxAscent > 0) {
          ascent = m.actualBoundingBoxAscent;
          descent = m.actualBoundingBoxDescent;
        }
      } catch {
        // Fallback
      }
    }

    const measureWordWidth = (word: string): number => {
      if (ctx) {
        try {
          const m = ctx.measureText(word);
          if (m && typeof m.width === 'number' && m.width > 0) {
            return m.width;
          }
        } catch {
          // Fallback
        }
      }
      let w = 0;
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (/[A-Z]/.test(char)) {
          w += fontSize * (/[IJS]/.test(char) ? 0.42 : /[MW]/.test(char) ? 0.72 : 0.58);
        } else if (/[a-z]/.test(char)) {
          w += fontSize * (/[ijl]/.test(char) ? 0.28 : /[mw]/.test(char) ? 0.65 : 0.46);
        } else if (/[0-9]/.test(char)) {
          w += fontSize * 0.52;
        } else if (/\s/.test(char)) {
          w += fontSize * 0.28;
        } else {
          w += fontSize * 0.35;
        }
      }
      return w;
    };

    const spaceWidth = measureWordWidth(' ');
    const paragraphs = processedText.split('\n');
    const wrappedLines: string[] = [];
    let maxLineWidth = 0;

    for (const p of paragraphs) {
      if (p.trim().length === 0) {
        wrappedLines.push('');
        continue;
      }

      const words = p.split(/\s+/);
      let currentLine = '';
      let currentLineWidth = 0;

      for (const word of words) {
        const wordWidth = measureWordWidth(word);

        if (!currentLine) {
          currentLine = word;
          currentLineWidth = wordWidth;
        } else if (currentLineWidth + spaceWidth + wordWidth <= maxWidth) {
          currentLine += ' ' + word;
          currentLineWidth += spaceWidth + wordWidth;
        } else {
          wrappedLines.push(currentLine);
          maxLineWidth = Math.max(maxLineWidth, currentLineWidth);
          currentLine = word;
          currentLineWidth = wordWidth;
        }
      }

      if (currentLine) {
        wrappedLines.push(currentLine);
        maxLineWidth = Math.max(maxLineWidth, currentLineWidth);
      }
    }

    const lineCount = wrappedLines.length;
    const lineBoxHeight = fontSize * lineHeight;
    const totalHeight = lineCount * lineBoxHeight;
    const glyphHeight = ascent + descent;

    const result = {
      wrappedLines,
      lineCount,
      width: maxLineWidth,
      height: totalHeight,
      fontSize,
      lineHeight,
      lineBoxHeight,
      actualBoundingBoxAscent: ascent,
      actualBoundingBoxDescent: descent,
      glyphHeight,
      ascent,
      descent,
    };

    // Bounded LRU cache size limit
    if (this.measurementCache.size > 500) {
      const firstKey = this.measurementCache.keys().next().value;
      if (firstKey) this.measurementCache.delete(firstKey);
    }
    this.measurementCache.set(cacheKey, result);

    return result;
  }

  // Canonical Auto-fit font size calculation across all renderers (Song, Scripture, Presentations)
  static calculateAutoFitFontSize(options: {
    text: string;
    baseFontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    hasHeader?: boolean;
    hasFooter?: boolean;
    scale?: number;
    minFontSize?: number;
    maxFontSize?: number;
    containerWidth?: number;
    containerHeight?: number;
    isUppercase?: boolean;
    lineSpacing?: number;
    widthPercent?: number;
    margins?: { left?: number; top?: number; right?: number; bottom?: number };
  }): number {
    const {
      text,
      baseFontSize: rawBaseFontSize,
      fontFamily = 'Tahoma, sans-serif',
      fontWeight = '700',
      fontStyle = 'normal',
      hasHeader = false,
      hasFooter = false,
      scale = 1,
      minFontSize = 24,
      maxFontSize = 160,
      containerWidth = 1920,
      containerHeight = 1080,
      isUppercase = false,
      lineSpacing = 1.35,
      widthPercent,
      margins
    } = options;

    const baseFontSize = normalizeFontSize(rawBaseFontSize);

    if (!text || text.trim().length === 0) {
      return Math.round(baseFontSize * scale);
    }

    // Usable screen real estate calculations in canonical canvas
    const marginLeft = margins?.left ?? 60;
    const marginRight = margins?.right ?? 60;
    const marginTop = margins?.top ?? 50;
    const marginBottom = margins?.bottom ?? 50;

    // Available text region dimensions considering widthPercent if configured
    const effectiveWidthFactor = widthPercent ? Math.min(1, Math.max(0.25, widthPercent / 100)) : 0.90;
    const rawAvailableWidth = (containerWidth - marginLeft - marginRight) * effectiveWidthFactor - 48;
    const availableWidth = Math.max(200, rawAvailableWidth);
    const headerAllowance = hasHeader ? Math.min(60, containerHeight * 0.08) : 0;
    const footerAllowance = hasFooter ? Math.min(50, containerHeight * 0.07) : 0;
    const availableHeight = Math.max(180, containerHeight - marginTop - marginBottom - headerAllowance - footerAllowance - 48);

    const targetFontSize = Math.min(maxFontSize, Math.max(minFontSize, baseFontSize));

    // Test if target font size fits without exceeding available canvas height or width
    const targetMeasurement = ThemeEngine.measurePresentationText({
      text,
      fontFamily,
      fontSize: targetFontSize,
      fontWeight,
      fontStyle,
      lineHeight: lineSpacing,
      maxWidth: availableWidth,
      isUppercase,
    });

    // If base font size fits comfortably in both dimensions, keep base font size
    if (targetMeasurement.height <= availableHeight && targetMeasurement.width <= availableWidth) {
      return Math.round(targetFontSize * scale);
    }

    // Binary search when overflow occurs
    let low = minFontSize;
    let high = targetFontSize;
    let bestFit = minFontSize;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const m = ThemeEngine.measurePresentationText({
        text,
        fontFamily,
        fontSize: mid,
        fontWeight,
        fontStyle,
        lineHeight: lineSpacing,
        maxWidth: availableWidth,
        isUppercase,
      });

      if (m.height <= availableHeight && m.width <= availableWidth) {
        bestFit = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const finalScaledSize = Math.round(bestFit * scale);
    return Math.max(Math.round(minFontSize * scale), finalScaledSize);
  }

  // Generates CSS text styling from ThemeStyles
  static getTextStyle(styles: ThemeStyles, scale: number = 1): CSSProperties {
    const textShadows: string[] = [];
    
    if (styles.textShadow) {
      const color = styles.shadowColor || 'rgba(0,0,0,0.85)';
      const blur = (styles.shadowBlur ?? 10) * scale;
      const x = (styles.shadowOffsetX ?? 0) * scale;
      const y = (styles.shadowOffsetY ?? 3) * scale;
      textShadows.push(`${x}px ${y}px ${blur}px ${color}`);
    }

    if (styles.textOutline) {
      const outColor = styles.outlineColor || 'rgba(0,0,0,0.95)';
      const size = Math.max(1, Math.round((styles.outlineSize ?? 2) * scale));
      // Multi-directional shadows to form crisp stroke
      textShadows.push(`-${size}px -${size}px 0 ${outColor}`);
      textShadows.push(`${size}px -${size}px 0 ${outColor}`);
      textShadows.push(`-${size}px ${size}px 0 ${outColor}`);
      textShadows.push(`${size}px ${size}px 0 ${outColor}`);
    }

    return {
      fontFamily: styles.fontFamily || 'Montserrat, sans-serif',
      color: styles.fontColor || '#FFFFFF',
      fontWeight: styles.fontWeight || '700',
      fontStyle: styles.fontStyle || 'normal',
      textDecoration: styles.textDecoration || 'none',
      textTransform: styles.textTransform || 'none',
      textAlign: styles.textAlign || 'center',
      lineHeight: styles.lineHeight || 1.35,
      letterSpacing: styles.letterSpacing ? `${styles.letterSpacing * scale}px` : 'normal',
      textShadow: textShadows.length > 0 ? textShadows.join(', ') : 'none',
    };
  }

  // Generates alignment styles for flex container
  static getContainerAlignmentStyle(styles: ThemeStyles, customMargins?: { left?: number; top?: number; right?: number; bottom?: number }): CSSProperties {
    let justifyContent = 'center';
    if (styles.alignVertical === 'top' || styles.layoutPreset === 'top-header') justifyContent = 'flex-start';
    if (styles.alignVertical === 'bottom' || styles.layoutPreset === 'lower-third') justifyContent = 'flex-end';

    let alignItems = 'center';
    if (styles.textAlign === 'left') alignItems = 'flex-start';
    if (styles.textAlign === 'right') alignItems = 'flex-end';

    const padH = styles.paddingHorizontal ?? (customMargins?.left ? customMargins.left / 18 : 6);
    const padV = styles.paddingVertical ?? (customMargins?.top ? customMargins.top / 18 : 5);

    return {
      display: 'flex',
      flexDirection: 'column',
      justifyContent,
      alignItems,
      paddingLeft: `${padH}%`,
      paddingRight: `${padH}%`,
      paddingTop: `${padV}%`,
      paddingBottom: `${padV}%`,
    };
  }

  // Returns styling for the inner card box wrapper based on boxStyle, layoutPreset, and custom position
  static getCardStyle(styles: ThemeStyles): { className: string; style: CSSProperties } {
    const width = styles.widthPercent ? `${styles.widthPercent}%` : '90%';
    let className = 'transition-all duration-200 max-w-full ';

    if (styles.layoutPreset === 'lower-third') {
      className += 'bg-black/75 backdrop-blur-md border-t-2 border-cyan-400 px-8 py-4 shadow-2xl rounded-t-xl w-full text-center ';
    } else if (styles.boxStyle === 'glass' || styles.layoutPreset === 'glass-card') {
      className += 'bg-black/60 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl p-6 md:p-10 ';
    } else if (styles.boxStyle === 'solid') {
      className += 'bg-black/85 border border-white/10 rounded-2xl shadow-2xl p-6 md:p-10 ';
    } else if (styles.boxStyle === 'light-glass') {
      className += 'bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl shadow-2xl p-6 md:p-10 ';
    } else if (styles.boxStyle === 'border') {
      className += 'bg-black/70 border-2 border-amber-400/80 rounded-2xl shadow-2xl p-6 md:p-10 ';
    } else {
      className += 'p-4 ';
    }

    const cardStyle: CSSProperties = {
      width: styles.layoutPreset === 'lower-third' ? '100%' : width,
      maxWidth: '100%',
    };

    if (styles.positionX !== undefined && styles.positionY !== undefined) {
      cardStyle.position = 'absolute';
      cardStyle.left = `${styles.positionX}%`;
      cardStyle.top = `${styles.positionY}%`;
      cardStyle.transform = 'translate(-50%, -50%)';
    }

    return {
      className: className.trim(),
      style: cardStyle
    };
  }
}

