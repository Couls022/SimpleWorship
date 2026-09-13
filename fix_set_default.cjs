const fs = require('fs');
let code = fs.readFileSync('src/store/useStore.ts', 'utf8');

const replacement = `      if (scope === 'logo' && !isTogglingOff) {
        const activeGroup = state.activeControlGroupId || state.outputGroups[0]?.id || 'group-congregation';
        const currentGroupState = state.groupStates[activeGroup] || state.stagedGroupStates[activeGroup];
        if (currentGroupState?.showLogo) {
          setTimeout(() => get().setStagedGroupState(activeGroup, { isVideoPlaying: true }), 0);
        }
      }
      
      // 1. Update assetsList so ONLY target asset is marked default for this scope (automatic replacement)`;

code = code.replace(
  "      // 1. Update assetsList so ONLY target asset is marked default for this scope (automatic replacement)",
  replacement
);

fs.writeFileSync('src/store/useStore.ts', code);
