import React, { useState } from 'react';
import { Monitor, MonitorUp, Eye, Sparkles, Pin, Play, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useWorkspace } from '../context/WorkspaceContext';
import { PresentationCore } from '../core/PresentationCore';
import { ThemeEngine } from '../core/ThemeEngine';
import { DisplayManager } from '../core/DisplayManager';
import MonitorPreviewCanvas from './MonitorPreviewCanvas';

export default function MultiGroupPreviewBar() {
  const store = useStore();
  const { panels, togglePanelDock } = useWorkspace();
  const isDocked = panels.multiGroup?.isDocked ?? true;
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: 'left' | 'right' } | null>(null);

  const { 
    outputGroups, 
    groupStates, 
    activeControlGroupId, 
    setActiveControlGroupId, 
    activeSchedule, 
    songsList, 
    themesList,
    alert,
    systemOptions,
    reorderOutputGroups,
    moveOutputGroup
  } = store;

  const handleLaunchProjector = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveControlGroupId(groupId);
    const group = outputGroups.find(g => g.id === groupId);
    const targets = (group?.displayIds && group.displayIds.length > 0)
      ? group.displayIds
      : (group?.targetDisplayId ? [group.targetDisplayId] : []);
    
    if (targets.length === 0) {
      const hash = `#/projector?groupId=${encodeURIComponent(groupId)}`;
      window.open(hash, `projector_generic_${groupId}`, 'width=800,height=600');
      return;
    }

    for (const target of targets) {
      await DisplayManager.sendPresentationToTarget(groupId, target);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#18191e] border-t border-[#121316] p-2 select-none">
      <div className="flex items-center justify-between mb-1.5 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Live Output Groups Preview ({outputGroups.length} Active {outputGroups.length === 1 ? 'Target' : 'Targets'})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
            Drag cards or click arrows to reorder • Click group to focus controls
          </span>
          <button
            onClick={() => togglePanelDock('multiGroup')}
            className={`p-1 rounded hover:bg-[#2e3240] transition-colors text-[10px] ${
              !isDocked ? 'text-cyan-400 bg-[#252834]' : 'text-gray-400 hover:text-white'
            }`}
            title={isDocked ? 'Float / Undock Multi-Group Bar' : 'Dock Multi-Group Bar to Grid'}
          >
            <Pin size={12} className={isDocked ? '' : 'rotate-45'} />
          </button>
        </div>
      </div>

      {/* Dynamic List of Live Preview Panels (No hardcoded count!) */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto custom-scrollbar pr-1">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {outputGroups.map((group, groupIdx) => {
          const isFirst = groupIdx <= 0;
          const isLast = groupIdx >= outputGroups.length - 1;
          const isDragging = draggedGroupId === group.id;
          const isDropHoverLeft = dropTarget?.id === group.id && dropTarget?.side === 'left';
          const isDropHoverRight = dropTarget?.id === group.id && dropTarget?.side === 'right';

          const groupState = groupStates[group.id];
          const isTargeted = activeControlGroupId === group.id;
          const liveItem = groupState ? PresentationCore.getActiveContent(activeSchedule, groupState) : null;
          const slides = liveItem ? PresentationCore.generateSlides(liveItem, songsList, systemOptions) : [];
          const currentSlide = groupState && slides.length > 0 ? slides[groupState.activeSlideIndex] : null;

          // Theme per group
          const globalTheme = themesList.find(t => t.type === 'global') || themesList[0];
          const groupTheme = themesList.find(t => t.id === group.themeId);
          const typeTheme = themesList.find(t => t.type === (liveItem?.type === 'bible' ? 'bible' : 'song'));
          const systemFontOverride = ThemeEngine.getSystemFontForContent(systemOptions, liveItem?.type);
          const resolvedStyles = ThemeEngine.resolveStyles(
            globalTheme?.styles || ThemeEngine.getDefaultGlobalTheme(),
            groupTheme?.styles,
            typeTheme?.styles,
            systemFontOverride,
            liveItem?.themeOverride,
            undefined
          );

          const backgroundUrl = currentSlide?.backgroundUrl || resolvedStyles.backgroundImageUrl;
          const isVideo = currentSlide?.isVideo || (resolvedStyles.backgroundType === 'video' && resolvedStyles.backgroundVideoUrl);

          return (
            <div
              key={group.id}
              draggable
              onDragStart={(e) => {
                setDraggedGroupId(group.id);
                e.dataTransfer.setData('application/json', JSON.stringify({
                  type: 'reorder-output-group',
                  groupId: group.id,
                  sourceIndex: groupIdx
                }));
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDraggedGroupId(null);
                setDropTarget(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const isLeft = (e.clientX - rect.left) < rect.width / 2;
                setDropTarget({ id: group.id, side: isLeft ? 'left' : 'right' });
              }}
              onDragLeave={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (
                  e.clientX < rect.left || 
                  e.clientX >= rect.right || 
                  e.clientY < rect.top || 
                  e.clientY >= rect.bottom
                ) {
                  if (dropTarget?.id === group.id) {
                    setDropTarget(null);
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const side = dropTarget?.side || 'left';
                setDropTarget(null);
                setDraggedGroupId(null);
                const rawJson = e.dataTransfer.getData('application/json');
                if (rawJson) {
                  try {
                    const payload = JSON.parse(rawJson);
                    if (payload && payload.type === 'reorder-output-group') {
                      const srcIdx = payload.sourceIndex;
                      if (typeof srcIdx === 'number' && srcIdx !== -1) {
                        let targetIdx = side === 'left' ? groupIdx : groupIdx + 1;
                        if (srcIdx < targetIdx) targetIdx -= 1;
                        if (srcIdx !== targetIdx && targetIdx >= 0 && targetIdx < outputGroups.length) {
                          reorderOutputGroups(srcIdx, targetIdx);
                        }
                      }
                    }
                  } catch (err) {}
                }
              }}
              onClick={() => setActiveControlGroupId(group.id)}
              className={`rounded-lg border p-2 cursor-pointer transition-all flex flex-col justify-between relative select-none ${
                isDragging ? 'opacity-40 border-2 border-dashed border-cyan-400' : ''
              } ${
                isTargeted
                  ? 'bg-[#222633] border-indigo-500 ring-2 ring-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                  : 'bg-[#1e2027] border-[#2c303c] hover:border-[#3e4454] hover:bg-[#232630]'
              }`}
            >
              {/* Drop Indicators */}
              {isDropHoverLeft && (
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-cyan-400 z-50 shadow-[0_0_12px_#22d3ee] rounded-l pointer-events-none animate-pulse" />
              )}
              {isDropHoverRight && (
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-cyan-400 z-50 shadow-[0_0_12px_#22d3ee] rounded-r pointer-events-none animate-pulse" />
              )}

              {/* Group Header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1 min-w-0">
                  <div 
                    className="p-0.5 text-gray-500 hover:text-cyan-300 cursor-grab active:cursor-grabbing shrink-0" 
                    title="Drag to rearrange position"
                  >
                    <GripVertical size={13} />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-1 py-0.2 rounded bg-[#131418] text-cyan-400 border border-[#2b303d] shrink-0">
                    #{groupIdx + 1}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                  <span className="font-bold text-xs text-gray-200 truncate">{group.name}</span>
                  {/* Assigned Target Displays */}
                  <span 
                    className="text-[9px] font-mono px-1 rounded bg-[#16171c] text-cyan-400 border border-cyan-800/40 shrink-0"
                    title={`Assigned Target Monitor(s): ${(group.displayIds && group.displayIds.length > 0) ? group.displayIds.join(', ') : (group.targetDisplayId || 'None')}`}
                  >
                    {(group.displayIds && group.displayIds.length > 0) ? group.displayIds.join(', ') : (group.targetDisplayId || 'None')}
                  </span>
                  {isTargeted && (
                    <span className="text-[8px] font-bold px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div 
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Left / Right Shift Buttons */}
                  <div className="flex items-center bg-[#15161b] rounded border border-[#2c303d] p-0.5">
                    <button
                      onClick={() => moveOutputGroup(group.id, 'left')}
                      disabled={isFirst}
                      className={`p-0.5 rounded transition-colors ${
                        isFirst ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 hover:text-white hover:bg-[#2b303d]'
                      }`}
                      title="Move Left"
                    >
                      <ChevronLeft size={11} />
                    </button>
                    <button
                      onClick={() => moveOutputGroup(group.id, 'right')}
                      disabled={isLast}
                      className={`p-0.5 rounded transition-colors ${
                        isLast ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 hover:text-white hover:bg-[#2b303d]'
                      }`}
                      title="Move Right"
                    >
                      <ChevronRight size={11} />
                    </button>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const groupState = store.groupStates[group.id];
                      if (groupState?.activeItemId) {
                        // Keep whatever is currently loaded in this output group
                        store.setStagedGroupState(group.id, {
                          isBlack: false,
                          isClear: false,
                          showLogo: false,
                        });
                        store.setActiveControlGroupId(group.id);
                        window.dispatchEvent(
                          new CustomEvent('simpleworship:notify', { 
                            detail: `LIVE: Output active for ${group.name}!` 
                          })
                        );
                      } else {
                        const itemToGoLive = store.activeSchedule?.items.length 
                          ? activeSchedule.items[0].id 
                          : store.previewItemId;
                        if (itemToGoLive) {
                          store.goLiveItem(itemToGoLive, 0, group.id);
                          window.dispatchEvent(
                            new CustomEvent('simpleworship:notify', { 
                              detail: `LIVE: Direct Output to ${group.name}!` 
                            })
                          );
                        }
                      }
                    }}
                    className="p-1 hover:bg-emerald-600/90 bg-emerald-700/80 rounded text-white transition-colors flex items-center gap-1 px-1.5 text-[9px] font-bold shadow-xs active:scale-95 cursor-pointer"
                    title={`Force Go Live directly on ${group.name}`}
                  >
                    <Play size={10} className="fill-white" />
                    <span>LIVE</span>
                  </button>
                  <button
                    onClick={(e) => handleLaunchProjector(group.id, e)}
                    className="p-1 hover:bg-[#343846] rounded text-indigo-300 hover:text-white transition-colors"
                    title="Open Projector Window for this Group"
                  >
                    <MonitorUp size={13} />
                  </button>
                </div>
              </div>

              {/* Canvas Thumbnail */}
              <div className="w-full h-32 rounded bg-black relative overflow-hidden border border-[#2b2d37] flex items-center justify-center shadow-inner">
                <MonitorPreviewCanvas 
                  groupId={group.id} 
                  customGroup={group} 
                  customState={groupState} 
                  showResolutionTag={false} 
                  className="h-full w-full"
                />
              </div>

              {/* Status Footer */}
              <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1.5 px-0.5">
                <span className="truncate max-w-[140px]">{liveItem?.name || 'No Item'}</span>
                <span className="font-mono text-gray-400">
                  {currentSlide ? `Slide ${(groupState?.activeSlideIndex || 0) + 1}/${slides.length}` : '—'}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
