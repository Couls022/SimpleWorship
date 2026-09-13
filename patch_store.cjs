const fs = require('fs');
let code = fs.readFileSync('src/store/useStore.ts', 'utf8');

const nextSearch = `
    let nextIndex = currentState.activeSlideIndex + 1;
`;
const nextReplace = `
    if (liveItem && (liveItem.type === 'pptx' || liveItem.type === 'presentation' || liveItem.type === 'ppt')) {
        get().setStagedGroupState(targetGroupId, { 
          pptxAction: 'next',
          pptxActionTimestamp: Date.now()
        });
        return;
    }

    let nextIndex = currentState.activeSlideIndex + 1;
`;

const prevSearch = `
    let prevIndex = currentState.activeSlideIndex - 1;
`;
const prevReplace = `
    if (liveItem && (liveItem.type === 'pptx' || liveItem.type === 'presentation' || liveItem.type === 'ppt')) {
        get().setStagedGroupState(targetGroupId, { 
          pptxAction: 'prev',
          pptxActionTimestamp: Date.now()
        });
        return;
    }

    let prevIndex = currentState.activeSlideIndex - 1;
`;

code = code.replace(nextSearch.trim(), nextReplace.trim());
code = code.replace(prevSearch.trim(), prevReplace.trim());

fs.writeFileSync('src/store/useStore.ts', code);
