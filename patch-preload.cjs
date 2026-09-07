const fs = require('fs');
let code = fs.readFileSync('src/utils/SlideRenderCache.ts', 'utf8');

code = code.replace(
  `    // Specifically preload N-1 and N+1 slides
    const targetIndices = [
      currentIndex + 1,
      currentIndex - 1
    ].filter(idx => idx >= 0 && idx < totalSlides);`,
  `    // Preload outwards from current slide
    const targetIndices: number[] = [];
    for (let offset = 1; offset < totalSlides; offset++) {
       if (currentIndex + offset < totalSlides) targetIndices.push(currentIndex + offset);
       if (currentIndex - offset >= 0) targetIndices.push(currentIndex - offset);
    }`
);

fs.writeFileSync('src/utils/SlideRenderCache.ts', code);
