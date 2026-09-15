const fs = require('fs');
let code = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf-8');

code = code.replace(
/            background: isGradient \n              \? gradientVal \n              : \(isOverlayGroup && !effectiveBackgroundUrl && !videoSrc\)\n                \? 'transparent'\n                : \(resolvedStyles\.backgroundColor === '#000000' && isOverlayGroup\)\n                  \? 'transparent' \n                  : \(resolvedStyles\.backgroundColor \|\| \(isOverlayGroup \? 'transparent' : '#000000'\)\),/g,
`            background: isGradient 
              ? gradientVal 
              : isProjectorMode
                ? (resolvedStyles.backgroundColor && resolvedStyles.backgroundColor !== '#000000' ? resolvedStyles.backgroundColor : 'transparent')
                : (resolvedStyles.backgroundColor || '#000000'),`
);

fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', code);
