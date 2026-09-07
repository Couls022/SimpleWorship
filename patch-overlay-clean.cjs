const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

code = code.replace(
  /const \[prefetchQueue, setPrefetchQueue\] = useState<number\[\]>\(\[\]\);\s*const \[prefetchIndex, setPrefetchIndex\] = useState<number \| null>\(null\);\s*/,
  ''
);

code = code.replace(
  /useEffect\(\(\) => \{\s*if \(\!blocks\.canvasProps\) return;\s*const totalSlides = blocks\.canvasProps\.allSlides\?\.length \|\| 1;\s*const queue: number\[\] = \[\];\s*for \(let offset = 1; offset < totalSlides; offset\+\+\) \{\s*if \(activeSlideIndex \+ offset < totalSlides\) queue\.push\(activeSlideIndex \+ offset\);\s*if \(activeSlideIndex - offset >= 0\) queue\.push\(activeSlideIndex - offset\);\s*\}\s*setPrefetchQueue\(queue\);\s*setPrefetchIndex\(queue\.length > 0 \? queue\[0\] : null\);\s*\}, \[activeSlideIndex, blocks\.canvasProps\?\.allSlides\?\.length\]\);\s*const onPrefetchCaptured = \(\) => \{\s*setPrefetchQueue\(prev => \{\s*const nextQueue = prev\.slice\(1\);\s*setPrefetchIndex\(nextQueue\.length > 0 \? nextQueue\[0\] : null\);\s*return nextQueue;\s*\}\);\s*\};\s*/,
  ''
);

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
