import React, { useState } from 'react';
import { X, Bell, Play, Power, AlertTriangle, Check } from 'lucide-react';
import { useStore } from '../store/useStore';

interface AlertModalProps {
  onClose: () => void;
}

export default function AlertModal({ onClose }: AlertModalProps) {
  const store = useStore();
  const { alert, setAlert } = store;

  const [message, setMessage] = useState(alert.message);
  const [position, setPosition] = useState(alert.position);
  const [bgColor, setBgColor] = useState(alert.backgroundColor || '#0F172A');
  const [textColor, setTextColor] = useState(alert.textColor || '#FACC15');

  const presets = [
    'Nursery #304 is requested in the Toddler Room',
    'Nursery #102: Parents please report to the nursery',
    'Driver of White SUV (Plate # ABC-1234), please move your vehicle',
    'Children are dismissed to Sunday School Class',
    'Special Announcement: Fellowship Lunch right after the service'
  ];

  const handleToggleActive = () => {
    setAlert({
      active: !alert.active,
      message,
      position,
      backgroundColor: bgColor,
      textColor
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setAlert({
      message,
      position,
      backgroundColor: bgColor,
      textColor,
      active: true
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#1c1f26] border border-[#2d313d] rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-[#242833] border-b border-[#181a20] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-amber-400" />
            <h2 className="font-bold text-sm text-gray-100">
              Live Screen Message & Nursery Alert
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#343946]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4 text-xs">
          {/* Active Banner Status Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#141519] border border-[#2c303c]">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${alert.active ? 'bg-amber-400 animate-ping' : 'bg-gray-600'}`}></span>
              <div>
                <div className="font-bold text-gray-100">Alert Overlay Status</div>
                <div className="text-[10px] text-gray-400">{alert.active ? 'Currently BROADCASTING to live screens' : 'Disabled / Hidden'}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleActive}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                alert.active
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {alert.active ? 'Stop Alert' : 'Start Alert'}
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="text-gray-400 block mb-1 font-semibold">Quick Presets</label>
            <div className="space-y-1">
              {presets.map((p, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setMessage(p)}
                  className="w-full text-left px-2.5 py-1 rounded bg-[#242732] hover:bg-[#2e3342] text-gray-300 hover:text-white transition-colors truncate text-[11px]"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Alert Message Text */}
          <div>
            <label className="text-gray-400 block mb-1 font-semibold">Message Text *</label>
            <input
              type="text"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Nursery #304 is requested..."
              className="w-full bg-[#141519] border border-[#323642] rounded px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Position & Colors */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-gray-400 block mb-1 font-semibold">Position</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as any)}
                className="w-full bg-[#141519] border border-[#323642] rounded px-2 py-1 text-xs text-gray-200"
              >
                <option value="bottom">Bottom Screen</option>
                <option value="top">Top Screen</option>
              </select>
            </div>

            <div>
              <label className="text-gray-400 block mb-1 font-semibold">Text Color</label>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-full h-7 bg-transparent cursor-pointer rounded border border-[#323642]"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1 font-semibold">Background</label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-full h-7 bg-transparent cursor-pointer rounded border border-[#323642]"
              />
            </div>
          </div>

          {/* Live Marquee Preview */}
          <div>
            <label className="text-gray-400 block mb-1 font-semibold">Ticker Preview</label>
            <div
              className="p-2 rounded border border-amber-500/30 overflow-hidden text-xs font-bold flex items-center gap-2"
              style={{ backgroundColor: bgColor, color: textColor }}
            >
              <span className="px-1 py-0.5 rounded bg-amber-500 text-black text-[9px] font-black uppercase">ALERT</span>
              <span className="truncate">{message || 'No alert text entered'}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#262a36] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-[#272b36] hover:bg-[#323744] text-gray-300 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors shadow-sm"
            >
              Broadcast Alert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
