const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectorView.tsx', 'utf8');

const hookInsertStr = `const pptxBytesKey = useMemo(() => {
    const isPptx = activeItem?.type === 'presentation' || activeItem?.type === 'ppt';
    if (!isPptx) return '';
    const bytes = activeItem?.data?.fileBytes;
    if (bytes) {
      return getSlideRenderKey(activeItem?.contentId, toValidPptxUint8Array(bytes));
    }
    return getSlideRenderKey(activeItem?.contentId, null);
  }, [activeItem]);

  const { cachedFrame } = useSlideRenderCache(pptxBytesKey, presentationState.activeSlideIndex || 0);`;

code = code.replace(
  `export default function ProjectorView({ groupId: initialGroupId, displayId }: ProjectorViewProps) {`,
  `export default function ProjectorView({ groupId: initialGroupId, displayId }: ProjectorViewProps) {\n  const { activeItem, presentationState } = useStore();\n  ${hookInsertStr}`
);

// We need to remove the duplicate `const { activeItem, presentationState } = useStore();` if it exists.
// Wait, `useStore` is usually called later in the component. Let's just put the hook right after `const { activeItem... } = useStore();` instead.

