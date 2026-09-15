import React, { useState, useEffect } from 'react';
import { Tv, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DisplayManager } from '../core/DisplayManager';

interface RouteProjectorButtonProps {
  groupId: string;
  className?: string;
  compact?: boolean;
}

export default function RouteProjectorButton({ groupId, className = '', compact = false }: RouteProjectorButtonProps) {
  const outputGroups = useStore(state => state.outputGroups);
  const group = outputGroups.find(g => g.id === groupId);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check initial projector status
    const status = DisplayManager.getLocalStatus(groupId);
    setIsConnected(status === 'CONNECTED');

    const handleStatus = (e: any) => {
      if (e?.detail?.groupId === groupId) {
        setIsConnected(e.detail.status === 'CONNECTED');
      }
    };

    window.addEventListener('simpleworship:projector-status', handleStatus);
    return () => {
      window.removeEventListener('simpleworship:projector-status', handleStatus);
    };
  }, [groupId]);

  if (!group) return null;

  const targetDisplay = (group.displayIds && group.displayIds[0]) || group.targetDisplayId || undefined;

  const handleOpenProjector = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await DisplayManager.openProjector(groupId, targetDisplay);
      if (res.success) {
        setIsConnected(true);
        window.dispatchEvent(
          new CustomEvent('simpleworship:notify', {
            detail: `Opened projector window for ${group.name}`
          })
        );
      }
    } catch (err) {
      console.error('Failed to open projector window:', err);
    }
  };

  return (
    <button
      type="button"
      id={`route-projector-btn-${groupId}`}
      onClick={handleOpenProjector}
      className={`flex items-center gap-1.5 rounded transition-all cursor-pointer font-semibold select-none border ${
        isConnected
          ? 'bg-sky-950/70 hover:bg-sky-900/80 border-sky-500/70 text-sky-200 shadow-xs'
          : 'bg-[#181a24] hover:bg-[#222533] border-[#2c3144] text-gray-300 hover:text-white'
      } ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1 text-[10px]'} ${className}`}
      title={`Open dedicated Projector View window for ${group.name}`}
    >
      <Tv size={11} className={isConnected ? 'text-sky-400 animate-pulse' : 'text-gray-400'} />
      <span className="hidden sm:inline">Projector</span>
      <ExternalLink size={9} className="opacity-60" />
      {isConnected && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Projector window is connected" />
      )}
    </button>
  );
}
