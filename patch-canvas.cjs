const fs = require('fs');

function patchFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  
  // Replace labelStyles.fontSize logic with direct pixel values (and a decent fallback)
  // We'll replace occurrences like:
  // fontSize: labelStyles?.fontSize ? \`\${Math.max(14, labelStyles.fontSize * 0.75)}px\` : '24px'
  // Or:
  // fontSize: labelStyles?.fontSize ? \`\${Math.max(10, labelStyles.fontSize * 0.35)}px\` : '12px'
  // Or:
  // fontSize: (activeItem?.type === 'bible' && referenceStyles?.fontSize) ? \`\${referenceStyles.fontSize}px\` : (labelStyles?.fontSize ? \`\${labelStyles.fontSize}px\` : (resolvedStyles.fontSize ? \`\${Math.max(16, resolvedStyles.fontSize * 0.4)}px\` : '24px'))
  
  // For the corners:
  code = code.replace(/fontSize: labelStyles\?.fontSize \? `\$\{Math\.max\(.*?, labelStyles\.fontSize \* .*?\)\}px` : '.*?'/g, 
    "fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '36px'");
    
  // For the header:
  code = code.replace(/fontSize: labelStyles\?.fontSize \? `\$\{Math\.max\(.*?, labelStyles\.fontSize \* .*?\)\}px` : '.*?'/g, 
    "fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '42px'");

  // For the complicated header in MonitorPreviewCanvas/ProjectorView:
  code = code.replace(/fontSize: \(activeItem\?\.type === 'bible'.*?\?\s*`\$\{referenceStyles\.fontSize\}px`\s*:\s*\(labelStyles\?\.fontSize \? `\$\{labelStyles\.fontSize\}px` : \(resolvedStyles\.fontSize \? `\$\{Math\.max\(16, resolvedStyles\.fontSize \* 0\.4\)\}px` : '24px'\)\)/g,
    "fontSize: (activeItem?.type === 'bible' && referenceStyles?.fontSize) ? `${referenceStyles.fontSize}px` : (labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '36px')");
    
  // For copyright:
  // fontSize: copyrightThemeStyles.fontSize ? `${Math.max(8.5, copyrightThemeStyles.fontSize * 0.32)}px` : '10px'
  code = code.replace(/fontSize: copyrightThemeStyles\.fontSize \? `\$\{Math\.max\(.*?, copyrightThemeStyles\.fontSize \* .*?\)\}px` : '.*?'/g,
    "fontSize: copyrightThemeStyles.fontSize ? `${copyrightThemeStyles.fontSize}px` : '20px'");
    
  // Replace getTextStyle(..., 0.45) with 1
  code = code.replace(/ThemeEngine\.getTextStyle\(labelStyles,\s*[0-9.]+\)/g, "ThemeEngine.getTextStyle(labelStyles, 1)");
  code = code.replace(/ThemeEngine\.getTextStyle\(referenceStyles,\s*[0-9.]+\)/g, "ThemeEngine.getTextStyle(referenceStyles, 1)");
  code = code.replace(/ThemeEngine\.getTextStyle\(copyrightThemeStyles,\s*[0-9.]+\)/g, "ThemeEngine.getTextStyle(copyrightThemeStyles, 1)");
  code = code.replace(/ThemeEngine\.getTextStyle\(resolvedStyles,\s*[0-9.]+\)/g, "ThemeEngine.getTextStyle(resolvedStyles, 1)");

  fs.writeFileSync(file, code);
  console.log("Patched " + file);
}

patchFile('src/components/MonitorPreviewCanvas.tsx');
patchFile('src/components/ProjectorView.tsx');
