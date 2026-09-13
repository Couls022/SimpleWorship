const fs = require('fs');
let code = fs.readFileSync('src/components/workspace/FixedLiveDisplay.tsx', 'utf8');

if (!code.includes("useMediaProgressStore")) {
  code = code.replace(
    "import { useStore } from '../../store/useStore';",
    "import { useStore } from '../../store/useStore';\nimport { useMediaProgressStore } from '../../store/useMediaProgressStore';"
  );
}

// Add hook at top of component
code = code.replace(
  'const effectiveGroupId = groupId || \'group-congregation\';',
  'const effectiveGroupId = groupId || \'group-congregation\';\n  const mediaProgress = useMediaProgressStore(state => state.progress[effectiveGroupId]);\n  const uiVideoCurrentTime = mediaProgress?.currentTime || stagedControlState?.videoCurrentTime || 0;\n  const uiVideoDuration = mediaProgress?.duration || stagedControlState?.videoDuration || 0;'
);

// Replace formatVideoTime usages
code = code.replaceAll('stagedControlState?.videoCurrentTime || 0', 'uiVideoCurrentTime');
code = code.replaceAll('stagedControlState?.videoDuration && stagedControlState.videoDuration > 0 ? stagedControlState.videoDuration : 100', 'uiVideoDuration > 0 ? uiVideoDuration : 100');
code = code.replaceAll('stagedControlState?.videoDuration || 0', 'uiVideoDuration');

fs.writeFileSync('src/components/workspace/FixedLiveDisplay.tsx', code);
