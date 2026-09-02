sed -i '/if (parsed && parsed.item) {/c\        if (parsed && parsed.item && parsed.source !== '\''schedule'\'') {' src/components/SchedulePanel.tsx
