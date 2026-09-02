const fs = require('fs');
let content = fs.readFileSync('src/components/QuickSongSearchModal.tsx', 'utf8');

const target = `    setTimeout(() => {
      store.setActiveControlState({
        activeScheduleId: store.activeSchedule?.id || null,
        activeItemId: itemId,
        activeSlideIndex: 0,
        nextSlideIndex: 1,
        isBlack: false,
        isClear: false,
        showLogo: false,
        timestamp: Date.now()
      });
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: \`Sent "\${song.title}" direct to Live Output!\` 
        })
      );
    }, 50);`;

const replacement = `    setTimeout(() => {
      store.goLiveItem(itemId, 0);
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: \`Sent "\${song.title}" direct to Live Output!\` 
        })
      );
    }, 50);`;

content = content.replace(target, replacement);

fs.writeFileSync('src/components/QuickSongSearchModal.tsx', content);
