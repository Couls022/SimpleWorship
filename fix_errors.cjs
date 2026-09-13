const fs = require('fs');

let pptxCode = fs.readFileSync('src/components/PptxRenderOverlay.tsx', 'utf8');
pptxCode = pptxCode.replace(/  isThumbnail\?: boolean;\n/g, ''); // remove all
pptxCode = pptxCode.replace(/  pptxAction\?: 'next' | 'prev' | null;\n/g, '');
pptxCode = pptxCode.replace(/  pptxActionTimestamp\?: number;\n/g, '');
pptxCode = pptxCode.replace(/  onActiveSlideChange\?: \(index: number\) => void;\n/g, '');

const interfaceStr = `interface PptxRenderOverlayProps {
  fileBytes?: Uint8Array | ArrayBuffer | any;
  contentId?: string;
  isThumbnail?: boolean;
  pptxAction?: 'next' | 'prev' | null;
  pptxActionTimestamp?: number;
  onActiveSlideChange?: (index: number) => void;
  activeSlideIndex: number;
}`;

pptxCode = pptxCode.replace(/interface PptxRenderOverlayProps {[\s\S]*?activeSlideIndex: number;\n}/, interfaceStr);
fs.writeFileSync('src/components/PptxRenderOverlay.tsx', pptxCode);


let storeCode = fs.readFileSync('src/store/useStore.ts', 'utf8');
storeCode = storeCode.replace(/        systemOptions: nextSystemOptions,\n        systemOptions: nextSystemOptions,/g, '        systemOptions: nextSystemOptions,');
fs.writeFileSync('src/store/useStore.ts', storeCode);
