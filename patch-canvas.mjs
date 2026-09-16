import fs from 'fs';
let content = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf8');

const regex = /\/\/ Determine native target resolution & aspect ratio based on Selected Output Monitor & General settings[\s\S]*?const aspectLabel = \(isPptx && currentSlide\?\.aspectRatioLabel\) \? currentSlide\.aspectRatioLabel : groupAspectLabel;/m;
const match = content.match(regex);
if (match) {
  content = content.replace(match[0], '');
  
  const insertRegex = /const effectiveContainerH = containerSize\.height > 0 \? containerSize\.height : \(isProjectorMode && typeof window !== 'undefined' \? window\.innerHeight : 0\);/m;
  const insertMatch = content.match(insertRegex);
  
  if (insertMatch) {
    const insertion = `const effectiveContainerH = containerSize.height > 0 ? containerSize.height : (isProjectorMode && typeof window !== 'undefined' ? window.innerHeight : 0);

  const overrideRes = React.useMemo(() => (isProjectorMode && effectiveContainerW > 0 && effectiveContainerH > 0 
    ? { width: effectiveContainerW, height: effectiveContainerH } 
    : undefined), [isProjectorMode, effectiveContainerW, effectiveContainerH]);

  // Determine native target resolution & aspect ratio based on Selected Output Monitor & General settings
  const { width: targetWidth, height: targetHeight, aspectRatio: groupAspectRatio, aspectLabel: groupAspectLabel, margins } = React.useMemo(() => resolveGroupResolution(group, systemOptions, DisplayManager.getCachedDisplays(), overrideRes), [group, systemOptions, overrideRes]);

  // Target output monitor frame is authoritative (Live Display Canvas scales the authoritative target frame proportionally)
  const isPptx = activeItem?.type === 'presentation' || activeItem?.type === 'ppt';
  const aspectRatio = groupAspectRatio;
  const aspectLabel = (isPptx && currentSlide?.aspectRatioLabel) ? currentSlide.aspectRatioLabel : groupAspectLabel;`;
    
    content = content.replace(insertMatch[0], insertion);
  }
}

// Now replace the buildRenderFrame call
const buildRenderRegex = /const computedRenderFrame = presentationState\.renderFrame \|\| buildRenderFrame\([\s\S]*?DisplayManager\.getCachedDisplays\(\)\n\s*\);/m;
const buildRenderMatch = content.match(buildRenderRegex);
if (buildRenderMatch) {
  const replacement = `const computedRenderFrame = (isProjectorMode ? undefined : presentationState.renderFrame) || buildRenderFrame(
              groupId,
              presentationState,
              activeSchedule,
              group,
              systemOptions,
              songsList,
              themesList,
              DisplayManager.getCachedDisplays(),
              overrideRes
            );`;
  content = content.replace(buildRenderMatch[0], replacement);
}

fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', content);
