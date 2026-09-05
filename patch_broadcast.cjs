const fs = require('fs');
let file = fs.readFileSync('src/utils/broadcastSync.ts', 'utf8');
file = file.replace(
  /type: 'GROUP_STATES_UPDATE' \| 'SCHEDULE_UPDATE' \| 'SYSTEM_UPDATE' \| 'SYSTEM_OPTIONS' \| 'ALERT_UPDATE' \| 'GO_LIVE' \| 'ANNOTATION_UPDATE' \| 'LASER_UPDATE' \| 'IDENTIFY_DISPLAYS';/,
  "type: 'GROUP_STATES_UPDATE' | 'SCHEDULE_UPDATE' | 'SYSTEM_UPDATE' | 'SYSTEM_OPTIONS' | 'ALERT_UPDATE' | 'GO_LIVE' | 'ANNOTATION_UPDATE' | 'LASER_UPDATE' | 'IDENTIFY_DISPLAYS' | 'REQUEST_STATE' | 'SYNC_STATE';"
);
fs.writeFileSync('src/utils/broadcastSync.ts', file);
