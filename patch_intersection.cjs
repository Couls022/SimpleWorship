const fs = require('fs');
let code = fs.readFileSync('src/components/PptxSlideThumbnail.tsx', 'utf8');

code = code.replace(
  '  const [scale, setScale] = useState<number>(0.2);',
  '  const [scale, setScale] = useState<number>(0.2);\n  const [hasIntersected, setHasIntersected] = useState(false);\n\n  useEffect(() => {\n    const el = containerRef.current;\n    if (!el) return;\n    const observer = new IntersectionObserver(([entry]) => {\n      if (entry.isIntersecting) {\n        setHasIntersected(true);\n        observer.disconnect();\n      }\n    }, { rootMargin: "200px" });\n    observer.observe(el);\n    return () => observer.disconnect();\n  }, []);'
);

code = code.replace(
  '        {(fileBytes || contentId) ? (',
  '        {(fileBytes || contentId) && hasIntersected ? ('
);

fs.writeFileSync('src/components/PptxSlideThumbnail.tsx', code);
