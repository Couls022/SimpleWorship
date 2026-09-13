const fs = require('fs');
let code = fs.readFileSync('src/components/SchedulePanel.tsx', 'utf8');

code = code.replace(
  `            if (newItem.type === 'presentation') {
              if (!isValidPptxBinary(newItem.data?.fileBytes)) {
                newItem.data = { ...(newItem.data || {}), fileBytes: undefined };
              }
            }`,
  `            if (newItem.type === 'presentation') {
              // ALWAYS strip fileBytes from the schedule item payload to prevent 
              // massive stringification lags when saving to IndexedDB! 
              // The renderer will pull it directly via contentId.
              newItem.data = { ...(newItem.data || {}), fileBytes: undefined };
            }`
);

fs.writeFileSync('src/components/SchedulePanel.tsx', code);
