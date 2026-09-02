import fs from 'fs';

const content = `import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Tv, 
  Settings,
  ChevronDown,
  MonitorUp,
  Play,
  Pin,
  Plus,
  X,
  Grid2x2,
  Grid3x3,
  List,
  ListFilter,
  Maximize2
} from 'lucide-react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import ResizeHandle from './ResizeHandle';
import { useStore } from '../store/useStore';
import { useWorkspace } from '../context/WorkspaceContext';
import { PresentationCore } from '../core/PresentationCore';
import RouteConfigModal from './RouteConfigModal';
import { ThemeEngine } from '../core/ThemeEngine';

interface LivePanelProps {
  groupId: string;
}

export default function LivePanel({ groupId }: LivePanelProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  type ViewMode = 'large' | 'medium' | 'small' | 'summary';
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('simpleworship_live_view_mode') as ViewMode) || 'medium';
    } catch {
      return 'medium';
    }
  });
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const handleSelectViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setIsViewMenuOpen(false);
    try {
      localStorage.setItem('simpleworship_live_view_mode', mode);
    } catch {}
  };

  const store = useStore();
  const { panels, togglePanelDock } = useWorkspace();
  const isDocked = panels.live?.isDocked ?? true;

  const { 
    activeSchedule, 
    groupStates, 
    outputGroups, 
    songsList, 
    themesList,
    alert,
    systemOptions,
    setGroupState,
    addOutputGroup,
    removeOutputGroup
  } = store;

  const activeGroup = outputGroups.find(g => g.id === groupId) || outputGroups[0];
  const activeControlState = groupStates[groupId];

  const handleAddPanel = () => {
    const newGroup = {
      id: \`group-\${Date.now()}\`,
      name: \`Display \${outputGroups.length + 1}\`,
      role: 'confidence' as const,
      displayIds: []
    };
    addOutputGroup(newGroup);
  };

  const handleRemovePanel = () => {
    if (outputGroups.length > 1 && activeGroup) {
      removeOutputGroup(activeGroup.id);
    }
  };

  const liveItem = activeControlState ? PresentationCore.getActiveContent(activeSchedule, activeControlState) : null;
  const slides = liveItem ? PresentationCore.generateSlides(liveItem, songsList) : [];
  const currentSlide = activeControlState && slides.length > 0 ? slides[activeControlState.activeSlideIndex] : null;

  // Resolve theme for this live output group
  const globalTheme = themesList.find(t => t.type === 'global') || themesList[0];
  const groupTheme = themesList.find(t => t.id === activeGroup?.themeId);
  const typeTheme = themesList.find(t => t.type === liveItem?.type);
  
  const baseSong = liveItem?.type === 'song' ? songsList.find(s => s.id === liveItem.contentId) : null;
  const itemTheme = themesList.find(t => t.id === (liveItem?.themeId || baseSong?.themeId));
  
  // Schedule item's override takes precedence over the base song's override
  const elementOverride = liveItem?.themeOverride || baseSong?.themeOverride;

  const resolvedStyles = ThemeEngine.resolveStyles(
    globalTheme?.styles || ThemeEngine.getDefaultGlobalTheme(),
    groupTheme?.styles,
    typeTheme?.styles,
    itemTheme?.styles,
    elementOverride
  );

  const backgroundUrl = currentSlide?.backgroundUrl || resolvedStyles.backgroundImageUrl;
  const isVideo = currentSlide?.isVideo || (resolvedStyles.backgroundType === 'video' && resolvedStyles.backgroundVideoUrl);

  const currentSlideIndex = activeControlState?.activeSlideIndex || 0;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rawJson = e.dataTransfer.getData('application/json');
    if (rawJson) {
      try {
        const payload = JSON.parse(rawJson);
        if (payload && payload.item) {
          const itemId = payload.item.id || \`live-\${Date.now()}\`;
          const newItem = {
            id: itemId,
            type: payload.item.type,
            contentId: payload.item.contentId,
            name: payload.item.name,
            notes: payload.item.notes,
            customBackgroundUrl: payload.item.customBackgroundUrl,
            data: payload.item.data
          };
          if (payload.source !== 'schedule') {
            store.addScheduleItem(newItem);
          }
          store.goLiveItem(itemId, 0, groupId); 
          store.setGroupState(groupId, {
            activeItemId: itemId,
            activeSlideIndex: 0,
            isBlack: false,
            isClear: false,
          });
          window.dispatchEvent(
            new CustomEvent('simpleworship:notify', { 
              detail: \`Going LIVE in \${activeGroup?.name} with "\${newItem.name}"!\` 
            })
          );
        }
      } catch (err) {
        console.error('Failed to parse live drop payload', err);
      }
    }
  };

  const handleSelectSlide = (idx: number) => {
    if (liveItem) {
      store.goLiveItem(liveItem.id, idx, groupId);
    }
  };

  return (
    <section 
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleDrop}
      className="w-full h-full flex flex-col bg-[#1e2026] overflow-hidden select-none text-gray-200"
    >
      {/* Live Header */}
      <div className="h-8 bg-[#282b33] border-b border-[#18191d] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-gray-200 tracking-wide uppercase truncate">
            <span className="text-indigo-400">{activeGroup?.name || 'Live Panel'}</span> • Live - {liveItem?.name || 'No Content Live'}
          </span>
          {activeGroup?.displayIds && activeGroup.displayIds.length > 0 && (
            <span className="text-[10px] text-gray-500 font-mono hidden md:inline truncate ml-2">
              [{activeGroup.displayIds.join(', ')}]
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          <div className="relative">
            <button
              onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
              className="p-1 rounded hover:bg-[#383d47] text-gray-400 hover:text-cyan-400 transition-colors"
              title="Live View Options"
            >
              <ListFilter size={12} />
            </button>
            {isViewMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-[#232630] border border-[#3b4152] rounded-md shadow-2xl py-1 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => handleSelectViewMode('large')}
                  className={\`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors \${viewMode === 'large' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'}\`}
                >
                  <Maximize2 size={13} className="text-gray-300 shrink-0" />
                  <span>Large Icons</span>
                </button>
                <button
                  onClick={() => handleSelectViewMode('medium')}
                  className={\`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors \${viewMode === 'medium' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'}\`}
                >
                  <Grid2x2 size={13} className="text-gray-300 shrink-0" />
                  <span>Medium Icons</span>
                </button>
                <button
                  onClick={() => handleSelectViewMode('small')}
                  className={\`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors \${viewMode === 'small' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'}\`}
                >
                  <Grid3x3 size={13} className="text-gray-300 shrink-0" />
                  <span>Small Icons</span>
                </button>
                <div className="border-t border-[#343a4a] my-1"></div>
                <button
                  onClick={() => handleSelectViewMode('summary')}
                  className={\`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors \${viewMode === 'summary' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'}\`}
                >
                  <List size={13} className="text-gray-300 shrink-0" />
                  <span>Summary View</span>
                </button>
              </div>
            )}
          </div>
          {/* Add Panel */}
          <button
            onClick={handleAddPanel}
            className="p-1 rounded hover:bg-[#383d47] text-gray-400 hover:text-cyan-400 transition-colors"
            title="Add Live Panel"
          >
            <Plus size={12} />
          </button>

          {/* Remove Panel */}
          {outputGroups.length > 1 && (
            <button
              onClick={handleRemovePanel}
              className="p-1 rounded hover:bg-[#383d47] text-gray-400 hover:text-rose-400 transition-colors"
              title="Remove Live Panel"
            >
              <X size={12} />
            </button>
          )}

          {/* Dock / Undock (Float) toggle */}
          <button
            onClick={() => togglePanelDock('live')}
            className={\`p-1 rounded hover:bg-[#383d47] transition-colors text-[10px] \${
              !isDocked ? 'text-cyan-400 bg-[#323744]' : 'text-gray-400 hover:text-white'
            }\`}
            title={isDocked ? 'Float / Undock Live Panel' : 'Dock Live Panel to Grid'}
          >
            <Pin size={12} className={isDocked ? '' : 'rotate-45'} />
          </button>

          {/* Configure Route dropdown/button */}
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-[#383d47] rounded text-gray-300 hover:text-white transition-colors text-[10px]"
            title="Configure Output Route"
          >
            <Settings size={13} />
            <ChevronDown size={10} />
          </button>

          {/* Go Live button */}
          <button
            onClick={() => {
              if (store.previewItemId) {
                store.goLiveItem(store.previewItemId, store.previewSlideIndex, groupId);
              } else if (store.activeSchedule?.items.length) {
                store.goLiveItem(store.activeSchedule.items[0].id, 0, groupId);
              }
            }}
            className="p-1 hover:bg-[#383d47] text-gray-300 hover:text-emerald-400 rounded transition-colors"
            title="Go Live (Send Preview to this Panel)"
          >
            <Play size={13} className="fill-current" />
          </button>
        </div>
      </div>

      {isConfigOpen && <RouteConfigModal groupId={groupId} onClose={() => setIsConfigOpen(false)} />}

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical" autoSaveId={\`workspace-layout-v1-live-\${groupId}\`}>
          <Panel defaultSize={65} minSize={25} collapsible>
            <div className={\`h-full bg-[#18191e] p-2 overflow-y-auto custom-scrollbar \${viewMode === 'large' ? 'space-y-3' : viewMode === 'small' || viewMode === 'summary' ? 'space-y-1' : 'space-y-2'}\`}>
              {slides.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-500">
                  Double click any item from Schedule or click 'Go Live' to project
                </div>
              ) : (
                slides.map((slide, idx) => {
                  const isSelected = activeControlState?.activeSlideIndex === idx;
                  const isScripture = liveItem?.type === 'bible';

                  return (
                    <div
                      key={slide.id || idx}
                      onClick={() => handleSelectSlide(idx)}
                      className={\`flex rounded-xs border cursor-pointer select-none transition-all text-left overflow-hidden \${
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-500/50 bg-[#1f2838] shadow-md'
                          : 'border-[#2d3039] bg-[#22242c] hover:border-[#404554]'
                      }\`}
                    >
                      {viewMode !== 'summary' && (
                        <div className={\`bg-[#16171c] border-r border-[#2d3039] flex flex-col items-center justify-start shrink-0 \${viewMode === 'large' ? 'w-12 py-3' : viewMode === 'small' ? 'w-8 py-1' : 'w-10 py-2'}\`}>
                          <span className={\`\${viewMode === 'large' ? 'text-xs' : 'text-[11px]'} font-mono font-bold text-gray-300\`}>
                            {idx + 1}
                          </span>
                          <Tv size={viewMode === 'large' ? 15 : viewMode === 'small' ? 11 : 13} className="text-gray-400 mt-1" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className={\`\${viewMode === 'large' ? 'px-3 py-1 text-xs' : viewMode === 'small' || viewMode === 'summary' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'} font-bold truncate border-b border-black/30 \${
                          isScripture ? 'bg-[#5f171d] text-rose-100' : 'bg-[#1e2a44] text-blue-100'
                        }\`}>
                          {viewMode === 'summary' && (
                            <span className="text-gray-400 font-mono mr-2">{idx + 1}</span>
                          )}
                          {slide.title || liveItem?.name || \`Slide \${idx + 1}\`}
                        </div>

                        {viewMode !== 'summary' && (
                          <div className={\`\${viewMode === 'large' ? 'p-3 text-sm min-h-[64px]' : viewMode === 'small' ? 'p-1.5 text-[10px] min-h-[32px]' : 'p-2 text-[11px] min-h-[48px]'} text-gray-200 leading-relaxed font-sans whitespace-pre-line bg-[#1c1e24]\`}>
                            {slide.text}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>

          <ResizeHandle direction="vertical" />

          <Panel defaultSize={35} minSize={20} collapsible>
            <div className="h-full bg-[#141519] border-t border-[#262832] p-2 flex flex-col overflow-hidden relative">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1 flex items-center justify-between shrink-0">
                <span className="flex items-center gap-1.5 text-gray-300">
                  {activeControlState?.isBlack || activeControlState?.isClear ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  )}
                  {activeGroup?.name || 'Output Preview'}
                </span>
                
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-500 font-mono hidden lg:inline">
                    {activeGroup?.displayIds?.join(', ') || 'No Display Attached'}
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full relative bg-black rounded border border-[#2d303a] overflow-hidden flex items-center justify-center shadow-inner">
                {backgroundUrl && !isVideo && (
                  <img src={backgroundUrl} alt="Background" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                )}
                {isVideo && backgroundUrl && (
                  <video src={backgroundUrl} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-70" />
                )}
                
                {!activeControlState?.isClear && currentSlide?.text && (
                  <div 
                    className="relative z-10 w-full px-6 py-4 flex flex-col justify-center items-center h-full text-center"
                    style={{
                      fontFamily: resolvedStyles.fontFamily,
                      fontSize: resolvedStyles.fontSize ? \`min(4vw, \${resolvedStyles.fontSize})\` : 'min(4vw, 36px)',
                      fontWeight: resolvedStyles.fontWeight,
                      color: resolvedStyles.textColor,
                      lineHeight: resolvedStyles.lineHeight,
                      textTransform: resolvedStyles.textTransform as any,
                      textShadow: resolvedStyles.shadowEnabled 
                        ? \`\${resolvedStyles.shadowOffsetX}px \${resolvedStyles.shadowOffsetY}px \${resolvedStyles.shadowBlur}px \${resolvedStyles.shadowColor}\`
                        : 'none',
                      whiteSpace: 'pre-line'
                    }}
                  >
                    {currentSlide.text}
                  </div>
                )}

                {activeControlState?.isBlack && (
                  <div className="absolute inset-0 bg-black z-50 flex items-center justify-center">
                    <span className="text-[#333] font-bold text-2xl uppercase tracking-[0.5em]">Black</span>
                  </div>
                )}
                {activeControlState?.isClear && (
                  <div className="absolute inset-0 bg-black/40 z-40 flex items-center justify-center backdrop-blur-[2px]">
                    <span className="text-white/20 font-bold text-2xl uppercase tracking-[0.5em]">Clear</span>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </section>
  );
}
`;

fs.writeFileSync('src/components/LivePanel.tsx', content);
