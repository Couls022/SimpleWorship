import React, { useState, useEffect, useRef } from 'react';
import { Plus, GripVertical, FileText, Play, Tv, Copy, Trash2, Upload, LayoutGrid, List, Edit3, Search, Layout } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Asset } from '../../types';
import { savePresentation, getAllPresentations, deletePresentation } from '../../db/presentations';
import { parsePptxOffline } from '../../utils/pptxParser';
import { handleRangeSelection } from '../../utils/selectionUtils';
import { PresentationEditorModal } from '../PresentationEditorModal';

export default function PresentationsTab() {
  const [presentations, setPresentations] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPresIds, setSelectedPresIds] = useState<string[]>([]);
  const [anchorPresId, setAnchorPresId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, pres: Asset } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPresentation, setEditingPresentation] = useState<Asset | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { addScheduleItem, goLiveItem } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPresentations();
  }, []);

  // Listen for global create/edit presentation events
  useEffect(() => {
    const handleOpenEditor = (e: CustomEvent) => {
      if (e.detail?.presentation) {
        setEditingPresentation(e.detail.presentation);
      } else {
        setEditingPresentation(null);
      }
      setIsEditorOpen(true);
    };

    window.addEventListener('simpleworship:open-presentation-editor' as any, handleOpenEditor);
    return () => window.removeEventListener('simpleworship:open-presentation-editor' as any, handleOpenEditor);
  }, []);

  const loadPresentations = async () => {
    const data = await getAllPresentations();
    const sorted = data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setPresentations(sorted);
    if (sorted.length > 0 && selectedPresIds.length === 0) {
      setSelectedPresIds([sorted[0].id]);
      setAnchorPresId(sorted[0].id);
    }
  };

  const filteredPresentations = presentations.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.data?.slides && p.data.slides.some((s: any) => 
      (s.title && s.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.text && s.text.toLowerCase().includes(searchQuery.toLowerCase()))
    ))
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Parsing PPTX: ${file.name}...` }));
      const slides = await parsePptxOffline(file);
      await savePresentation(file.name.replace('.pptx', ''), slides, file);
      await loadPresentations();
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Imported ${slides.length} slides from PPTX!` }));
    } catch (err) {
      console.error('PPTX Parse Error', err);
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Failed to parse PPTX. Ensure it is a valid .pptx file.` }));
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddToSchedule = (pres: Asset) => {
    addScheduleItem({
      id: `sched-item-${Date.now()}`,
      type: 'presentation',
      contentId: pres.id,
      name: pres.name,
      notes: `${pres.data?.slides?.length || 0} slides`,
      data: pres.data,
      isExpanded: false
    });
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Presentation added to schedule' }));
  };

  const handleSendToLive = (pres: Asset) => {
    const itemId = `live-item-${Date.now()}`;
    const item = {
      id: itemId,
      type: 'presentation' as const,
      contentId: pres.id,
      name: pres.name,
      notes: 'Sent to live',
      data: pres.data,
      isExpanded: false
    };
    const { setPreviewItem } = useStore.getState();
    setPreviewItem(item.id, 0);
    goLiveItem(item.id, 0, useStore.getState().activeControlGroupId || undefined, item);
  };

  const handleDragStart = (e: React.DragEvent, pres: Asset) => {
    const payload = {
      type: 'presentation',
      item: {
        id: `pres-drag-${Date.now()}`,
        type: 'presentation',
        contentId: pres.id,
        name: pres.name,
        notes: `${pres.data?.slides?.length || 0} slides`,
        data: {
          ...pres.data,
          fileBytes: undefined
        }
      }
    };
    const jsonStr = JSON.stringify(payload);
    e.dataTransfer.setData('application/json', jsonStr);
    e.dataTransfer.setData('application/x-simpleworship-item', jsonStr);
    e.dataTransfer.setData('text/plain', pres.name);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handlePresClick = (e: React.MouseEvent, pres: Asset) => {
    const { selectedIds, anchorId } = handleRangeSelection(
      filteredPresentations,
      selectedPresIds,
      pres.id,
      e,
      anchorPresId
    );
    setSelectedPresIds(selectedIds);
    setAnchorPresId(anchorId);
  };

  const handleContextMenu = (e: React.MouseEvent, pres: Asset) => {
    e.preventDefault();
    if (!selectedPresIds.includes(pres.id)) {
      setSelectedPresIds([pres.id]);
      setAnchorPresId(pres.id);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, pres });
  };

  const handleDelete = async (pres: Asset) => {
    await deletePresentation(pres.id);
    await loadPresentations();
    setContextMenu(null);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Presentation deleted' }));
  };

  const handleOpenNewPresentation = () => {
    setEditingPresentation(null);
    setIsEditorOpen(true);
  };

  const handleEditPresentation = (pres: Asset) => {
    setEditingPresentation(pres);
    setIsEditorOpen(true);
    setContextMenu(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#181a1f] text-gray-200 select-none text-xs relative overflow-hidden">
      {/* Sleek Compact Header Bar */}
      <div className="h-10 bg-[#22252c] border-b border-[#15161a] flex items-center justify-between px-2.5 gap-2 shrink-0 relative z-10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Quick Search */}
          <div className="relative flex-1 min-w-[80px] max-w-xs shrink">
            <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search decks..."
              className="w-full bg-[#141519] border border-[#373c49] focus:border-indigo-500 rounded pl-7 pr-6 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none transition-colors shadow-inner truncate"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-gray-400 hover:text-white p-0.5 text-[10px]"
                title="Clear Search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* List / Grid toggle */}
          <div className="flex bg-[#111216] rounded border border-[#2b2f3d] p-0.5 shadow-inner shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded cursor-pointer transition-colors ${viewMode === 'list' ? 'bg-[#252836] text-indigo-400 shadow' : 'text-gray-500 hover:text-gray-300'}`}
              title="List View"
            >
              <List size={13} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-[#252836] text-indigo-400 shadow' : 'text-gray-500 hover:text-gray-300'}`}
              title="Grid View"
            >
              <LayoutGrid size={13} />
            </button>
          </div>

          {/* CREATE PRESENTATION BUTTON */}
          <button
            onClick={handleOpenNewPresentation}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-2.5 py-1 rounded text-xs font-bold transition-all shadow cursor-pointer active:scale-95 shrink-0"
            title="Create New Slide Presentation Deck (PowerPoint-Style Editor)"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span className="hidden md:inline">New Presentation</span>
            <span className="md:hidden">New</span>
          </button>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pptx" 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 bg-[#252936] hover:bg-[#303546] text-gray-200 hover:text-white px-2 py-1 rounded text-xs font-semibold border border-[#3b4255] transition-colors shadow cursor-pointer active:scale-95 shrink-0"
            title="Import existing .pptx file"
          >
            <Upload size={12} className="text-cyan-400" />
            <span className="hidden sm:inline">Import PPTX</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-2 overflow-hidden flex flex-col">

      {filteredPresentations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-sm flex flex-col items-center justify-center p-6 border border-[#2b2f3d] bg-[#171922]/90 rounded-xl shadow-lg">
            <div className="w-14 h-14 rounded-2xl bg-indigo-950/70 border border-indigo-500/40 flex items-center justify-center mb-3 text-indigo-400 shadow-inner">
              <Layout size={26} />
            </div>
            <h4 className="font-bold text-gray-100 text-sm mb-1">
              {searchQuery ? 'No Matching Presentations' : 'No Presentations Yet'}
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed mb-4 max-w-xs">
              {searchQuery
                ? `No presentations matched "${searchQuery}". Clear your search or create a new slide presentation.`
                : 'Create a new slide presentation using the PowerPoint-grade editor module, or import a .pptx file.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenNewPresentation}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-indigo-500/25 cursor-pointer active:scale-95"
              >
                <Plus size={14} />
                <span>Create Presentation</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-[#252936] hover:bg-[#323748] text-gray-200 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[#3b4255] transition-all cursor-pointer"
              >
                <Upload size={13} />
                <span>Import PPTX</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`${viewMode === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5' : 'flex flex-col gap-1'} overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-0.5`}>
          {filteredPresentations.map((pres) => {
            const isSelected = selectedPresIds.includes(pres.id);
            
            if (viewMode === 'list') {
              return (
                <div
                  key={pres.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, pres)}
                  onClick={(e) => handlePresClick(e, pres)}
                  onDoubleClick={() => handleSendToLive(pres)}
                  onContextMenu={(e) => handleContextMenu(e, pres)}
                  className={`border rounded-lg flex items-center p-2 transition-all cursor-grab active:cursor-grabbing group shadow-xs ${
                    isSelected
                      ? 'border-indigo-400 bg-[#252836] ring-1 ring-indigo-500/30'
                      : 'bg-[#1f222a] border-[#2d313d] hover:border-indigo-500/50 hover:bg-[#222530]'
                  }`}
                >
                  <div className="flex items-center justify-center text-indigo-400 mr-2 shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="font-bold text-gray-100 truncate text-xs">{pres.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {pres.data?.slides?.length || 0} slides • {pres.data?.slides?.[0]?.title || 'Slide Deck'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditPresentation(pres); }} 
                      className="p-1.5 rounded bg-[#2e3447] text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors" 
                      title="Edit Presentation Slides"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSendToLive(pres); }} 
                      className="p-1.5 rounded bg-emerald-900/40 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors" 
                      title="Send to Live"
                    >
                      <Play size={12} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddToSchedule(pres); }} 
                      className="p-1.5 rounded bg-indigo-900/40 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors" 
                      title="Add to Schedule"
                    >
                      <Plus size={12} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(pres); }} 
                      className="p-1.5 rounded hover:bg-rose-600 text-gray-400 hover:text-white transition-colors" 
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                    <GripVertical size={14} className="text-gray-500 ml-0.5 cursor-grab" />
                  </div>
                </div>
              );
            }

            return (
              <div
                key={pres.id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, pres)}
                onClick={(e) => handlePresClick(e, pres)}
                onDoubleClick={() => handleSendToLive(pres)}
                onContextMenu={(e) => handleContextMenu(e, pres)}
                className={`border rounded-xl p-3 flex flex-col justify-between transition-all cursor-grab active:cursor-grabbing group shadow ${
                  isSelected
                    ? 'border-indigo-400 ring-2 ring-indigo-500/40 bg-[#252836]'
                    : 'bg-[#1f222a] border-[#2d313d] hover:border-indigo-500/50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-900/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-100 truncate text-xs">{pres.name}</h4>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPresentation(pres);
                            }}
                            className="p-1 rounded bg-[#2e3447] text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit Presentation"
                          >
                            <Edit3 size={11} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(pres);
                            }}
                            className="p-1 rounded hover:bg-rose-600 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete presentation"
                          >
                            <Trash2 size={11} />
                          </button>
                          <GripVertical size={12} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400">{pres.data?.slides?.length || 0} slides</span>
                    </div>
                  </div>
                  <div className="bg-[#15161c] p-2 rounded-lg border border-[#272a36] text-[10px] text-gray-400 line-clamp-2 min-h-[38px]">
                    {pres.data?.slides?.[0]?.title || pres.data?.slides?.[0]?.text || 'Slide Presentation Deck'}
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 pt-2 border-t border-[#292c36] mt-2.5">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEditPresentation(pres); }}
                    className="flex-1 flex items-center justify-center gap-1 bg-[#282d3a] hover:bg-[#343b4d] text-indigo-300 hover:text-white py-1 rounded-md text-xs font-medium transition-colors"
                  >
                    <Edit3 size={11} /><span>Edit</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleAddToSchedule(pres); }} 
                    className="flex-1 flex items-center justify-center gap-1 bg-[#282d3a] hover:bg-[#343b4d] text-gray-200 py-1 rounded-md text-xs transition-colors"
                  >
                    <Plus size={11} /><span>Schedule</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSendToLive(pres); }} 
                    className="flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-md text-xs font-bold transition-colors"
                  >
                    <Play size={11} className="fill-white" /><span>Live</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-[#1c1f28] border border-[#373c4d] rounded-lg shadow-2xl py-1 w-52 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${Math.min(contextMenu.y, window.innerHeight - 200)}px`, left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px` }}
        >
          <div className="px-3 py-1.5 font-bold text-indigo-300 border-b border-[#2a2e3d] text-[11px] truncate">
            {contextMenu.pres.name}
          </div>
          <button 
            onClick={() => handleEditPresentation(contextMenu.pres)} 
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2 text-indigo-300"
          >
            <Edit3 size={12} /><span>Edit Presentation Slides...</span>
          </button>
          <button 
            onClick={() => { handleAddToSchedule(contextMenu.pres); setContextMenu(null); }} 
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
          >
            <Plus size={12} className="text-indigo-400" /><span>Add to Schedule</span>
          </button>
          <button 
            onClick={() => { handleSendToLive(contextMenu.pres); setContextMenu(null); }} 
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2 text-emerald-300"
          >
            <Play size={12} className="text-emerald-400" /><span>Send to Live Output</span>
          </button>
          <div className="border-t border-[#2a2e3d] my-1"></div>
          <button 
            onClick={() => handleDelete(contextMenu.pres)} 
            className="w-full px-3 py-1.5 text-left hover:bg-rose-600 hover:text-white flex items-center gap-2 text-rose-300"
          >
            <Trash2 size={12} /><span>Delete</span>
          </button>
        </div>
      )}

      {/* Enterprise Presentation Creator & Editor Modal */}
      {isEditorOpen && (
        <PresentationEditorModal
          presentation={editingPresentation}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingPresentation(null);
          }}
          onSaved={() => {
            loadPresentations();
          }}
        />
      )}
    </div>
  );
}

