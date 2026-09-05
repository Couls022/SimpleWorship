import React, { useRef, useEffect } from 'react';
import { 
  Panel, 
  PanelGroup, 
  ImperativePanelHandle 
} from 'react-resizable-panels';
import { Layers, RotateCcw } from 'lucide-react';
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
    resetLayout, 
    updatePanelSize,
    updatePanelCollapsed
  } = useWorkspaceLayout();
  const store = useStore();
  const { outputGroups, activeControlGroupId, setActiveControlGroupId } = store;

  const schedulePanelRef = useRef<ImperativePanelHandle>(null);

  // Check visibility and docking state for left schedule sidebar
  const isScheduleDocked = Boolean(panels.schedule?.visible && panels.schedule?.isDocked);

  // Check visibility and docking state for bottom Resources drawer
  const isResourcesDocked = Boolean(panels.resources?.visible && panels.resources?.isDocked);

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

  // Main 3-Pane / 2-Pane Horizontal Workspace Content
  const horizontalWorkspaceContent = (
    <PanelGroup 
      direction="horizontal" 
      autoSaveId="simpleworship-main-workspace-3pane-v2" 
      className="h-full w-full"
    >
      {/* 1. Left Sidebar: Schedule Panel */}
      {isScheduleDocked && (
        <>
          <Panel 
            ref={schedulePanelRef}
            id="panel-schedule-sidebar"
            order={1}
            defaultSize={22} 
            minSize={12} 
            maxSize={40}
            collapsible={true}
            onResize={(size) => updatePanelSize('schedule', size)}
            onCollapse={() => updatePanelCollapsed('schedule', true)}
            onExpand={() => updatePanelCollapsed('schedule', false)}
          >
            <div className="h-full w-full overflow-hidden flex border-r border-[#262832]">
              <SchedulePanel 
                onEditSlide={onEditScheduleItem} 
                onOpenNewSong={onOpenNewSong}
                onEditSong={onEditSong}
              />
            </div>
          </Panel>
          <ResizeHandle direction="horizontal" />
        </>
      )}

      {/* 2. Middle Panel (Yellow Box): Fixed Live Output Panel WITHOUT Display */}
      <Panel 
        id="panel-fixed-live-control"
        order={2}
        defaultSize={isScheduleDocked ? 39 : 50} 
        minSize={20}
      >
        <div className="h-full w-full overflow-hidden flex border-r border-[#242735]">
          <LivePanel 
            key={`live-control-${effectiveTargetGroupId}`}
            groupId={effectiveTargetGroupId} 
            showPreviewDisplay={false} 
          />
        </div>
      </Panel>

      <ResizeHandle direction="horizontal" />

      {/* 3. Right Panel (Green Box): Fixed Live Output Display */}
      <Panel 
        id="panel-fixed-live-display"
        order={3}
        defaultSize={isScheduleDocked ? 39 : 50} 
        minSize={20}
      >
        <div className="h-full w-full overflow-hidden flex">
          <FixedLiveDisplay forcedGroupId={effectiveTargetGroupId} />
        </div>
      </Panel>
    </PanelGroup>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative w-full h-full bg-[#101217]" key={layoutKey}>
      {/* Main Workspace Area */}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex">
        {horizontalWorkspaceContent}
      </div>

      {/* 
        4. Bottom Module Bar:
        Shows all available output routes/panels, live status, active indicators,
        and allows picking which target panel is active in the Fixed Live Output Panel.
      */}
      <BottomModuleBar />
    </div>
  );
}
