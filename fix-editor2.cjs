const fs = require('fs');
let code = fs.readFileSync('src/components/SongEditorModal.tsx', 'utf-8');

const previewThemeReplacement = `  const itemContentType = mode === 'library' ? 'song' : (scheduleItem?.type || 'song');
  const systemFontOverride = ThemeEngine.getSystemFontForContent(store.systemOptions, itemContentType);
  const typeTheme = store.themes.find(t => t.type === itemContentType || (itemContentType === 'song' && t.id === 'theme-song'));
  const baseThemeStyles = ThemeEngine.resolveStyles(
    store.globalTheme?.styles || ThemeEngine.getDefaultGlobalTheme(),
    undefined,
    typeTheme?.styles,
    systemFontOverride,
    initialTheme
  );
  const previewThemeStyles: ThemeStyles = ThemeEngine.resolveStyles(
    baseThemeStyles,
    undefined, undefined, undefined, undefined,
    {
      fontFamily,
      fontSize,
      fontColor,
      textAlign,
      alignVertical,
      boxStyle,
      widthPercent,
      positionX,
      positionY,
      layoutPreset,
      textOutline: hasOutline,
      outlineColor,
      textShadow: hasShadow,
      shadowColor,
      lineHeight,
      textTransform
    }
  );`;

code = code.replace(/const previewThemeStyles: ThemeStyles = \{[\s\S]*?textTransform\n  \};/m, previewThemeReplacement);

// Fix Format Text UI to show resolved styles when state is undefined
code = code.replace(/value=\{fontFamily\}/g, "value={fontFamily || previewThemeStyles.fontFamily || 'Montserrat, sans-serif'}");
code = code.replace(/value=\{fontSize\}/g, "value={fontSize || previewThemeStyles.fontSize || 42}");
code = code.replace(/value=\{fontColor\}/g, "value={fontColor || previewThemeStyles.fontColor || '#FFFFFF'}");

fs.writeFileSync('src/components/SongEditorModal.tsx', code);
console.log("Done fixing preview and UI");
