const fs = require('fs');
let code = fs.readFileSync('src/components/AlertModal.tsx', 'utf8');

// 1. Add scrolling state
code = code.replace(
  "const [textColor, setTextColor] = useState(alert.textColor || '#FACC15');",
  "const [textColor, setTextColor] = useState(alert.textColor || '#FACC15');\n  const [scrolling, setScrolling] = useState<boolean>(alert.scrolling ?? true);"
);

// 2. Add scrolling to editForm type
code = code.replace(
  "textColor: string;\n    showNursery: boolean;",
  "textColor: string;\n    scrolling: boolean;\n    showNursery: boolean;"
);

// 3. Add scrolling to editForm initial state
code = code.replace(
  "textColor: '#FACC15',\n    showNursery: false,",
  "textColor: '#FACC15',\n    scrolling: true,\n    showNursery: false,"
);

// 4. Add scrolling to alertData in handleToggleActive
code = code.replace(
  "textColor,\n      showNursery: showNurseryBadge,",
  "textColor,\n      scrolling,\n      showNursery: showNurseryBadge,"
);

// 5. Add scrolling to alertData in handleSaveAndBroadcast
code = code.replace(
  "textColor,\n      active: true,\n      showNursery: showNurseryBadge,",
  "textColor,\n      scrolling,\n      active: true,\n      showNursery: showNurseryBadge,"
);

// 6. Add scrolling in handleSelectPreset
code = code.replace(
  "if (preset.textColor) setTextColor(preset.textColor);",
  "if (preset.textColor) setTextColor(preset.textColor);\n    if (preset.scrolling !== undefined) setScrolling(preset.scrolling);"
);

// 7. Add scrolling in handleSaveNewPreset
code = code.replace(
  "textColor,\n      showNursery: showNurseryBadge,",
  "textColor,\n      scrolling,\n      showNursery: showNurseryBadge,"
);

// 8. Add scrolling in handleUpdatePreset
code = code.replace(
  "textColor: editForm.textColor,\n      showNursery: editForm.showNursery,",
  "textColor: editForm.textColor,\n      scrolling: editForm.scrolling,\n      showNursery: editForm.showNursery,"
);

// 9. Add scrolling in handleEditPreset
code = code.replace(
  "textColor: preset.textColor || '#FACC15',\n      showNursery: preset.showNursery || false,",
  "textColor: preset.textColor || '#FACC15',\n      scrolling: preset.scrolling ?? true,\n      showNursery: preset.showNursery || false,"
);

// 10. Add scrolling in handleCopyCurrentToEditForm
code = code.replace(
  "textColor,\n      showNursery: showNurseryBadge,",
  "textColor,\n      scrolling,\n      showNursery: showNurseryBadge,"
);

fs.writeFileSync('src/components/AlertModal.tsx', code);
