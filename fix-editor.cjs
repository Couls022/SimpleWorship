const fs = require('fs');
let code = fs.readFileSync('src/components/SongEditorModal.tsx', 'utf-8');

// Replace state initializations
code = code.replace(/useState\(initialTheme\?\.fontFamily \|\| 'Montserrat, sans-serif'\)/g, "useState<string | undefined>(initialTheme?.fontFamily)");
code = code.replace(/useState<number>\(initialTheme\?\.fontSize \|\| 42\)/g, "useState<number | undefined>(initialTheme?.fontSize)");
code = code.replace(/useState\(initialTheme\?\.fontColor \|\| '#FFFFFF'\)/g, "useState<string | undefined>(initialTheme?.fontColor)");
code = code.replace(/useState<'left' \| 'center' \| 'right' \| 'justify'>\(initialTheme\?\.textAlign \|\| 'center'\)/g, "useState<'left' | 'center' | 'right' | 'justify' | undefined>(initialTheme?.textAlign)");
code = code.replace(/useState<'top' \| 'middle' \| 'bottom'>\(initialTheme\?\.alignVertical \|\| 'middle'\)/g, "useState<'top' | 'middle' | 'bottom' | undefined>(initialTheme?.alignVertical)");
code = code.replace(/useState<'none' \| 'glass' \| 'solid' \| 'light-glass' \| 'border'>\(initialTheme\?\.boxStyle \|\| 'none'\)/g, "useState<'none' | 'glass' | 'solid' | 'light-glass' | 'border' | undefined>(initialTheme?.boxStyle)");
code = code.replace(/useState<number>\(initialTheme\?\.widthPercent \|\| 88\)/g, "useState<number | undefined>(initialTheme?.widthPercent)");
code = code.replace(/useState<'center' \| 'lower-third' \| 'glass-card' \| 'top-header' \| 'split-two-column' \| 'editorial' \| 'border'>\(initialTheme\?\.layoutPreset \|\| 'center'\)/g, "useState<'center' | 'lower-third' | 'glass-card' | 'top-header' | 'split-two-column' | 'editorial' | 'border' | undefined>(initialTheme?.layoutPreset)");
code = code.replace(/useState\(initialTheme\?\.textOutline \?\? true\)/g, "useState<boolean | undefined>(initialTheme?.textOutline)");
code = code.replace(/useState\(initialTheme\?\.outlineColor \|\| '#000000'\)/g, "useState<string | undefined>(initialTheme?.outlineColor)");
code = code.replace(/useState\(initialTheme\?\.textShadow \?\? true\)/g, "useState<boolean | undefined>(initialTheme?.textShadow)");
code = code.replace(/useState\(initialTheme\?\.shadowColor \|\| 'rgba\(0,0,0,0\.85\)'\)/g, "useState<string | undefined>(initialTheme?.shadowColor)");
code = code.replace(/useState<number>\(initialTheme\?\.lineHeight \|\| 1\.35\)/g, "useState<number | undefined>(initialTheme?.lineHeight)");
code = code.replace(/useState<'none' \| 'uppercase' \| 'lowercase' \| 'capitalize'>\(initialTheme\?\.textTransform \|\| 'none'\)/g, "useState<'none' | 'uppercase' | 'lowercase' | 'capitalize' | undefined>(initialTheme?.textTransform)");

fs.writeFileSync('src/components/SongEditorModal.tsx', code);
console.log("Done modifying state hooks");
