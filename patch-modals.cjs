const fs = require('fs');

const modals = [
  'src/components/AlertModal.tsx',
  'src/components/PrintScheduleModal.tsx',
  'src/components/ProfilesManagerModal.tsx',
  'src/components/QuickSongSearchModal.tsx',
  'src/components/RemoteControlModal.tsx',
  'src/components/SettingsModal.tsx',
  'src/components/SongEditorModal.tsx',
  'src/components/SystemDiagnosticsModal.tsx',
  'src/components/TargetSelectionModal.tsx',
  'src/components/ThemeTemplateModal.tsx',
  'src/components/UnsavedChangesModal.tsx',
  'src/components/options/OptionsDialog.tsx',
  'src/components/CenterShortcutSettingsModal.tsx',
  'src/components/PresentationEditorModal.tsx',
  'src/components/SaveScheduleAsModal.tsx',
  'src/components/AboutModal.tsx'
];

for (const modalPath of modals) {
  if (!fs.existsSync(modalPath)) continue;
  let content = fs.readFileSync(modalPath, 'utf8');
  
  // Skip if already applied
  if (content.includes('withPortal')) continue;

  const exportMatch = content.match(/export default function ([A-Za-z0-9_]+)\(/);
  
  if (exportMatch) {
    const componentName = exportMatch[1];
    
    // Check if we need to adjust the import path for withPortal
    const relativePath = modalPath.includes('/options/') ? '../common/withPortal' : './common/withPortal';
    
    content = `import { withPortal } from '${relativePath}';\n` + content;
    content = content.replace(`export default function ${componentName}(`, `function ${componentName}(`);
    content = content + `\nexport default withPortal(${componentName});\n`;
    
    fs.writeFileSync(modalPath, content);
    console.log('Patched', modalPath);
  } else {
    console.log('Skipped', modalPath, 'no default function export');
  }
}
