import { withPortal } from './common/withPortal';
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Radio, 
  Smartphone, 
  QrCode, 
  Copy, 
  Check, 
  RefreshCw, 
  Play, 
  EyeOff, 
  Tv, 
  ArrowLeft, 
  ArrowRight,
  ExternalLink,
  Wifi,
  Sparkles
} from 'lucide-react';
import QRCode from 'qrcode';
import { useStore } from '../store/useStore';

interface RemoteControlModalProps {
  onClose: () => void;
}

function RemoteControlModal({ onClose }: RemoteControlModalProps) {
  const store = useStore();
  const activeGroupId = store.activeControlGroupId || store.outputGroups[0]?.id || 'group-congregation';
  const groupState = store.groupStates[activeGroupId];
  const activeSchedule = store.activeSchedule;

  const [pin, setPin] = useState(() => {
    return localStorage.getItem('simpleworship_remote_pin') || '8492';
  });
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(true);

  // Construct full pairing URL
  const remoteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?remote=true&pin=${pin}`
    : `http://localhost:3000/?remote=true&pin=${pin}`;

  // Fetch or sync current PIN from server
  useEffect(() => {
    const fetchPin = async () => {
      try {
        const res = await fetch('/api/remote/pin');
        if (res.ok) {
          const data = await res.json();
          if (data.pin) {
            setPin(data.pin);
            localStorage.setItem('simpleworship_remote_pin', data.pin);
          }
        }
      } catch (e) {
        // Fallback to local PIN
      }
    };
    fetchPin();
  }, []);

  // Generate real QR code image whenever remoteUrl updates
  useEffect(() => {
    let isMounted = true;
    setIsGeneratingQr(true);

    QRCode.toDataURL(remoteUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setIsGeneratingQr(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
        if (isMounted) setIsGeneratingQr(false);
      });

    return () => {
      isMounted = false;
    };
  }, [remoteUrl]);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(remoteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', {
          detail: 'Remote pairing URL copied to clipboard!'
        })
      );
    }
  };

  const regeneratePin = async () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(newPin);
    localStorage.setItem('simpleworship_remote_pin', newPin);

    try {
      await fetch('/api/remote/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin })
      });
    } catch (e) {
      // Backend sync fallback
    }

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Generated new security PIN: ${newPin}`
      })
    );
  };

  const handleOpenRemoteInNewTab = () => {
    window.open(remoteUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl bg-[#181a22] border border-[#2e3344] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#292e3e] bg-[#202430]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-inner">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Enterprise Mobile Remote Control Hub</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/40 text-[10px] text-purple-300 font-mono font-normal">
                  Live Sync
                </span>
              </h2>
              <p className="text-xs text-gray-400">Pair smartphones, tablets, or wireless stage clickers to control live output without cables</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-[#343948] rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[75vh]">
          {/* Left Column: Real Pairing QR Code & Link */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="bg-[#12141a] border border-[#2b2f3d] rounded-xl p-5 flex flex-col items-center text-center">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <QrCode size={15} />
                Scan QR Code with Phone Camera
              </span>

              {/* Real Dynamic QR Code Container */}
              <div className="w-48 h-48 bg-white p-2.5 rounded-xl shadow-xl flex items-center justify-center relative border border-purple-400/30">
                {qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt="Scan to pair mobile remote" 
                    className="w-full h-full object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                    <RefreshCw size={24} className="animate-spin text-purple-600" />
                    <span className="text-[11px] font-mono">Generating QR...</span>
                  </div>
                )}
              </div>

              {/* PIN Info with Regenerate Action */}
              <div className="mt-4 flex items-center justify-center gap-2 bg-[#1b1e28] px-3.5 py-1.5 rounded-lg border border-[#2e3344]">
                <span className="text-xs text-gray-400 font-medium">Pairing PIN:</span>
                <span className="text-sm font-black text-purple-300 font-mono tracking-widest bg-purple-950 px-2.5 py-0.5 rounded border border-purple-500/50">
                  {pin}
                </span>
                <button
                  type="button"
                  onClick={regeneratePin}
                  className="p-1 hover:bg-[#2c3140] rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Generate new 4-digit PIN"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Direct Remote Link */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300">
                  Direct Browser Control URL
                </label>
                <button 
                  type="button"
                  onClick={handleOpenRemoteInNewTab}
                  className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <span>Open in Tab</span>
                  <ExternalLink size={11} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={remoteUrl}
                  className="flex-1 bg-[#101217] border border-[#2c303e] rounded-lg px-3 py-2 text-xs font-mono text-purple-200 focus:outline-none truncate select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-sm active:scale-95"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Smartphone Simulator */}
          <div className="bg-[#12141a] border border-[#2b2f3d] rounded-xl p-4 flex flex-col items-center">
            <span className="text-xs font-bold text-gray-300 mb-3 flex items-center gap-1.5">
              <Smartphone size={15} className="text-purple-400" />
              Live Remote Controller Simulator
            </span>

            {/* Mobile Phone Device Frame */}
            <div className="w-60 bg-black rounded-3xl border-4 border-[#353a4a] p-3.5 shadow-2xl flex flex-col gap-2.5 relative">
              {/* Phone Notch */}
              <div className="w-20 h-3 bg-[#353a4a] rounded-b-xl mx-auto mb-1"></div>

              {/* Status Indicator */}
              <div className="flex items-center justify-between text-[10px] text-purple-300 bg-purple-950/60 px-2.5 py-1.5 rounded-lg border border-purple-800/40">
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  CONNECTED
                </span>
                <span className="font-mono text-gray-300">PIN: {pin}</span>
              </div>

              {/* Current Active Slide Label */}
              <div className="bg-[#1a1d26] rounded-lg p-2 text-center border border-white/5">
                <span className="text-[9px] uppercase tracking-wider text-purple-400 font-bold block truncate">
                  {activeSchedule?.name || 'Live Service'}
                </span>
                <span className="text-[11px] font-bold text-gray-200 block truncate">
                  {groupState?.activeItemId ? 'Active Presentation' : 'Waiting for slide...'}
                </span>
              </div>

              {/* Mobile Presentation Controls */}
              <div className="grid grid-cols-2 gap-2 mt-0.5">
                <button
                  type="button"
                  onClick={() => { store.goLivePrev(); }}
                  className="p-3 bg-[#222530] hover:bg-[#2e3342] text-white rounded-xl flex flex-col items-center justify-center gap-1 border border-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowLeft size={16} className="text-cyan-400" />
                  <span className="text-[10px] font-bold">PREV</span>
                </button>

                <button
                  type="button"
                  onClick={() => { store.goLiveNext(); }}
                  className="p-3 bg-[#222530] hover:bg-[#2e3342] text-white rounded-xl flex flex-col items-center justify-center gap-1 border border-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowRight size={16} className="text-cyan-400" />
                  <span className="text-[10px] font-bold">NEXT</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => { store.goLive(); }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-wider flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
              >
                <Play size={14} className="fill-white" />
                <span>GO LIVE (F5)</span>
              </button>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => store.toggleBlack(activeGroupId)}
                  className={`py-2 rounded-lg text-[10px] font-bold border active:scale-95 transition-all flex flex-col items-center cursor-pointer ${
                    groupState?.isBlack
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                      : 'bg-[#2d1b22] hover:bg-rose-900 text-rose-300 border-rose-800/40'
                  }`}
                >
                  <EyeOff size={12} className="mb-0.5" />
                  BLACK
                </button>
                <button
                  type="button"
                  onClick={() => store.toggleClear(activeGroupId)}
                  className={`py-2 rounded-lg text-[10px] font-bold border active:scale-95 transition-all flex flex-col items-center cursor-pointer ${
                    groupState?.isClear
                      ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-600/30'
                      : 'bg-[#1b2533] hover:bg-cyan-900 text-cyan-300 border-cyan-800/40'
                  }`}
                >
                  <Radio size={12} className="mb-0.5" />
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => store.toggleLogo(activeGroupId)}
                  className={`py-2 rounded-lg text-[10px] font-bold border active:scale-95 transition-all flex flex-col items-center cursor-pointer ${
                    groupState?.showLogo
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                      : 'bg-[#292215] hover:bg-amber-900 text-amber-300 border-amber-800/40'
                  }`}
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
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#292e3e] bg-[#14161d]">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <Wifi size={13} className="text-emerald-400" />
            Wireless Protocol: <strong className="text-purple-300">REST & Broadcast Channel Sync Active</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#272a36] hover:bg-[#333745] text-gray-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default withPortal(RemoteControlModal);
