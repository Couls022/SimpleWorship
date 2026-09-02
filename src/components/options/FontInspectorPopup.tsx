import React, { useState } from 'react';
import { 
  X, 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignVerticalJustifyStart, 
  AlignVerticalJustifyCenter, 
  AlignVerticalJustifyEnd,
  RotateCcw,
  Check
} from 'lucide-react';
import { FontStyleOptions } from '../../types';

interface FontInspectorPopupProps {
  title?: string;
  font: FontStyleOptions;
  onChange: (updated: FontStyleOptions) => void;
  onClose: () => void;
}

export default function FontInspectorPopup({
  title = 'Font Settings',
  font,
  onChange,
  onClose,
}: FontInspectorPopupProps) {
  const [activeTab, setActiveTab] = useState<'Font' | 'Outline' | 'Shadow' | 'Margins' | 'Format'>('Font');
  const [localFont, setLocalFont] = useState<FontStyleOptions>({ ...font });

  const fontFamilies = [
    'Tahoma',
    'Arial',
    'Segoe UI',
    'Calibri',
    'Trebuchet MS',
    'Georgia',
    'Times New Roman',
    'Verdana',
    'Impact',
    'Montserrat',
    'Roboto',
    'Open Sans'
  ];

  const handleUpdate = (patch: Partial<FontStyleOptions>) => {
    const updated = { ...localFont, ...patch };
    setLocalFont(updated);
    if (onChange) {
      onChange(updated);
    }
  };

  const handleApply = () => {
    onChange(localFont);
    onClose();
  };

  const handleReset = () => {
    const reset: FontStyleOptions = {
      family: 'Tahoma',
      color: '#FFFFFF',
      bold: false,
      italic: false,
      underline: false,
      superscript: false,
      subscript: false,
      alignHorizontal: 'center',
      alignVertical: 'middle',
      maxSize: 64,
      opacity: 100,
      outlineEnabled: true,
      outlineColor: '#000000',
      outlineSize: 3,
      shadowEnabled: true,
      shadowColor: '#000000',
      shadowBlur: 4,
      shadowOffset: 2,
      marginLeft: 0,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      casing: 'none',
      lineSpacing: 1.3,
    };
    setLocalFont(reset);
    if (onChange) {
      onChange(reset);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#242730] border border-[#3b404d] rounded-lg shadow-2xl w-full max-w-md flex flex-col text-xs text-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Header Tabs (Font, Outline, Shadow, Margins, Format) matching screenshot */}
        <div className="bg-[#1c1e24] border-b border-[#303440] flex items-center justify-between px-2 pt-1.5 shrink-0 select-none">
          <div className="flex space-x-1">
            {(['Font', 'Outline', 'Shadow', 'Margins', 'Format'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-t text-xs font-semibold transition-colors ${
                  activeTab === tab
                    ? 'bg-[#2b303d] text-white border-t-2 border-t-blue-500 -mb-px'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#252833]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#343844] mb-1 mr-1"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {activeTab === 'Font' && (
            <div className="space-y-3.5">
              {/* Font Family Dropdown */}
              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Font Family</label>
                <select
                  value={localFont.family}
                  onChange={(e) => handleUpdate({ family: e.target.value })}
                  className="w-full bg-[#16171c] border border-[#3b404d] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {fontFamilies.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color Swatch */}
              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Font Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localFont.color || '#FFFFFF'}
                    onChange={(e) => handleUpdate({ color: e.target.value })}
                    className="w-8 h-8 rounded border border-[#3b404d] bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localFont.color || '#FFFFFF'}
                    onChange={(e) => handleUpdate({ color: e.target.value })}
                    className="flex-1 bg-[#16171c] border border-[#3b404d] rounded px-2.5 py-1 text-xs text-white font-mono uppercase"
                  />
                </div>
              </div>

              {/* Typography Stylers (Bold, Italic, Underline, Superscript, Subscript) */}
              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Style & Script</label>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ bold: !localFont.bold })}
                    className={`w-8 h-7 rounded flex items-center justify-center font-bold text-xs border transition-colors ${
                      localFont.bold
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-[#181a20] border-[#3b404d] text-gray-300 hover:bg-[#2c303c]'
                    }`}
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdate({ italic: !localFont.italic })}
                    className={`w-8 h-7 rounded flex items-center justify-center italic text-xs border transition-colors ${
                      localFont.italic
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-[#181a20] border-[#3b404d] text-gray-300 hover:bg-[#2c303c]'
                    }`}
                    title="Italic"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdate({ underline: !localFont.underline })}
                    className={`w-8 h-7 rounded flex items-center justify-center underline text-xs border transition-colors ${
                      localFont.underline
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-[#181a20] border-[#3b404d] text-gray-300 hover:bg-[#2c303c]'
                    }`}
                    title="Underline"
                  >
                    U
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdate({ superscript: !localFont.superscript, subscript: false })}
                    className={`px-2 h-7 rounded flex items-center justify-center text-xs border transition-colors ${
                      localFont.superscript
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-[#181a20] border-[#3b404d] text-gray-300 hover:bg-[#2c303c]'
                    }`}
                    title="Superscript"
                  >
                    x²
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdate({ subscript: !localFont.subscript, superscript: false })}
                    className={`px-2 h-7 rounded flex items-center justify-center text-xs border transition-colors ${
                      localFont.subscript
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-[#181a20] border-[#3b404d] text-gray-300 hover:bg-[#2c303c]'
                    }`}
                    title="Subscript"
                  >
                    x₂
                  </button>
                </div>
              </div>

              {/* Horizontal & Vertical Alignment buttons */}
              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Alignment</label>
                <div className="flex items-center gap-3">
                  {/* Horizontal */}
                  <div className="flex items-center space-x-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => handleUpdate({ alignHorizontal: align })}
                        className={`p-1.5 rounded border transition-colors ${
                          localFont.alignHorizontal === align
                            ? 'bg-blue-600 border-blue-400 text-white'
                            : 'bg-[#181a20] border-[#3b404d] text-gray-300 hover:bg-[#2c303c]'
                        }`}
                        title={`Align ${align}`}
                      >
                        {align === 'left' && <AlignLeft size={14} />}
                        {align === 'center' && <AlignCenter size={14} />}
                        {align === 'right' && <AlignRight size={14} />}
                      </button>
                    ))}
                  </div>

                  <div className="h-5 w-px bg-[#3b404d]"></div>

                  {/* Vertical */}
                  <div className="flex items-center space-x-1">
                    {(['top', 'middle', 'bottom'] as const).map((valign) => (
                      <button
                        key={valign}
                        type="button"
                        onClick={() => handleUpdate({ alignVertical: valign })}
                        className={`p-1.5 rounded border transition-colors ${
                          localFont.alignVertical === valign
                            ? 'bg-blue-600 border-blue-400 text-white'
                            : 'bg-[#181a20] border-[#3b404d] text-gray-300 hover:bg-[#2c303c]'
                        }`}
                        title={`Vertical ${valign}`}
                      >
                        {valign === 'top' && <AlignVerticalJustifyStart size={14} />}
                        {valign === 'middle' && <AlignVerticalJustifyCenter size={14} />}
                        {valign === 'bottom' && <AlignVerticalJustifyEnd size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Max Size Slider + Stepper */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400 font-semibold">Max Size</span>
                  <span className="font-mono text-cyan-300 font-bold">{localFont.maxSize} pt</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="12"
                    max="160"
                    value={localFont.maxSize}
                    onChange={(e) => handleUpdate({ maxSize: Number(e.target.value) })}
                    className="flex-1 accent-blue-500 h-1.5 bg-[#141519] rounded cursor-pointer"
                  />
                  <input
                    type="number"
                    min="12"
                    max="160"
                    value={localFont.maxSize}
                    onChange={(e) => handleUpdate({ maxSize: Number(e.target.value) })}
                    className="w-14 bg-[#16171c] border border-[#3b404d] rounded px-1.5 py-0.5 text-xs text-center text-white"
                  />
                </div>
              </div>

              {/* Opacity Slider + Stepper */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400 font-semibold">Opacity</span>
                  <span className="font-mono text-cyan-300 font-bold">{localFont.opacity}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={localFont.opacity}
                    onChange={(e) => handleUpdate({ opacity: Number(e.target.value) })}
                    className="flex-1 accent-blue-500 h-1.5 bg-[#141519] rounded cursor-pointer"
                  />
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={localFont.opacity}
                    onChange={(e) => handleUpdate({ opacity: Number(e.target.value) })}
                    className="w-14 bg-[#16171c] border border-[#3b404d] rounded px-1.5 py-0.5 text-xs text-center text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Outline' && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-200">
                <input
                  type="checkbox"
                  checked={localFont.outlineEnabled}
                  onChange={(e) => handleUpdate({ outlineEnabled: e.target.checked })}
                  className="rounded accent-blue-500"
                />
                <span>Enable Text Outline</span>
              </label>

              {localFont.outlineEnabled && (
                <>
                  <div>
                    <label className="text-gray-400 block mb-1 font-semibold">Outline Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={localFont.outlineColor || '#000000'}
                        onChange={(e) => handleUpdate({ outlineColor: e.target.value })}
                        className="w-8 h-8 rounded border border-[#3b404d] bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={localFont.outlineColor || '#000000'}
                        onChange={(e) => handleUpdate({ outlineColor: e.target.value })}
                        className="flex-1 bg-[#16171c] border border-[#3b404d] rounded px-2.5 py-1 text-xs text-white font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-400 font-semibold">Outline Width</span>
                      <span className="font-mono text-cyan-300 font-bold">{localFont.outlineSize || 3} px</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={localFont.outlineSize || 3}
                      onChange={(e) => handleUpdate({ outlineSize: Number(e.target.value) })}
                      className="w-full accent-blue-500 h-1.5 bg-[#141519] rounded cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'Shadow' && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-200">
                <input
                  type="checkbox"
                  checked={localFont.shadowEnabled}
                  onChange={(e) => handleUpdate({ shadowEnabled: e.target.checked })}
                  className="rounded accent-blue-500"
                />
                <span>Enable Drop Shadow</span>
              </label>

              {localFont.shadowEnabled && (
                <>
                  <div>
                    <label className="text-gray-400 block mb-1 font-semibold">Shadow Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={localFont.shadowColor || '#000000'}
                        onChange={(e) => handleUpdate({ shadowColor: e.target.value })}
                        className="w-8 h-8 rounded border border-[#3b404d] bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={localFont.shadowColor || '#000000'}
                        onChange={(e) => handleUpdate({ shadowColor: e.target.value })}
                        className="flex-1 bg-[#16171c] border border-[#3b404d] rounded px-2.5 py-1 text-xs text-white font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-400 font-semibold">Blur Radius</span>
                      <span className="font-mono text-cyan-300 font-bold">{localFont.shadowBlur || 4} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={localFont.shadowBlur || 4}
                      onChange={(e) => handleUpdate({ shadowBlur: Number(e.target.value) })}
                      className="w-full accent-blue-500 h-1.5 bg-[#141519] rounded cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'Margins' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Left Margin (px)</label>
                  <input
                    type="number"
                    value={localFont.marginLeft || 0}
                    onChange={(e) => handleUpdate({ marginLeft: Number(e.target.value) })}
                    className="w-full bg-[#16171c] border border-[#3b404d] rounded px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Top Margin (px)</label>
                  <input
                    type="number"
                    value={localFont.marginTop || 0}
                    onChange={(e) => handleUpdate({ marginTop: Number(e.target.value) })}
                    className="w-full bg-[#16171c] border border-[#3b404d] rounded px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Right Margin (px)</label>
                  <input
                    type="number"
                    value={localFont.marginRight || 0}
                    onChange={(e) => handleUpdate({ marginRight: Number(e.target.value) })}
                    className="w-full bg-[#16171c] border border-[#3b404d] rounded px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Bottom Margin (px)</label>
                  <input
                    type="number"
                    value={localFont.marginBottom || 0}
                    onChange={(e) => handleUpdate({ marginBottom: Number(e.target.value) })}
                    className="w-full bg-[#16171c] border border-[#3b404d] rounded px-2.5 py-1 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Format' && (
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Letter Casing</label>
                <select
                  value={localFont.casing || 'none'}
                  onChange={(e) => handleUpdate({ casing: e.target.value as any })}
                  className="w-full bg-[#16171c] border border-[#3b404d] rounded px-2.5 py-1 text-xs text-white"
                >
                  <option value="none">Normal (As Typed)</option>
                  <option value="uppercase">ALL UPPERCASE</option>
                  <option value="lowercase">all lowercase</option>
                  <option value="titlecase">Title Case</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Line Spacing</label>
                <select
                  value={localFont.lineSpacing || 1.2}
                  onChange={(e) => handleUpdate({ lineSpacing: Number(e.target.value) })}
                  className="w-full bg-[#16171c] border border-[#3b404d] rounded px-2.5 py-1 text-xs text-white"
                >
                  <option value={1.0}>1.0 (Tight)</option>
                  <option value={1.2}>1.2 (Standard)</option>
                  <option value={1.4}>1.4 (Spacious)</option>
                  <option value={1.6}>1.6 (Double)</option>
                </select>
              </div>
            </div>
          )}

          {/* Real-Time Font Preview Box */}
          <div className="mt-4 p-3 rounded bg-black border border-[#3b404d] text-center min-h-[60px] flex items-center justify-center overflow-hidden">
            <div
              style={{
                fontFamily: localFont.family,
                color: localFont.color,
                fontWeight: localFont.bold ? 'bold' : 'normal',
                fontStyle: localFont.italic ? 'italic' : 'normal',
                textDecoration: localFont.underline ? 'underline' : 'none',
                textAlign: localFont.alignHorizontal,
                fontSize: `${Math.min(localFont.maxSize, 28)}px`,
                opacity: localFont.opacity / 100,
                textTransform: localFont.casing === 'uppercase' ? 'uppercase' : localFont.casing === 'lowercase' ? 'lowercase' : localFont.casing === 'titlecase' ? 'capitalize' : 'none',
                textShadow: localFont.shadowEnabled
                  ? `2px 2px ${localFont.shadowBlur || 4}px ${localFont.shadowColor || '#000000'}`
                  : 'none',
                WebkitTextStroke: localFont.outlineEnabled
                  ? `${localFont.outlineSize || 1}px ${localFont.outlineColor || '#000000'}`
                  : 'none',
                lineHeight: localFont.lineSpacing || 1.2,
              }}
            >
              song text line one<br />
              song text line two
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#1c1e24] px-4 py-2.5 border-t border-[#303440] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-gray-400 hover:text-white px-2.5 py-1 rounded hover:bg-[#2f333f] transition-colors"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-[#2b303d] hover:bg-[#383e4e] text-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1 px-4 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-colors"
            >
              <Check size={12} />
              <span>OK</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
