import React, { useState } from 'react';
import { X, Globe, Plus, Search, ExternalLink, RefreshCw, Play, Film, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';

interface WebBrowserModalProps {
  onClose: () => void;
}

const POPULAR_WORSHIP_WEB_LINKS = [
  { name: 'Unsplash Worship Backgrounds', url: 'https://unsplash.com/s/photos/worship-background', desc: 'Free high-res background photography' },
  { name: 'Bible Gateway', url: 'https://www.biblegateway.com', desc: 'Online Bible passages and translations' },
  { name: 'Hymnary.org', url: 'https://hymnary.org', desc: 'Comprehensive hymn text & history database' },
  { name: 'PraiseCharts', url: 'https://www.praisecharts.com', desc: 'Sheet music, lyrics, & arrangement database' },
  { name: 'YouTube Live Stream', url: 'https://www.youtube.com', desc: 'Embed live camera streams or background loops' },
];

export default function WebBrowserModal({ onClose }: WebBrowserModalProps) {
  const store = useStore();
  const [targetUrl, setTargetUrl] = useState('https://unsplash.com/s/photos/worship-background');
  const [activeIframeUrl, setActiveIframeUrl] = useState('https://unsplash.com/s/photos/worship-background');
  const [customTitle, setCustomTitle] = useState('Online Web Stream / Asset');

  const handleNavigate = () => {
    let url = targetUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    setTargetUrl(url);
    setActiveIframeUrl(url);
  };

  const handleAddToSchedule = () => {
    const title = customTitle || 'Web Media Stream';
    store.addScheduleItem({
      type: 'presentation',
      name: `[Web] ${title}`,
      notes: `Target URL: ${activeIframeUrl}`,
      customBackgroundUrl: activeIframeUrl
    });

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Added Web item "${title}" to schedule!`
      })
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-5xl h-[88vh] bg-[#1a1c23] border border-[#2d3240] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2d3240] bg-[#21242e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Enterprise Web & Media Stream Browser</h2>
              <p className="text-[11px] text-gray-400">Embed online streams, web media, or live web feeds directly into presentation output</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddToSchedule}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Web Stream to Schedule</span>
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-[#323644] rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* URL Address Control Ribbon */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[#2d3240] bg-[#16181f]">
          <span className="text-xs font-semibold text-gray-400 shrink-0">URL / Stream:</span>
          <div className="flex-1 flex items-center bg-[#0d0e12] border border-[#2c3140] focus-within:border-emerald-500 rounded-lg px-3 py-1.5 transition-colors">
            <Globe size={14} className="text-emerald-400 mr-2 shrink-0" />
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
              placeholder="https://example.com/stream..."
              className="w-full bg-transparent text-xs text-white placeholder:text-gray-600 focus:outline-none"
            />
          </div>

          <button
            onClick={handleNavigate}
            className="px-3.5 py-1.5 bg-[#292e3c] hover:bg-[#353c4e] text-emerald-300 border border-[#3c4458] rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} />
            <span>Load</span>
          </button>

          <a
            href={activeIframeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-[#252834] hover:bg-[#303545] text-gray-300 hover:text-white rounded-lg transition-colors"
            title="Open in external browser window"
          >
            <ExternalLink size={14} />
          </a>
        </div>

        {/* Quick Presets Bar */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-[#292d3a] bg-[#181a21] overflow-x-auto">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1">Quick Links:</span>
          {POPULAR_WORSHIP_WEB_LINKS.map((link, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTargetUrl(link.url);
                setActiveIframeUrl(link.url);
                setCustomTitle(link.name);
              }}
              className="px-2.5 py-1 rounded bg-[#222530] hover:bg-[#2e3342] text-gray-300 hover:text-white text-[11px] font-medium border border-[#313646] transition-all whitespace-nowrap"
            >
              {link.name}
            </button>
          ))}
        </div>

        {/* Embedded Browser Frame */}
        <div className="flex-1 bg-black relative overflow-hidden">
          <iframe
            src={activeIframeUrl}
            title="Embedded Web Presentation Browser"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>

        {/* Footer Info Bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-[#2d3240] bg-[#16181f] text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Secure Web Engine Integration</span>
          </div>
          <span className="text-gray-500 font-mono text-[11px]">Active Target: {activeIframeUrl}</span>
        </div>
      </div>
    </div>
  );
}
