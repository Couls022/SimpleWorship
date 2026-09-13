const fs = require('fs');
let code = fs.readFileSync('src/components/resources/PresentationsTab.tsx', 'utf8');

code = code.replace(
  `  const handleAddToSchedule = async (e: React.MouseEvent, doc: Asset) => {
    e.stopPropagation();
    
    // We must fetch the full asset to get the fileBytes, since they are stripped in the list view
    const db = await getDB();
    const fullAsset = await db.get('assets', doc.id);
    
    addScheduleItem({
      id: \`pres-\${Date.now()}\`,
      type: 'presentation',
      name: doc.name,
      contentId: doc.id,
      data: fullAsset?.data
    });
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Presentation added to schedule' }));
  };`,
  `  const handleAddToSchedule = async (e: React.MouseEvent, doc: Asset) => {
    e.stopPropagation();
    
    // Pass only the stripped data (slides, etc) without fileBytes to prevent massive JSON stringification lag
    addScheduleItem({
      id: \`pres-\${Date.now()}\`,
      type: 'presentation',
      name: doc.name,
      contentId: doc.id,
      data: doc.data
    });
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Presentation added to schedule' }));
  };`
);

fs.writeFileSync('src/components/resources/PresentationsTab.tsx', code);
