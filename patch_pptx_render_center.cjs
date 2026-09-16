const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

// Fix updateSize call
code = code.replace('updateSize();', 'updateSize([]);');

// Fix customZoom typing
const zoomRegex = /const customZoom = useMemo\(\(\) => \{\n\s*return \{ \.\.\.\(blocks\.canvasProps\?\.zoom \|\| \{\}\), editorScale: 1 \};\n\s*\}, \[blocks\.canvasProps\?\.zoom\]\);/g;
const zoomReplacement = `  const customZoom = useMemo(() => {
    if (!blocks.canvasProps?.zoom) return undefined;
    return { ...blocks.canvasProps.zoom, editorScale: 1 };
  }, [blocks.canvasProps?.zoom]);`;
code = code.replace(zoomRegex, zoomReplacement);

// Fix absolute centering
const divRegex = /className="absolute transform-gpu"/g;
const divReplacement = `className="absolute transform-gpu flex items-center justify-center"`;
code = code.replace(divRegex, divReplacement);

// Actually, wait, absolute without top/left might not center. 
// If parent is flex center, it centers static elements.
// Let's remove absolute and let flex parent center it!
const divRegex2 = /className="absolute transform-gpu flex items-center justify-center"/g;
const divReplacement2 = `className="relative transform-gpu flex items-center justify-center shrink-0"`;
code = code.replace(divRegex2, divReplacement2);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched');
