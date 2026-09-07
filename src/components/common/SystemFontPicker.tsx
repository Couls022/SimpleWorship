import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, RefreshCw, Plus, Check, ChevronDown, Monitor, Type, Sparkles } from 'lucide-react';
import { getAvailableSystemFonts, queryNativeSystemFonts, addCustomUserFont, SystemFontEntry } from '../../utils/systemFonts';

interface SystemFontPickerProps {
  value?: string;
  onChange: (fontFamily: string) => void;
  className?: string;
  buttonClassName?: string;
  title?: string;
  showScanButton?: boolean;
}

export const SystemFontPicker: React.FC<SystemFontPickerProps> = ({
  value = 'Aptos, Calibri, sans-serif',
  onChange,
  className = '',
  buttonClassName = '',
  title = 'Select Font',
  showScanButton = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [customFontInput, setCustomFontInput] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [fontList, setFontList] = useState<SystemFontEntry[]>(() => getAvailableSystemFonts());

  const containerRef = useRef<HTMLDivElement>(null);

  // Extract clean font name for display
  const primaryFamily = value.split(',')[0].replace(/['"]/g, '').trim();

  const [visibleLimit, setVisibleLimit] = useState(40);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // Reload font list whenever fonts are updated
  const updateDropdownPosition = () => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width > 288 ? rect.width : 288,
        zIndex: 1000000
      });
    }
  };

  useLayoutEffect(() => {
    updateDropdownPosition();
    if (isOpen) {
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
    }
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      setFontList(getAvailableSystemFonts());
    };
    window.addEventListener('simpleworship:fonts-updated', handleUpdate);
    return () => window.removeEventListener('simpleworship:fonts-updated', handleUpdate);
  }, []);

  // Reset limit when search query changes for snappy response
  useEffect(() => {
    setVisibleLimit(40);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleScanSystemFonts = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsScanning(true);
    setScanNotice(null);
    try {
      const scanned = await queryNativeSystemFonts();
      setFontList(getAvailableSystemFonts());
      setScanNotice(`Found ${scanned.length} host fonts!`);
      setTimeout(() => setScanNotice(null), 3000);
    } catch {
      setScanNotice('Scan completed');
      setTimeout(() => setScanNotice(null), 2000);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customFontInput.trim()) {
      addCustomUserFont(customFontInput.trim());
      onChange(`${customFontInput.trim()}, sans-serif`);
      setCustomFontInput('');
      setShowAddCustom(false);
      setIsOpen(false);
    }
  };

  const filteredFonts = fontList.filter(f =>
    f.family.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const systemFonts = filteredFonts.filter(f => f.category === 'system' || f.category === 'windows');
  const googleFonts = filteredFonts.filter(f => f.category === 'google');
  const customFonts = filteredFonts.filter(f => f.category === 'custom');

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`flex items-center justify-between gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 focus:border-sky-500 rounded px-2 py-1 text-slate-100 text-[11px] font-medium transition-colors outline-none cursor-pointer ${buttonClassName}`}
        onClick={() => setIsOpen(!isOpen)}
        title={title}
      >
        <span className="truncate max-w-[110px]" style={{ fontFamily: value }}>
          {primaryFamily || 'Select Font'}
        </span>
        <ChevronDown size={12} className="text-slate-400 shrink-0" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && typeof document !== 'undefined' && createPortal(
      <div 
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100"
        style={dropdownStyle}
        onClick={(e) => e.stopPropagation()}
      >
          {/* Search Header & Auto-Detect Button */}
          <div className="p-2 border-b border-slate-800 bg-slate-950 flex flex-col gap-1.5">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-2 text-slate-400" />
              <input
                type="text"
                className="w-full bg-slate-900 border border-slate-800 rounded pl-6 pr-2 py-1 text-[11px] text-slate-100 placeholder-slate-500 focus:border-sky-500 outline-none"
                placeholder="Search host operating system fonts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {/* Scan Computer Fonts Button */}
            {showScanButton && (
              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[10px] text-sky-400 hover:text-sky-300 font-semibold px-1.5 py-0.5 rounded bg-sky-950/40 border border-sky-800/40 hover:bg-sky-900/60 transition-colors"
                  onClick={handleScanSystemFonts}
                  disabled={isScanning}
                  title="Scan & Register all fonts installed on host operating system"
                >
                  <RefreshCw size={11} className={isScanning ? 'animate-spin' : ''} />
                  <span>{isScanning ? 'Scanning Host OS...' : 'Scan Host OS Fonts'}</span>
                </button>

                <button
                  type="button"
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-medium px-1.5 py-0.5 rounded hover:bg-slate-800/80"
                  onClick={() => setShowAddCustom(!showAddCustom)}
                >
                  + Add Custom
                </button>
              </div>
            )}

            {scanNotice && (
              <div className="text-[10px] text-emerald-400 font-medium px-1 bg-emerald-950/40 border border-emerald-800/40 rounded py-0.5 text-center">
                {scanNotice}
              </div>
            )}

            {/* Add Custom Font Input */}
            {showAddCustom && (
              <form onSubmit={handleAddCustom} className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  className="flex-1 bg-slate-900 border border-amber-500/50 rounded px-1.5 py-0.5 text-[10px] text-white outline-none"
                  placeholder="e.g. Century Gothic, Garamond"
                  value={customFontInput}
                  onChange={(e) => setCustomFontInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded"
                >
                  Add
                </button>
              </form>
            )}
          </div>

          {/* Font List Categories */}
          <div 
            className="max-h-64 overflow-y-auto custom-scrollbar p-1"
            onScroll={(e) => {
              const target = e.currentTarget;
              if (target.scrollHeight - target.scrollTop <= target.clientHeight + 60) {
                setVisibleLimit(prev => prev + 50);
              }
            }}
          >
            {customFonts.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Type size={10} />
                  <span>Custom Registered Fonts</span>
                </div>
                {customFonts.slice(0, visibleLimit).map((f) => {
                  const isSelected = primaryFamily.toLowerCase() === f.family.toLowerCase();
                  return (
                    <button
                      key={f.family}
                      type="button"
                      className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-sky-600 text-white font-bold' : 'hover:bg-slate-800 text-slate-200'
                      }`}
                      style={{ fontFamily: `${f.family}, sans-serif` }}
                      onClick={() => {
                        onChange(`${f.family}, sans-serif`);
                        setIsOpen(false);
                      }}
                    >
                      <span className="truncate">{f.family}</span>
                      {isSelected && <Check size={12} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {systemFonts.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-sky-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Monitor size={10} />
                    <span>Host OS Installed Fonts</span>
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">({systemFonts.length})</span>
                </div>
                {systemFonts.slice(0, visibleLimit).map((f) => {
                  const isSelected = primaryFamily.toLowerCase() === f.family.toLowerCase();
                  return (
                    <button
                      key={f.family}
                      type="button"
                      className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-sky-600 text-white font-bold' : 'hover:bg-slate-800 text-slate-200'
                      }`}
                      style={{ fontFamily: `${f.family}, sans-serif` }}
                      onClick={() => {
                        onChange(`${f.family}, sans-serif`);
                        setIsOpen(false);
                      }}
                    >
                      <span className="truncate">{f.family}</span>
                      {isSelected && <Check size={12} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {googleFonts.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Sparkles size={10} className="text-purple-400" />
                    <span>Worship & Display Fonts</span>
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">({googleFonts.length})</span>
                </div>
                {googleFonts.slice(0, visibleLimit).map((f) => {
                  const isSelected = primaryFamily.toLowerCase() === f.family.toLowerCase();
                  return (
                    <button
                      key={f.family}
                      type="button"
                      className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-sky-600 text-white font-bold' : 'hover:bg-slate-800 text-slate-200'
                      }`}
                      style={{ fontFamily: `${f.family}, sans-serif` }}
                      onClick={() => {
                        onChange(`${f.family}, sans-serif`);
                        setIsOpen(false);
                      }}
                    >
                      <span className="truncate">{f.family}</span>
                      {isSelected && <Check size={12} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredFonts.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-[11px]">
                No fonts found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
