sed -i '/e.dataTransfer.setData('\''text\/plain'\'', index.toString());/a\    if (activeSchedule?.items[index]) {\n      e.dataTransfer.setData('\''application\/json'\'', JSON.stringify({ item: activeSchedule.items[index] }));\n    }' src/components/SchedulePanel.tsx
sed -i 's/<span>Send to Preview<\/span>/<span>Edit Slide<\/span>/g' src/components/SchedulePanel.tsx
