sed -i 's/JSON.stringify({ item: activeSchedule.items\[index\] })/JSON.stringify({ source: '\''schedule'\'', item: activeSchedule.items[index] })/g' src/components/SchedulePanel.tsx
