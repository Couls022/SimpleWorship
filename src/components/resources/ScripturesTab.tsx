import React from 'react';
import BibleLibraryModule from '../workspace/BibleLibraryModule';

export default function ScripturesTab() {
  return (
    <div className="w-full h-full flex flex-col bg-[#1f2127] overflow-hidden">
      <BibleLibraryModule isSidebarMode={false} />
    </div>
  );
}
