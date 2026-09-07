const fs = require('fs');
const file = 'src/components/presentation-editor/TemplateGalleryModal.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('withPortal') && content.includes('export function TemplateGalleryModal({')) {
  content = "import { withPortal } from '../common/withPortal';\n" + content;
  content = content.replace("export function TemplateGalleryModal({", "function TemplateGalleryModalBase({");
  content += "\nexport const TemplateGalleryModal = withPortal(TemplateGalleryModalBase);\n";
  fs.writeFileSync(file, content);
  console.log('Patched gallery');
}
