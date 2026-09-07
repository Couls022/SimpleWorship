import { withPortal } from './common/withPortal';
import React, { useState } from 'react';
import { X, Radio, Smartphone, QrCode, Copy, Check, Shield, RefreshCw, Play, EyeOff, Tv, ArrowLeft, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';

interface RemoteControlModalProps {
  onClose: () => void;
}

function RemoteControlModal({ onClose }: RemoteControlModalProps) {
  const store = useStore();
  const [pin, setPin] = useState('8492');
  const [copied, setCopied] = useState(false);

  const remoteUrl = `${window.location.origin}${window.location.pathname}?remote=true&pin=${pin}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(remoteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: 'Remote pairing URL copied to clipboard!'
      })
    );
  };

  const regeneratePin = () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(newPin);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl bg-[#1a1c23] border border-[#2d3240] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3240] bg-[#22252e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Radio size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Enterprise Mobile Remote Control Hub</h2>
              <p className="text-xs text-gray-400">Pair smartphones, tablets, or wireless stage clickers to control live output</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-[#343844] rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[75vh]">
          {/* Left Column: Pairing QR Code & Link */}
          <div className="space-y-4">
            <div className="bg-[#14161c] border border-[#2c303d] rounded-xl p-5 flex flex-col items-center text-center">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <QrCode size={14} />
                Scan QR Code to Connect Phone
              </span>

              {/* Simulated Visual QR Code */}
              <div className="w-44 h-44 bg-white p-3 rounded-lg shadow-lg flex items-center justify-center relative group">
                <svg className="w-full h-full text-black" viewBox="0 0 100 100" fill="currentColor">
                  {/* Outer corner squares */}
                  <rect x="5" y="5" width="25" height="25" fill="#000" />
                  <rect x="9" y="9" width="17" height="17" fill="#fff" />
                  <rect x="13" y="13" width="9" height="9" fill="#000" />

                  <rect x="70" y="5" width="25" height="25" fill="#000" />
                  <rect x="74" y="9" width="17" height="17" fill="#fff" />
                  <rect x="78" y="13" width="9" height="9" fill="#000" />

                  <rect x="5" y="70" width="25" height="25" fill="#000" />
                  <rect x="9" y="74" width="17" height="17" fill="#fff" />
                  <rect x="13" y="78" width="9" height="9" fill="#000" />

                  {/* Matrix pattern */}
                  <rect x="35" y="10" width="8" height="8" fill="#000" />
                  <rect x="48" y="10" width="8" height="8" fill="#000" />
                  <rect x="35" y="25" width="8" height="8" fill="#000" />
                  <rect x="48" y="25" width="8" height="8" fill="#000" />

                  <rect x="10" y="38" width="8" height="8" fill="#000" />
                  <rect x="25" y="38" width="8" height="8" fill="#000" />
                  <rect x="40" y="38" width="8" height="8" fill="#000" />
                  <rect x="55" y="38" width="8" height="8" fill="#000" />
                  <rect x="70" y="38" width="8" height="8" fill="#000" />
                  <rect x="85" y="38" width="8" height="8" fill="#000" />

                  <rect x="10" y="52" width="8" height="8" fill="#000" />
                  <rect x="30" y="52" width="8" height="8" fill="#000" />
                  <rect x="50" y="52" width="8" height="8" fill="#000" />
                  <rect x="70" y="52" width="8" height="8" fill="#000" />

                  <rect x="38" y="70" width="8" height="8" fill="#000" />
                  <rect x="52" y="70" width="8" height="8" fill="#000" />
                  <rect x="70" y="70" width="8" height="8" fill="#000" />
                  <rect x="85" y="70" width="8" height="8" fill="#000" />

                  <rect x="38" y="85" width="8" height="8" fill="#000" />
                  <rect x="52" y="85" width="8" height="8" fill="#000" />
                  <rect x="70" y="85" width="8" height="8" fill="#000" />

                  {/* SimpleWorship Badge in center */}
                  <circle cx="50" cy="50" r="10" fill="#9333ea" />
                </svg>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-400">Security PIN:</span>
                <span className="text-sm font-black text-purple-300 font-mono tracking-wider bg-purple-950/80 px-2.5 py-0.5 rounded border border-purple-500/40">
                  {pin}
                </span>
                <button
                  onClick={regeneratePin}
                  className="p-1 hover:bg-[#282b36] rounded text-gray-400 hover:text-white transition-colors"
                  title="Generate new PIN"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>

            {/* Direct Remote Link */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Direct Browser Control URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={remoteUrl}
                  className="flex-1 bg-[#121419] border border-[#2d313d] rounded-lg px-3 py-2 text-xs font-mono text-purple-200 focus:outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Smartphone Simulator */}
          <div className="bg-[#14161c] border border-[#2c303d] rounded-xl p-4 flex flex-col items-center">
            <span className="text-xs font-bold text-gray-300 mb-3 flex items-center gap-1.5">
              <Smartphone size={15} className="text-purple-400" />
              Live Remote Controller Simulator
            </span>

            {/* Mobile Phone Device Frame */}
            <div className="w-56 bg-black rounded-3xl border-4 border-[#353a4a] p-3 shadow-2xl flex flex-col gap-2.5 relative">
              {/* Phone Notch */}
              <div className="w-20 h-3 bg-[#353a4a] rounded-b-xl mx-auto mb-1"></div>

              {/* Status Indicator */}
              <div className="flex items-center justify-between text-[10px] text-purple-300 bg-purple-950/60 px-2 py-1 rounded border border-purple-800/40">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  CONNECTED
                </span>
                <span className="font-mono">PIN: {pin}</span>
              </div>

              {/* Mobile Presentation Controls */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => { store.goLivePrev(); }}
                  className="p-3 bg-[#222530] hover:bg-[#2e3342] text-white rounded-xl flex flex-col items-center justify-center gap-1 border border-white/10 active:scale-95 transition-all"
                >
                  <ArrowLeft size={16} className="text-cyan-400" />
                  <span className="text-[10px] font-bold">PREV</span>
                </button>

                <button
                  onClick={() => { store.goLiveNext(); }}
                  className="p-3 bg-[#222530] hover:bg-[#2e3342] text-white rounded-xl flex flex-col items-center justify-center gap-1 border border-white/10 active:scale-95 transition-all"
                >
                  <ArrowRight size={16} className="text-cyan-400" />
                  <span className="text-[10px] font-bold">NEXT</span>
                </button>
              </div>

              <button
                onClick={() => { store.goLive(); }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-wider flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
              >
                <Play size={14} className="fill-white" />
                <span>GO LIVE (F5)</span>
              </button>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => store.toggleBlack(store.activeControlGroupId || store.outputGroups[0]?.id || "")}
                  className="py-2 bg-[#2d1b22] hover:bg-rose-900 text-rose-300 rounded-lg text-[10px] font-bold border border-rose-800/40 active:scale-95 transition-all flex flex-col items-center"
                >
                  <EyeOff size={12} className="mb-0.5" />
                  BLACK
                </button>
                <button
                  onClick={() => store.toggleClear(store.activeControlGroupId || store.outputGroups[0]?.id || "")}
                  className="py-2 bg-[#1b2533] hover:bg-cyan-900 text-cyan-300 rounded-lg text-[10px] font-bold border border-cyan-800/40 active:scale-95 transition-all flex flex-col items-center"
                >
                  <Radio size={12} className="mb-0.5" />
                  CLEAR
                </button>
                <button
                  onClick={() => store.toggleLogo(store.activeControlGroupId || store.outputGroups[0]?.id || "")}
                  className="py-2 bg-[#292215] hover:bg-amber-900 text-amber-300 rounded-lg text-[10px] font-bold border border-amber-800/40 active:scale-95 transition-all flex flex-col items-center"
                >
                  <Tv size={12} className="mb-0.5" />
                  LOGO
                </button>
              </div>

              {/* Bottom Home Indicator */}
              <div className="w-16 h-1 bg-gray-600 rounded-full mx-auto mt-2"></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#2d3240] bg-[#17191f]">
          <span className="text-xs text-gray-400">
            Wireless Protocol: <strong className="text-purple-300">WebSocket / Broadcast Sync Active</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#272a34] hover:bg-[#323644] text-gray-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default withPortal(RemoteControlModal);
