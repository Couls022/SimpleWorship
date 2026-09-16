const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

const zoomRegex = /const customZoom = useMemo\(\(\) => \{\n\s*if \(!blocks\.canvasProps\?\.zoom\) return undefined;\n\s*return \{ \.\.\.blocks\.canvasProps\.zoom, editorScale: 1 \};\n\s*\}, \[blocks\.canvasProps\?\.zoom\]\);/;

const zoomReplacement = `  const customZoom = useMemo(() => {
    if (!blocks.canvasProps?.zoom) return undefined;
    if (isProjectorMode) {
      return { ...blocks.canvasProps.zoom, editorScale: 1 };
    }
    return blocks.canvasProps.zoom;
  }, [blocks.canvasProps?.zoom, isProjectorMode]);`;

code = code.replace(zoomRegex, zoomReplacement);

const renderRegex = /<div \n\s*className="relative transform-gpu flex items-center justify-center shrink-0"\n\s*style=\{\{\n\s*width: canvasWidth,\n\s*height: canvasHeight,\n\s*transform: \`scale\(\$\{targetScale\}\)\`,\n\s*transformOrigin: 'center center'\n\s*\}\}\n\s*>\n\s*<SlideCanvas[\s\S]*?canEdit=\{false\} \n\s*\/>\n\s*<\/div>/;

const renderReplacement = `      {isProjectorMode ? (
        <div 
          className="relative transform-gpu flex items-center justify-center shrink-0"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: \`scale(\${targetScale})\`,
            transformOrigin: 'center center'
          }}
        >
          <SlideCanvas 
            {...blocks.canvasProps} 
            activeSlide={effectiveActiveSlide}
            presentationElementStates={!isThumbnail ? presentationElementStates : undefined}
            presentationKeyframesCss={!isThumbnail ? presentationKeyframesCss : undefined}
            zoom={customZoom} 
            mode="present"
            showRulers={false} 
            showGrid={false} 
            canEdit={false} 
          />
        </div>
      ) : (
        <SlideCanvas 
          {...blocks.canvasProps} 
          activeSlide={effectiveActiveSlide}
          presentationElementStates={!isThumbnail ? presentationElementStates : undefined}
          presentationKeyframesCss={!isThumbnail ? presentationKeyframesCss : undefined}
          zoom={customZoom} 
          mode="present"
          showRulers={false} 
          showGrid={false} 
          canEdit={false} 
        />
      )}`;

code = code.replace(renderRegex, renderReplacement);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched');
