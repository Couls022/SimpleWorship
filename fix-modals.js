const fs = require('fs');
const path = require('path');

const modals = [
  'src/components/AlertModal.tsx',
  'src/components/PrintScheduleModal.tsx',
  'src/components/ProfilesManagerModal.tsx',
  'src/components/QuickSongSearchModal.tsx',
  'src/components/RemoteView.tsx', // contains RemoteControlModal?
  'src/components/SettingsModal.tsx',
  'src/components/SongEditorModal.tsx',
  'src/components/SystemDiagnosticsModal.tsx',
  'src/components/TargetSelectionModal.tsx',
  'src/components/ThemeTemplateModal.tsx',
  'src/components/UnsavedChangesModal.tsx',
  'src/components/options/OptionsDialog.tsx',
  'src/components/options/CenterShortcutSettingsModal.tsx',
  'src/components/PresentationEditorModal.tsx'
];

modals.forEach(modalPath => {
  if (!fs.existsSync(modalPath)) return;
  let content = fs.readFileSync(modalPath, 'utf8');
  
  if (content.includes('createPortal')) return;
  
  // Add import
  content = "import { createPortal } from 'react-dom';\n" + content;
  
  // Find the last `return (` or `return (` in the main component.
  // Actually, an easier way is to just wrap the whole `export default function Modal` or similar.
  // Wait, if it's the default export, we can just export a wrapped version. No, that's messy.
  
  // Let's replace `return (` with `return createPortal(` but only for the very last one, or the one belonging to the component.
  // Or just write a script to replace the main `return (`.
});
