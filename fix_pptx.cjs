const fs = require('fs');
let code = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');

// I need to ensure there is EXACTLY ONE containerSize state and the ResizeObserver works correctly.
code = code.replace(/const containerRef = useRef<HTMLDivElement>\(null\);[\s\S]*?const lastReportedSlideRef = useRef<number>\(-1\);/m, 
`const containerRef = useRef<HTMLDivElement>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    let animationFrameId = null;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      
      // Use requestAnimationFrame to debounce and prevent ResizeObserver loop limit errors
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize(prev => prev.width === width && prev.height === height ? prev : { width, height });
        }
      });
    });
    
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const lastReportedSlideRef = useRef<number>(-1);`);

code = code.replace(/const \[containerSize, setContainerSize\] = useState[\s\S]*?;\n/, '');

fs.writeFileSync('src/components/PptxRenderOverlay.tsx', code);
console.log('patched');
