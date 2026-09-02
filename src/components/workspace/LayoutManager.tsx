import React, { useRef, useCallback, useEffect } from 'react';
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
import ResourcesPanel from '../ResourcesPanel';
import MultiGroupPreviewBar from '../MultiGroupPreviewBar';
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
    state, 
    updateGroupSizes,
    updatePanelSize,
    updatePanelCollapsed
  } = useWorkspaceLayout();
  const store = useStore();
  const { outputGroups } = store;

  const schedulePanelRef = useRef<ImperativePanelHandle>(null);
  const resourcesPanelRef = useRef<ImperativePanelHandle>(null);

  // Check visibility and docking states
  const isScheduleDocked = Boolean(panels.schedule?.visible && panels.schedule?.isDocked);
  const isLiveDocked = Boolean(panels.live?.visible && panels.live?.isDocked);
  const isMultiGroupDocked = Boolean(panels.multiGroup?.visible && panels.multiGroup?.isDocked);
  const isResourcesDocked = Boolean(panels.resources?.visible && panels.resources?.isDocked);

  const hasTopDocked = isScheduleDocked || isLiveDocked;
  const isMediaLibraryDocked = Boolean(panels.mediaLibrary?.visible && panels.mediaLibrary?.isDocked);
  const hasBottomDocked = isResourcesDocked || isMultiGroupDocked || isMediaLibraryDocked;

  // Toggle resource panel expansion/collapse with robust size restoration
  const expandResources = useCallback(() => {
    store.setIsResourcesOpen(true);
    updatePanelCollapsed('resources', false);
    const panel = resourcesPanelRef.current;
    if (panel) {
      const currentSize = panel.getSize();
      if (panel.isCollapsed() || currentSize < 20) {
        const savedSize = panels.resources?.size && panels.resources.size >= 25 ? panels.resources.size : 42;
        panel.resize(savedSize);
      }
    }
  }, [updatePanelCollapsed, store, panels.resources?.size]);

  const collapseResources = useCallback(() => {
    store.setIsResourcesOpen(false);
    updatePanelCollapsed('resources', true);
    const panel = resourcesPanelRef.current;
    if (panel) {
      panel.collapse();
    }
  }, [updatePanelCollapsed, store]);

  const toggleResourcesPanel = useCallback(() => {
    const panel = resourcesPanelRef.current;
    const isPanelVisiblyCollapsed = panel ? (panel.isCollapsed() || panel.getSize() < 12) : !store.isResourcesOpen;
    if (isPanelVisiblyCollapsed || !store.isResourcesOpen) {
      expandResources();
    } else {
      collapseResources();
    }
  }, [store.isResourcesOpen, expandResources, collapseResources]);

  // Save layout sizes to context and storage on changes
  const handleVerticalLayoutChange = useCallback((sizes: number[]) => {
    if (sizes.length >= 2) {
      updateGroupSizes('verticalSplit', sizes);
    }
  }, [updateGroupSizes]);

  const handleHorizontalMainLayoutChange = useCallback((sizes: number[]) => {
    if (sizes.length > 0) {
      updateGroupSizes('horizontalMainSplit', sizes);
    }
  }, [updateGroupSizes]);

  // Initial group sizes from state with safe defaults
  const verticalSplit = state.panelGroupSizes?.verticalSplit || [55, 45];
  const horizontalMainSplit = state.panelGroupSizes?.horizontalMainSplit || [20, 80];

  // Schedule default size based on available horizontal panels
  const scheduleDefaultSize = panels.schedule?.size ?? (horizontalMainSplit[0] ?? 20);
  const remainingSizeForLive = horizontalMainSplit[1] ?? 80;
  const liveDefaultSizePerGroup = Math.max(20, remainingSizeForLive / Math.max(1, outputGroups.length));

  // Horizontal Area Panel Group (Live Panels)
  const renderLivePanelGroup = () => (
    <PanelGroup
      key={`live-panel-group-${outputGroups.map(g => g.id).join('-')}`}
      direction="horizontal"
      autoSaveId={`simpleworship-horizontal-live-v3-${outputGroups.length}`}
      onLayout={handleHorizontalMainLayoutChange}
      className="h-full w-full"
    >
      {/* Multiple Live Output Panels */}
      {isLiveDocked && outputGroups.map((group, index) => (
        <React.Fragment key={group.id}>
          <Panel 
            id={`panel-live-${group.id}`}
            order={index}
            defaultSize={liveDefaultSizePerGroup} 
            minSize={20} 
            collapsible={true}
            onResize={(size) => updatePanelSize('live', size)}
            onCollapse={() => updatePanelCollapsed('live', true)}
            onExpand={() => updatePanelCollapsed('live', false)}
          >
            <div className="h-full w-full overflow-hidden flex">
              <LivePanel groupId={group.id} />
            </div>
          </Panel>
          {index < outputGroups.length - 1 && <ResizeHandle direction="horizontal" />}
        </React.Fragment>
      ))}
    </PanelGroup>
  );

  // Bottom Area Panel Group (Resources + optional MultiGroup)
  const renderBottomArea = () => {
    if (isMultiGroupDocked && isResourcesDocked) {
      return (
        <PanelGroup direction="horizontal" autoSaveId="simpleworship-horizontal-bottom-v2" className="h-full w-full">
          <Panel 
            id="panel-multigroup-bottom"
            defaultSize={panels.multiGroup?.size ?? 35} 
            minSize={15} 
            collapsible={true}
            onResize={(size) => updatePanelSize('multiGroup', size)}
            onCollapse={() => updatePanelCollapsed('multiGroup', true)}
            onExpand={() => updatePanelCollapsed('multiGroup', false)}
          >
            <div className="h-full w-full overflow-hidden">
              <MultiGroupPreviewBar />
            </div>
          </Panel>
          <ResizeHandle direction="horizontal" />
          <Panel 
            id="panel-resources-bottom"
            defaultSize={panels.resources?.size ?? 65} 
            minSize={20} 
            collapsible={true}
            onResize={(size) => updatePanelSize('resources', size)}
            onCollapse={() => updatePanelCollapsed('resources', true)}
            onExpand={() => updatePanelCollapsed('resources', false)}
          >
            <div className="h-full w-full overflow-hidden">
              <ResourcesPanel
                onToggleCollapse={toggleResourcesPanel}
                onExpand={expandResources}
                onCollapse={collapseResources}
                onOpenNewSong={onOpenNewSong}
                onEditSong={onEditSong}
              />
            </div>
          </Panel>
        </PanelGroup>
      );
    }

    if (isMultiGroupDocked) {
      return (
        <div className="h-full w-full overflow-hidden">
          <MultiGroupPreviewBar />
        </div>
      );
    }

    if (isResourcesDocked) {
      return (
        <div className="h-full w-full overflow-hidden">
          <ResourcesPanel
            onToggleCollapse={toggleResourcesPanel}
            onExpand={expandResources}
            onCollapse={collapseResources}
            onOpenNewSong={onOpenNewSong}
            onEditSong={onEditSong}
          />
        </div>
      );
    }

    return null;
  };

  // Right Side Content (Vertical split of Live and Bottom Area)
  const renderRightContent = () => {
    if (isLiveDocked && hasBottomDocked) {
      return (
        <PanelGroup
          direction="vertical"
          autoSaveId="simpleworship-vertical-right-content-v3"
          onLayout={handleVerticalLayoutChange}
          className="h-full w-full"
        >
          {/* Top Right: Live Panels */}
          <Panel 
            id="panel-top-right-group"
            order={1}
            defaultSize={verticalSplit[0] ?? 55} 
            minSize={25}
          >
            {renderLivePanelGroup()}
          </Panel>
          <ResizeHandle direction="vertical" />
          
          {/* Bottom Right: Resources & Tabs */}
          <Panel 
            id="panel-bottom-right-group"
            order={2}
            ref={resourcesPanelRef}
            defaultSize={panels.resources?.size ?? (verticalSplit[1] ?? 45)} 
            minSize={8} 
            collapsedSize={4}
            collapsible={true}
            onResize={(size) => {
              updatePanelSize('resources', size);
              if (size >= 12 && !store.isResourcesOpen) {
                store.setIsResourcesOpen(true);
                updatePanelCollapsed('resources', false);
              } else if (size < 9 && store.isResourcesOpen) {
                store.setIsResourcesOpen(false);
                updatePanelCollapsed('resources', true);
              }
            }}
            onCollapse={() => {
              updatePanelCollapsed('resources', true);
              store.setIsResourcesOpen(false);
            }}
            onExpand={() => {
              updatePanelCollapsed('resources', false);
              store.setIsResourcesOpen(true);
            }}
          >
            {renderBottomArea()}
          </Panel>
        </PanelGroup>
      );
    }
    
    if (isLiveDocked) {
      return (
        <div className="h-full w-full">
          {renderLivePanelGroup()}
        </div>
      );
    }
    
    if (hasBottomDocked) {
      return (
        <div className="h-full w-full">
          {renderBottomArea()}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 relative w-full h-full" key={layoutKey}>
      {(isScheduleDocked || isLiveDocked || hasBottomDocked) ? (
        <PanelGroup direction="horizontal" autoSaveId="simpleworship-main-horizontal-v3" className="h-full w-full">
          {/* Left Sidebar: Schedule Panel */}
          {isScheduleDocked && (
            <>
              <Panel 
                ref={schedulePanelRef}
                id="panel-schedule-sidebar"
                order={1}
                defaultSize={scheduleDefaultSize} 
                minSize={12} 
                maxSize={45}
                collapsible={true}
                onResize={(size) => updatePanelSize('schedule', size)}
                onCollapse={() => updatePanelCollapsed('schedule', true)}
                onExpand={() => updatePanelCollapsed('schedule', false)}
              >
                <div className="h-full w-full overflow-hidden flex border-r border-[#262832]">
                  <SchedulePanel onEditSlide={onEditScheduleItem} />
                </div>
              </Panel>
              {(isLiveDocked || hasBottomDocked) && <ResizeHandle direction="horizontal" />}
            </>
          )}

          {/* Right Content Area */}
          {(isLiveDocked || hasBottomDocked) && (
            <Panel id="panel-right-content" order={2} minSize={30}>
              <div className="h-full w-full">
                {renderRightContent()}
              </div>
            </Panel>
          )}
        </PanelGroup>
      ) : (
        /* Empty State when all panels are undocked / popped out */
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 space-y-3 bg-[#111216]">
          <div className="w-14 h-14 rounded-2xl bg-[#1c1e27] border border-[#2e3344] flex items-center justify-center text-indigo-400 shadow-xl">
            <Layers size={28} className="animate-pulse" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-gray-300">All Panels are Detached or Floating</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              All workspace panels are currently either hidden or popped out into floating windows.
            </p>
          </div>
          <button
            onClick={() => resetLayout()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <RotateCcw size={14} />
            <span>Reset Workspace to Default</span>
          </button>
        </div>
      )}
    </div>
  );
}
