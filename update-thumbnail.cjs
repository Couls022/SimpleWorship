const fs = require('fs');
let code = fs.readFileSync('src/components/PptxSlideThumbnail.tsx', 'utf8');
code = code.replace("import { useSlideRenderCache } from '../utils/SlideRenderCache';", "import { useSlideRenderCache } from '../utils/SlideRenderCache';\nimport { toValidPptxUint8Array } from '../utils/pptxValidator';");

code = code.replace(/const bytesKey = useMemo\(\(\) => \{[\s\S]*?\}, \[slide, liveItem\]\);/, `const bytesKey = useMemo(() => {
    const slideBytes = (slide as any).fileBytes || liveItem?.data?.fileBytes;
    const uint8Bytes = toValidPptxUint8Array(slideBytes);
    if (uint8Bytes) {
      const len = uint8Bytes.length;
      return \`pptx_bytes_\${len}_\${uint8Bytes.slice(0, 32).join('_')}\`;
    }
    const contentId = liveItem?.contentId || liveItem?.id;
    return contentId ? \`pptx_item_\${contentId}\` : '';
  }, [slide, liveItem]);`);

fs.writeFileSync('src/components/PptxSlideThumbnail.tsx', code);
