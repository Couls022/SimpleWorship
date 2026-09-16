const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

// I injected `const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });` near `const containerRef = useRef<HTMLDivElement>(null);`
// But there was ALREADY `const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });` later in the file.
// Let's remove the second one.

code = code.replace(/const \[containerSize, setContainerSize\] = useState[^;]+;\n/, '');

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched');
