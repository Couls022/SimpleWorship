import React, { useState, useEffect, useRef } from 'react';
import { Plus, GripVertical, FileText, Play, Tv, Copy, Trash2, Upload } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Asset } from '../../types';
import { savePresentation, getAllPresentations, deletePresentation } from '../../db/presentations';
import { parsePptxOffline } from '../../utils/pptxParser';
import { handleRangeSelection } from '../../utils/selectionUtils';

export default function PresentationsTab() {
  const [presentations, setPresentations] = useState<Asset[]>([]);
  const [selectedPresIds, setSelectedPresIds] = useState<string[]>([]);
  const [anchorPresId, setAnchorPresId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, pres: Asset } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { addScheduleItem, goLiveItem } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPresentations();
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
    useStore.getState().setRoutingRequest({ item, isNew: true, slideIndex: 0 });
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
        data: pres.data
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
      presentations,
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

  return (
    <div className="flex flex-col h-full bg-[#181a1f] text-gray-200 select-none text-xs p-3 relative">
      <div className="flex items-center justify-between pb-3 border-b border-[#242732] mb-3">
        <div>
          <h3 className="font-bold text-sm text-gray-100">Presentations & Slides</h3>
          <p className="text-[11px] text-gray-400">Offline PPTX text extraction & imported decks</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pptx" 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-semibold transition-colors shadow"
          >
            <Upload size={13} />
            <span>Import PPTX</span>
          </button>
        </div>
      </div>

      {presentations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center border-2 border-dashed border-[#2d313d] rounded-xl m-4">
          <FileText size={48} className="mb-4 text-[#373c4d]" />
          <h4 className="font-bold text-gray-300 text-sm mb-1">No Presentations</h4>
          <p className="text-xs mb-4">Click "Import PPTX" to load a presentation from your computer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto custom-scrollbar">
          {presentations.map((pres) => {
            const isSelected = selectedPresIds.includes(pres.id);
            return (
              <div
                key={pres.id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, pres)}
                onClick={(e) => handlePresClick(e, pres)}
                onDoubleClick={() => handleAddToSchedule(pres)}
                onContextMenu={(e) => handleContextMenu(e, pres)}
                className={`border rounded-lg p-3 flex flex-col justify-between transition-all cursor-grab active:cursor-grabbing group shadow ${
                  isSelected
                    ? 'border-indigo-400 ring-2 ring-indigo-500/40 bg-[#252836]'
                    : 'bg-[#1f222a] border-[#2d313d] hover:border-indigo-500/50'
                }`}
              >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded bg-indigo-900/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-100 truncate text-xs">{pres.name}</h4>
                      <div className="flex items-center gap-1">
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
                <div className="bg-[#15161c] p-2 rounded border border-[#272a36] text-[10px] text-gray-400 line-clamp-2">
                  {pres.data?.slides?.[0]?.text || pres.data?.slides?.[0]?.title || 'No preview text'}
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 pt-2 border-t border-[#292c36] mt-2">
                <button onClick={() => handleAddToSchedule(pres)} className="flex-1 flex items-center justify-center gap-1 bg-[#282d3a] hover:bg-[#343b4d] text-gray-200 py-1 rounded text-xs transition-colors">
                  <Plus size={12} /><span>Schedule</span>
                </button>
                <button onClick={() => handleSendToLive(pres)} className="flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-bold transition-colors">
                  <Play size={12} className="fill-white" /><span>Live</span>
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-[#1c1f28] border border-[#373c4d] rounded-md shadow-2xl py-1 w-52 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${Math.min(contextMenu.y, window.innerHeight - 200)}px`, left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px` }}
        >
          <div className="px-3 py-1 font-bold text-indigo-300 border-b border-[#2a2e3d] text-[11px] truncate">
            {contextMenu.pres.name}
          </div>
          <button onClick={() => { handleAddToSchedule(contextMenu.pres); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2">
            <Plus size={12} className="text-indigo-400" /><span>Add to Schedule</span>
          </button>
          <div className="border-t border-[#2a2e3d] my-1"></div>
          <button onClick={() => handleDelete(contextMenu.pres)} className="w-full px-3 py-1.5 text-left hover:bg-rose-600 hover:text-white flex items-center gap-2 text-rose-300">
            <Trash2 size={12} /><span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
