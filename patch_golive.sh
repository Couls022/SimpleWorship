sed -i 's/<MonitorUp size={13} \/>/<Play size={13} className="fill-current" \/>/g' src/components/LivePanel.tsx
sed -i "s/title=\"Pop out standalone projector display window\"/title=\"Go Live (Send Preview to this Panel)\"/g" src/components/LivePanel.tsx
sed -i "s/onClick={() => groupId && handleLaunchProjector(groupId)}/onClick={() => {\n              if (store.previewItemId) {\n                store.goLiveItem(store.previewItemId, store.previewSlideIndex, groupId);\n              } else if (store.activeSchedule?.items.length) {\n                store.goLiveItem(store.activeSchedule.items[0].id, 0, groupId);\n              }\n            }}/g" src/components/LivePanel.tsx
sed -i 's/MonitorUp,/MonitorUp,\n  Play,/g' src/components/LivePanel.tsx
