sed -i 's/onDragOver={(e) => e.preventDefault()}/onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = '\''copy'\''; }}/g' src/components/LivePanel.tsx
