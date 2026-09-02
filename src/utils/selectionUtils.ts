import React from 'react';

/**
 * Enterprise standard Multi-Selection Handler supporting:
 * 1. Single click: Selects ONLY the clicked item (clears all other selections)
 * 2. Ctrl/Cmd + click: Toggles individual item selection in/out of selection set
 * 3. Shift + click: Selects a continuous range between the anchor item and the clicked item
 */
export function handleRangeSelection<T extends { id: string }>(
  items: T[],
  currentSelectedIds: string[],
  clickedId: string,
  event: React.MouseEvent | KeyboardEvent,
  anchorId?: string | null
): { selectedIds: string[]; anchorId: string } {
  const isCtrl = (event as React.MouseEvent).ctrlKey || (event as React.MouseEvent).metaKey;
  const isShift = (event as React.MouseEvent).shiftKey;

  // Case 1: Ctrl / Cmd + Click (Toggle item)
  if (isCtrl && !isShift) {
    if (currentSelectedIds.includes(clickedId)) {
      const filtered = currentSelectedIds.filter(id => id !== clickedId);
      return {
        selectedIds: filtered.length > 0 ? filtered : [clickedId],
        anchorId: clickedId
      };
    } else {
      return {
        selectedIds: [...currentSelectedIds, clickedId],
        anchorId: clickedId
      };
    }
  }

  // Case 2: Shift + Click (Range selection)
  if (isShift) {
    const fromId = anchorId || (currentSelectedIds.length > 0 ? currentSelectedIds[0] : clickedId);
    const fromIndex = items.findIndex(item => item.id === fromId);
    const toIndex = items.findIndex(item => item.id === clickedId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const startIndex = Math.min(fromIndex, toIndex);
      const endIndex = Math.max(fromIndex, toIndex);
      const rangeIds = items.slice(startIndex, endIndex + 1).map(item => item.id);
      
      return {
        selectedIds: rangeIds,
        anchorId: fromId // Keep the initial anchor for subsequent shift-clicks
      };
    }
  }

  // Case 3: Standard single click (default enterprise behavior)
  return {
    selectedIds: [clickedId],
    anchorId: clickedId
  };
}
