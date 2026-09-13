const fs = require('fs');
let code = fs.readFileSync('src/store/useStore.ts', 'utf8');

const search = `    let totalSlides = 1;
    if (currentItemId) {
      const liveItem = (
        currentState.directLiveItem 
        || activeSchedule?.items?.find(i => i.id === currentItemId)
        || (songsList.find(s => s.id === currentItemId) ? { id: currentItemId, name: '', type: 'song', contentId: currentItemId } as any : null)
      );
      if (liveItem) {
        const slides = PresentationCore.generateSlides(liveItem, songsList, systemOptions);
        totalSlides = Math.max(1, slides.length);
      }
    }`;

const replace = `    let totalSlides = 1;
    let liveItem: any = null;
    if (currentItemId) {
      liveItem = (
        currentState.directLiveItem 
        || activeSchedule?.items?.find(i => i.id === currentItemId)
        || (songsList.find(s => s.id === currentItemId) ? { id: currentItemId, name: '', type: 'song', contentId: currentItemId } as any : null)
      );
      if (liveItem) {
        const slides = PresentationCore.generateSlides(liveItem, songsList, systemOptions);
        totalSlides = Math.max(1, slides.length);
      }
    }`;

// Doing a global replace so both goLiveNext and goLivePrev are fixed
code = code.replaceAll(search, replace);

fs.writeFileSync('src/store/useStore.ts', code);
