import React from 'react';
import { 
  Film, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Pin
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useWorkspace } from '../context/WorkspaceContext';
import MediaTab from './resources/MediaTab';
import PresentationsTab from './resources/PresentationsTab';
import CamerasTab from './resources/CamerasTab';
import { Song } from '../types';

interface ResourcesPanelProps {
  onToggleCollapse?: () => void;
  onExpand?: () => void;
  onCollapse?: () => void;
  onOpenNewSong: () => void;
  onEditSong: (song: Song) => void;
}

export default function ResourcesPanel({ 
  onToggleCollapse, 
  onExpand, 
  onCollapse, 
  onOpenNewSong, 
  onEditSong 
}: ResourcesPanelProps) {
  const store = useStore();
  const { panels, togglePanelDock } = useWorkspace();
  const isDocked = panels.resources?.isDocked ?? true;
  const { resourcesTab, setResourcesTab, isResourcesOpen, toggleResources } = store;

  const tabs = [
    { id: 'media', label: 'Media', icon: <Film size={13} className="text-emerald-400" /> },
    { id: 'presentations', label: 'Presentations', icon: <FileText size={13} className="text-blue-400" /> },
    { id: 'cameras', label: 'Cameras', icon: <Film size={13} className="text-pink-400" /> },
  ];

  const handleTabClick = (tabId: any) => {
    setResourcesTab(tabId);
    if (!isResourcesOpen) {
      if (onExpand) {
        onExpand();
      } else {
        store.setIsResourcesOpen(true);
        if (onToggleCollapse) onToggleCollapse();
      }
    }
  };

  const handleToggle = () => {
    if (isResourcesOpen) {
      if (onCollapse) {
        onCollapse();
      } else {
        toggleResources();
        if (onToggleCollapse) onToggleCollapse();
      }
    } else {
      if (onExpand) {
        onExpand();
      } else {
        store.setIsResourcesOpen(true);
        if (onToggleCollapse) onToggleCollapse();
      }
    }
  };

  return (
    <div className="bg-[#1c1e24] border-t border-[#15161a] flex flex-col w-full h-full min-h-0 overflow-hidden">
      {/* Resources Tab Header Bar */}
      <div className="h-8 bg-[#22252c] border-b border-[#18191e] flex items-center justify-between px-3 shrink-0 select-none">
        <div className="flex items-center space-x-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = resourcesTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-t text-xs font-semibold transition-all cursor-pointer ${
                  isActive && isResourcesOpen
                    ? 'bg-[#181a1f] text-white border-t-2 border-t-indigo-500 border-x border-[#15161a] -mb-px'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#2b2f38]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Drawer Toggle & Dock Toggle */}
        <div className="flex items-center space-x-1.5">
          {/* Dock / Undock (Float) toggle */}
          <button
            onClick={() => togglePanelDock('resources')}
            className={`p-1 rounded hover:bg-[#343844] transition-colors text-[10px] cursor-pointer ${
              !isDocked ? 'text-cyan-400 bg-[#2b2f38]' : 'text-gray-400 hover:text-white'
            }`}
            title={isDocked ? 'Float / Undock Resources Panel' : 'Dock Resources Panel to Grid'}
          >
            <Pin size={12} className={isDocked ? '' : 'rotate-45'} />
          </button>

          <button
            onClick={handleToggle}
            className="flex items-center gap-1 text-[11px] text-gray-300 hover:text-white px-2 py-0.5 rounded hover:bg-[#343844] transition-colors font-medium cursor-pointer"
          >
            <span>{isResourcesOpen ? 'Collapse' : 'Expand Resources'}</span>
            {isResourcesOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* Active Tab Body */}
      {isResourcesOpen && (
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-[#141519]">
          {resourcesTab === 'presentations' ? (
            <PresentationsTab />
          ) : resourcesTab === 'cameras' ? (
            <CamerasTab />
          ) : (
            <MediaTab />
          )}
        </div>
      )}
    </div>
  );
}
