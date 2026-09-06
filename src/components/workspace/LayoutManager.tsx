import React, { useState, useRef, useEffect } from 'react';
import { 
  Panel, 
  PanelGroup, 
  ImperativePanelHandle 
} from 'react-resizable-panels';
import { ChevronRight, Calendar } from 'lucide-react';
import { useWorkspaceLayout } from '../../context/WorkspaceContext';
import { useStore } from '../../store/useStore';
import ResizeHandle from '../ResizeHandle';
import SchedulePanel from '../SchedulePanel';
import LivePanel from '../LivePanel';
import FixedLiveDisplay from './FixedLiveDisplay';
import BottomModuleBar from './BottomModuleBar';
import { Song, PresentationItem } from '../../types';

export interface LayoutManagerProps {
  onOpenNewSong: () => void;
  onEditSong: (song: Song) => void;
  onEditScheduleItem?: (item: PresentationItem) => void;
}

export default function LayoutManager({ onOpenNewSong, onEditSong, onEditScheduleItem }: LayoutManagerProps) {
  const { 
    panels, 
    layoutKey, 
    updatePanelSize,
    updatePanelCollapsed
  } = useWorkspaceLayout();
  const store = useStore();
  const { outputGroups, activeControlGroupId, setActiveControlGroupId } = store;

  const schedulePanelRef = useRef<ImperativePanelHandle>(null);

  // Check visibility and docking state for left schedule sidebar
  const isScheduleDocked = Boolean(panels.schedule?.visible && panels.schedule?.isDocked);
  const [isScheduleCollapsed, setIsScheduleCollapsed] = useState<boolean>(Boolean(panels.schedule?.isCollapsed));

  // Keep collapse state synced with workspace layout
  useEffect(() => {
    setIsScheduleCollapsed(Boolean(panels.schedule?.isCollapsed));
  }, [panels.schedule?.isCollapsed]);

  // Determine active target route for the Fixed Live Output Panel (Without Display)
  const effectiveTargetGroupId = (() => {
    if (activeControlGroupId && outputGroups.some(g => g.id === activeControlGroupId)) {
      return activeControlGroupId;
    }
    return outputGroups[0]?.id || 'group-1';
  })();

  // Synchronize store if activeControlGroupId is not yet set
  useEffect(() => {
    if (!activeControlGroupId && outputGroups.length > 0) {
      setActiveControlGroupId(outputGroups[0].id);
    }
  }, [activeControlGroupId, outputGroups, setActiveControlGroupId]);

  // Keyboard shortcut Ctrl+\ / Cmd+\ and event listener to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setIsScheduleCollapsed(prev => {
          const next = !prev;
          updatePanelCollapsed('schedule', next);
          return next;
        });
      }
    };
    const handleToggle = () => {
      setIsScheduleCollapsed(prev => {
        const next = !prev;
        updatePanelCollapsed('schedule', next);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('simpleworship:toggle-sidebar', handleToggle);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('simpleworship:toggle-sidebar', handleToggle);
    };
  }, [updatePanelCollapsed]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative w-full h-full bg-[#0d0f14]" key={layoutKey}>
      {/* Main Workspace 3-Pane / 2-Pane Horizontal Area */}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex relative">
        {/* Collapsed Schedule Sidebar Strip */}
        {isScheduleDocked && isScheduleCollapsed && (
          <div className="w-8 h-full bg-[#111319] border-r border-[#242838] flex flex-col items-center py-2.5 shrink-0 select-none z-20">
            <button
              onClick={() => {
                setIsScheduleCollapsed(false);
                updatePanelCollapsed('schedule', false);
              }}
              className="p-1.5 rounded hover:bg-[#1f2330] text-gray-400 hover:text-sky-300 transition-colors cursor-pointer"
              title="Expand Schedule & Library Sidebar (Ctrl+\)"
            >
              <ChevronRight size={16} />
            </button>
            <div 
              onClick={() => {
                setIsScheduleCollapsed(false);
                updatePanelCollapsed('schedule', false);
              }}
              className="mt-6 flex-1 flex items-center justify-center cursor-pointer text-gray-500 hover:text-sky-400 transition-colors"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              title="Click to expand Schedule and Library"
            >
              <span className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 py-3">
                <Calendar size={12} className="inline rotate-90 text-sky-400" />
                SCHEDULE & LIBRARY
              </span>
            </div>
          </div>
        )}

        <PanelGroup 
          direction="horizontal" 
          autoSaveId="simpleworship-main-workspace-3pane-v4" 
          className="h-full w-full"
        >
          {/* 1. Left Sidebar: Schedule & Resources Panel */}
          {isScheduleDocked && !isScheduleCollapsed && (
            <>
              <Panel 
                ref={schedulePanelRef}
                id="panel-schedule-sidebar"
                order={1}
                defaultSize={23} 
                minSize={12} 
                maxSize={55}
                collapsible={true}
                onResize={(size) => updatePanelSize('schedule', size)}
                onCollapse={() => {
                  setIsScheduleCollapsed(true);
                  updatePanelCollapsed('schedule', true);
                }}
                onExpand={() => {
                  setIsScheduleCollapsed(false);
                  updatePanelCollapsed('schedule', false);
                }}
              >
                <div className="h-full w-full overflow-hidden flex bg-[#111319]">
                  <SchedulePanel 
                    onEditSlide={onEditScheduleItem} 
                    onOpenNewSong={onOpenNewSong}
                    onEditSong={onEditSong}
                  />
                </div>
              </Panel>
              <ResizeHandle direction="horizontal" id="handle-schedule" />
            </>
          )}

          {/* 2. Middle Panel: Live Output Control (Slide Grid & Cues) */}
          <Panel 
            id="panel-fixed-live-control"
            order={2}
            defaultSize={isScheduleDocked && !isScheduleCollapsed ? 38.5 : 50} 
            minSize={15}
          >
            <div className="h-full w-full overflow-hidden flex bg-[#111319]">
              <LivePanel 
                key={`live-control-${effectiveTargetGroupId}`}
                groupId={effectiveTargetGroupId} 
                showPreviewDisplay={false} 
              />
            </div>
          </Panel>

          <ResizeHandle direction="horizontal" id="handle-live-display" />

          {/* 3. Right Panel: Fixed Live Monitor Output Display */}
          <Panel 
            id="panel-fixed-live-display"
            order={3}
            defaultSize={isScheduleDocked && !isScheduleCollapsed ? 38.5 : 50} 
            minSize={15}
          >
            <div className="h-full w-full overflow-hidden flex bg-[#111319]">
              <FixedLiveDisplay forcedGroupId={effectiveTargetGroupId} />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* 4. Bottom Module Bar */}
      <BottomModuleBar />
    </div>
  );
}
