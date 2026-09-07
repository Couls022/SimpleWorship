const fs = require('fs');
let code = fs.readFileSync('src/components/SongEditorModal.tsx', 'utf-8');

const themeOverrideFix = `    const rawThemeOverride: ThemeStyles = {
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
      textTransform,
      backgroundImageUrl: backgroundUrl
    };

    const themeOverride = Object.fromEntries(
      Object.entries(rawThemeOverride).filter(([_, v]) => v !== undefined)
    ) as ThemeStyles;`;

code = code.replace(/const themeOverride: ThemeStyles = \{[\s\S]*?backgroundImageUrl: backgroundUrl\n    \};/m, themeOverrideFix);

fs.writeFileSync('src/components/SongEditorModal.tsx', code);
console.log("Done fixing themeOverride creation");
