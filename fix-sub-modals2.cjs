const fs = require('fs');

const subModals = [
  'src/components/presentation-editor/ImagePickerModal.tsx',
  'src/components/presentation-editor/TemplateGalleryModal.tsx'
];

for (const file of subModals) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('withPortal')) {
    content = "import { withPortal } from '../common/withPortal';\n" + content;
    content = content.replace(/export const ([A-Za-z0-9_]+): React\.FC<[A-Za-z0-9_]+> = \(\{/, (match, name) => {
      return `const ${name}Base = ({`;
    });
    const nameMatch = content.match(/const ([A-Za-z0-9_]+)Base = \(\{/);
    if (nameMatch) {
      content += `\nexport const ${nameMatch[1]} = withPortal(${nameMatch[1]}Base);\n`;
      fs.writeFileSync(file, content);
      console.log('Patched', file);
    }
  }
}
