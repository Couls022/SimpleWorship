const fs = require('fs');
const file = 'src/components/PresentationEditorModal.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('withPortal') && content.includes('export const PresentationEditorModal')) {
  content = "import { withPortal } from './common/withPortal';\n" + content;
  content = content.replace("export const PresentationEditorModal", "const PresentationEditorModalBase");
  content += "\nexport const PresentationEditorModal = withPortal(PresentationEditorModalBase);\n";
  fs.writeFileSync(file, content);
}
