const fs = require('fs');
let code = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf8');

code = code.replace(
  `              {!isOverlayGroup && lastValidBgRef.current && (
                <div 
                  className="absolute inset-0 w-full h-full bg-cover bg-center"`,
  `              {!isOverlayGroup && lastValidBgRef.current && (
                <div 
                  className={\`absolute inset-0 w-full h-full bg-center \${isLogoMode ? 'bg-contain bg-no-repeat bg-black' : 'bg-cover'}\`}`
);

fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', code);
console.log("Patched crossfade in MonitorPreviewCanvas.tsx");
