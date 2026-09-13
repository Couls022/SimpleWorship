const fs = require('fs');
let code = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf8');

code = code.replace(
  'className={contentType === \'video\' ? "w-full h-full object-contain relative z-10" : "w-full h-full object-cover"}',
  'className={(contentType === \'video\' || isLogoMode) ? "w-full h-full object-contain relative z-10 bg-black" : "w-full h-full object-cover"}'
);

code = code.replace(
  `                ) : effectiveBackgroundUrl ? (
                  <div
                    className="w-full h-full bg-cover bg-center"`,
  `                ) : effectiveBackgroundUrl ? (
                  <div
                    className={\`w-full h-full bg-center \${isLogoMode ? 'bg-contain bg-no-repeat bg-black' : 'bg-cover'}\`}`
);

fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', code);
console.log("Patched MonitorPreviewCanvas.tsx");
