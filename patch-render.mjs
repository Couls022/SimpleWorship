import fs from 'fs';
let content = fs.readFileSync('src/core/RenderFrameBuilder.ts', 'utf8');

content = content.replace(
  'availableDisplays: any[]\n): RenderFrame | undefined {',
  'availableDisplays: any[],\n  overrideRes?: { width: number; height: number }\n): RenderFrame | undefined {'
);

content = content.replace(
  'const cacheKey = `${groupId}_${activeItem.id}_${state.activeSlideIndex || 0}_${group?.themeId || \'\'}_${activeItem.themeId || \'\'}_${group?.customResolution?.width || 0}_${availableDisplays?.length || 0}_${songFontSig}_${scriptureFontSig}_${altOutputSig}`;',
  'const cacheKey = `${groupId}_${activeItem.id}_${state.activeSlideIndex || 0}_${group?.themeId || \'\'}_${activeItem.themeId || \'\'}_${group?.customResolution?.width || 0}_${overrideRes?.width || 0}_${overrideRes?.height || 0}_${availableDisplays?.length || 0}_${songFontSig}_${scriptureFontSig}_${altOutputSig}`;'
);

content = content.replace(
  'const res = resolveGroupResolution(group, systemOptions, availableDisplays);',
  'const res = resolveGroupResolution(group, systemOptions, availableDisplays, overrideRes);'
);

fs.writeFileSync('src/core/RenderFrameBuilder.ts', content);
