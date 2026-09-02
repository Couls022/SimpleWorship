sed -i '/store.addScheduleItem(newItem);/c\
          if (payload.source !== '\''schedule'\'') {\
            store.addScheduleItem(newItem);\
          }' src/components/LivePanel.tsx
