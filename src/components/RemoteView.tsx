import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  Tv, 
  Play, 
  EyeOff, 
  Radio, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Wifi, 
  Lock, 
  Layers, 
  FileText, 
  Clock, 
  Send, 
  Menu, 
  List,
  AlertTriangle,
  LogOut
} from 'lucide-react';

interface RemoteViewProps {
  pinFromUrl?: string;
}

export default function RemoteView({ pinFromUrl = '' }: RemoteViewProps) {
  const store = useStore();
  const [pinInput, setPinInput] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState<'control' | 'playlist' | 'alert'>('control');
  const [alertText, setAlertText] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isSyncing, setIsSyncing] = useState(false);

  // Security Verification: Acknowledge valid PIN
  const targetPin = '8492'; // Standard default pairing PIN

  useEffect(() => {
    if (pinFromUrl === targetPin) {
      setIsAuthorized(true);
    }
  }, [pinFromUrl]);

  // Handle PIN entry via mobile numeric keypad
  const handlePinKeyPress = (val: string) => {
    setPinError(false);
    if (val === 'clear') {
      setPinInput('');
    } else {
      const nextInput = pinInput + val;
      if (nextInput.length <= 4) {
        setPinInput(nextInput);
        if (nextInput === targetPin) {
          setTimeout(() => {
            setIsAuthorized(true);
          }, 200);
        } else if (nextInput.length === 4) {
          // Wrong PIN entered
          setTimeout(() => {
            setPinError(true);
            setPinInput('');
            // Trigger quick vibration if supported
            if (navigator.vibrate) navigator.vibrate(100);
          }, 200);
        }
      }
    }
  };

  // Real-time synchronization loop: Polls the server state and pushes changes
  useEffect(() => {
    if (!isAuthorized) return;

    let isLocalUpdate = false;

    // Helper to fetch server state
    const syncState = async () => {
      try {
        setIsSyncing(true);
        const res = await fetch('/api/sync/state');
        if (res.ok) {
          const payload = await res.json();
          if (payload.success && payload.data) {
            const serverState = payload.data;
            
            // If the server state has been updated more recently than our local state, merge it
            if (serverState.lastUpdated > lastSyncTime) {
              useStore.setState({
                groupStates: serverState.groupStates || {},
                alert: serverState.alert || useStore.getState().alert,
                ...(serverState.activeSchedule ? { activeSchedule: serverState.activeSchedule } : {})
              });
              setLastSyncTime(serverState.lastUpdated);
            }
          }
        }
      } catch (err) {
        console.warn('Sync poll failed:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    // Initial sync
    syncState();

    // Poll every 800ms
    const interval = setInterval(syncState, 800);

    // Subscribe to local actions to push them to the server instantly
    const unsubscribe = useStore.subscribe((state, prevState) => {
      if (
        state.groupStates !== prevState.groupStates ||
        state.alert !== prevState.alert ||
        state.activeSchedule !== prevState.activeSchedule
      ) {
        // Push state update to server instantly
        const payload = {
          groupStates: state.groupStates,
          alert: state.alert,
          activeSchedule: state.activeSchedule,
        };
        fetch('/api/sync/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(res => {
          if (res.ok) {
            setLastSyncTime(Date.now());
          }
        }).catch(err => {
          console.warn('Post state failed:', err);
        });
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [isAuthorized, lastSyncTime]);

  // Extract active slide and active item details
  const activeGroupId = store.activeControlGroupId || (store.outputGroups[0]?.id) || 'group-1';
  const groupState = store.groupStates[activeGroupId];
  const activeSchedule = store.activeSchedule;
  
  const currentItem = activeSchedule?.items.find(item => item.id === groupState?.activeItemId);
  const currentSlideIndex = groupState?.activeSlideIndex ?? 0;
  const slides = currentItem?.data?.slides || [];
  const currentSlide = slides[currentSlideIndex];

  // Quick alert trigger
  const handleSendAlert = () => {
    if (!alertText.trim()) return;
    store.setAlert({
      active: true,
      message: alertText.trim(),
      position: 'bottom'
    });
    setAlertText('');
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: 'Nursery / Broadcast Alert sent successfully!' 
      })
    );
  };

  // Render Login PIN Screen
  if (!isAuthorized) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0d0f14] text-white p-6 select-none font-sans">
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* Pulsing Wifi Icon */}
          <div className="w-16 h-16 rounded-full bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-6 animate-pulse">
            <Wifi size={28} />
          </div>

          <h1 className="text-xl font-black tracking-tight text-white mb-1">SimpleWorship Remote</h1>
          <p className="text-xs text-gray-400 text-center mb-8">
            Enter the 4-digit pairing PIN displayed on the main church projection screen.
          </p>

          {/* Hidden PIN View with custom dots */}
          <div className="flex gap-4 mb-8">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx} 
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-black font-mono transition-all duration-150 ${
                  pinError 
                    ? 'border-rose-500 bg-rose-950/20 text-rose-400 animate-bounce' 
                    : pinInput.length > idx 
                      ? 'border-purple-500 bg-purple-950/30 text-purple-300 shadow-lg shadow-purple-500/10' 
                      : 'border-gray-800 bg-[#141720] text-gray-600'
                }`}
              >
                {pinInput.length > idx ? '•' : ''}
              </div>
            ))}
          </div>

          {pinError && (
            <p className="text-xs text-rose-400 font-semibold mb-4 animate-shake">
              Invalid passcode. Please try again!
            </p>
          )}

          {/* Custom Responsive Keypad */}
          <div className="w-full grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                onClick={() => handlePinKeyPress(num)}
                className="h-14 bg-[#161922] hover:bg-[#1f2330] active:bg-purple-950/40 border border-gray-800/60 rounded-xl font-bold text-lg text-gray-200 transition-all select-none cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handlePinKeyPress('clear')}
              className="h-14 bg-[#23151b] hover:bg-[#301c25] active:bg-rose-950/20 text-rose-400 border border-rose-950/40 rounded-xl font-bold text-xs uppercase select-none cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={() => handlePinKeyPress('0')}
              className="h-14 bg-[#161922] hover:bg-[#1f2330] active:bg-purple-950/40 border border-gray-800/60 rounded-xl font-bold text-lg text-gray-200 transition-all select-none cursor-pointer"
            >
              0
            </button>
            <div className="h-14 flex items-center justify-center text-purple-500">
              <Lock size={16} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Authorized Mobile Dashboard Controller
  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0c10] text-white font-sans select-none overflow-hidden">
      {/* Mobile Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#13161f] border-b border-[#222634] shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Wifi size={16} />
            </div>
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-white uppercase">SimpleWorship Remote</h1>
            <p className="text-[10px] text-gray-400 truncate max-w-[150px]">
              {activeSchedule?.name || 'No Active Schedule'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSyncing && (
            <span className="text-[9px] text-purple-400 font-mono animate-pulse">SYNCING</span>
          )}
          <button
            onClick={() => setIsAuthorized(false)}
            className="p-1.5 bg-[#1e222f] hover:bg-rose-950/30 text-gray-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Log Out Remote"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 min-h-0 flex flex-col gap-4">
        
        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 bg-[#13161f] p-1 rounded-xl border border-[#222634] shrink-0">
          <button
            onClick={() => setActiveTab('control')}
            className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'control' 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Tv size={13} />
            <span>Control</span>
          </button>
          <button
            onClick={() => setActiveTab('playlist')}
            className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'playlist' 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <List size={13} />
            <span>Playlist</span>
          </button>
          <button
            onClick={() => setActiveTab('alert')}
            className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'alert' 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Alerts</span>
          </button>
        </div>

        {/* TAB 1: QUICK CONTROLS */}
        {activeTab === 'control' && (
          <div className="flex-1 flex flex-col gap-4 justify-between">
            {/* Display Screen Preview Card */}
            <div className="bg-[#12141c] border border-[#222634] rounded-2xl p-5 flex flex-col justify-center items-center text-center relative overflow-hidden min-h-[140px] shadow-inner flex-1">
              {groupState?.isBlack ? (
                <div className="absolute inset-0 bg-black flex items-center justify-center z-10 animate-fade-in">
                  <span className="text-rose-500 text-xs font-black tracking-widest uppercase">SCREEN BLACKOUT</span>
                </div>
              ) : groupState?.isClear ? (
                <div className="absolute inset-0 bg-[#0d0f14]/90 flex items-center justify-center z-10 animate-fade-in">
                  <span className="text-cyan-400 text-xs font-black tracking-widest uppercase">LYRICS CLEARED</span>
                </div>
              ) : null}

              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1.5 block">
                {currentItem?.name || 'No Slide Selected'}
              </span>
              
              <p className="text-sm md:text-base font-bold text-gray-100 max-w-xs leading-relaxed px-2">
                {currentSlide?.text || 'No presentation slides currently showing.'}
              </p>

              {currentItem?.type === 'song' && (
                <span className="text-[10px] text-gray-500 mt-2 italic font-mono">
                  Slide {currentSlideIndex + 1} of {slides.length} ({currentSlide?.label || 'Verse'})
                </span>
              )}
            </div>

            {/* OVERRIDES BUTTON GRID */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              <button
                onClick={() => store.toggleBlack()}
                className={`py-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 active:scale-95 ${
                  groupState?.isBlack 
                    ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/20' 
                    : 'bg-[#1b1216] border-rose-950/40 text-rose-400'
                }`}
              >
                <EyeOff size={15} />
                <span>BLACK</span>
              </button>
              <button
                onClick={() => store.toggleClear()}
                className={`py-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 active:scale-95 ${
                  groupState?.isClear 
                    ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-600/20' 
                    : 'bg-[#121820] border-cyan-950/40 text-cyan-400'
                }`}
              >
                <Radio size={15} />
                <span>CLEAR</span>
              </button>
              <button
                onClick={() => store.toggleLogo()}
                className={`py-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 active:scale-95 ${
                  groupState?.showLogo 
                    ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/20' 
                    : 'bg-[#1a1610] border-amber-950/40 text-amber-400'
                }`}
              >
                <Tv size={15} />
                <span>LOGO</span>
              </button>
            </div>

            {/* GIANT NEXT/PREV TOUCH TARGETS */}
            <div className="grid grid-cols-2 gap-3 shrink-0 h-[120px]">
              <button
                onClick={() => store.goLivePrev()}
                className="bg-[#13161f] active:bg-[#1e2230] border border-[#222634] rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-gray-200 cursor-pointer"
              >
                <ArrowLeft size={24} className="text-cyan-400" />
                <span className="text-xs font-extrabold tracking-wider">PREVIOUS</span>
              </button>

              <button
                onClick={() => store.goLiveNext()}
                className="bg-purple-600 active:bg-purple-500 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-white shadow-lg shadow-purple-600/10 cursor-pointer"
              >
                <ArrowRight size={24} className="text-white" />
                <span className="text-xs font-extrabold tracking-wider">NEXT SLIDE</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE SCHEDULE PLAYLIST */}
        {activeTab === 'playlist' && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">
              Playlist Items
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {activeSchedule?.items.map((item, idx) => {
                const isActive = item.id === groupState?.activeItemId;
                return (
                  <div 
                    key={item.id}
                    className={`border rounded-xl transition-all overflow-hidden ${
                      isActive 
                        ? 'bg-purple-950/20 border-purple-500/40' 
                        : 'bg-[#12141c] border-[#222634] hover:bg-[#181a25]'
                    }`}
                  >
                    {/* Item Row */}
                    <button
                      onClick={() => store.goLiveItem(item.id, 0)}
                      className="w-full px-4 py-3 text-left flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 mr-2 uppercase">
                          {idx + 1}
                        </span>
                        <span className={`text-xs font-bold ${isActive ? 'text-purple-300' : 'text-gray-200'}`}>
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[9px] uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-bold">
                        {item.type}
                      </span>
                    </button>

                    {/* Quick Slide Sub-list if Active */}
                    {isActive && (
                      <div className="border-t border-purple-500/10 px-3 py-2 bg-purple-950/10 space-y-1">
                        {(item.data?.slides || []).map((slide: any, sIdx: number) => {
                          const isSlideActive = sIdx === currentSlideIndex;
                          return (
                            <button
                              key={slide.id}
                              onClick={() => {
                                if (isActive && store.activeControlGroupId) {
                                  store.setGroupState(store.activeControlGroupId, { activeSlideIndex: sIdx });
                                } else {
                                  store.goLiveItem(item.id, sIdx);
                                }
                              }}
                              className={`w-full px-3 py-2 rounded-lg text-left text-[11px] flex justify-between items-center transition-all cursor-pointer ${
                                isSlideActive 
                                  ? 'bg-purple-600 text-white font-bold' 
                                  : 'bg-black/20 hover:bg-black/40 text-gray-400'
                              }`}
                            >
                              <span className="truncate max-w-[200px]">{slide.text || '(Empty Slide)'}</span>
                              <span className="text-[9px] shrink-0 font-mono opacity-80">
                                {slide.label || `Slide ${sIdx + 1}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {(!activeSchedule || activeSchedule.items.length === 0) && (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No items in the active playlist.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ALERTS TRIGGER */}
        {activeTab === 'alert' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="bg-[#12141c] border border-[#222634] p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertTriangle size={14} />
                Nursery & Custom Alerts
              </h3>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Broadcast instant emergency messages or vehicle nursery alerts to all live display screens instantly.
              </p>

              <div>
                <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">
                  Message Text
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={alertText}
                    onChange={(e) => setAlertText(e.target.value)}
                    placeholder="e.g. Nursery #492 Needed"
                    className="flex-1 bg-[#0b0c10] border border-[#2d3244] rounded-lg px-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendAlert();
                    }}
                  />
                  <button
                    onClick={handleSendAlert}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 rounded-lg text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
                  >
                    <Send size={13} />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                Quick Alert Presets
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Nursery Alert #',
                  'Vehicle # PL-920',
                  'Service Starting',
                  'Worship Leader Alert'
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAlertText(preset)}
                    className="py-2.5 px-3 bg-[#13161f] border border-[#222634] text-left text-gray-300 text-[11px] font-semibold rounded-lg hover:bg-[#1c202d] transition-all cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer Branding info */}
      <footer className="px-4 py-2 bg-[#090a0d] border-t border-[#1a1c25] flex justify-between items-center text-[9px] text-gray-600 shrink-0">
        <span>SimpleWorship Remote Engine v7.4</span>
        <span className="font-mono">IP Sync Active</span>
      </footer>
    </div>
  );
}
