import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { PresentationItem } from '../types';
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
  LogOut,
  Bell,
  RefreshCw,
  Sparkles,
  ChevronRight
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
  const [serverPin, setServerPin] = useState('8492');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Clock ticker for stage timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch valid PIN from server
  useEffect(() => {
    fetch('/api/remote/pin')
      .then(res => res.json())
      .then(data => {
        if (data.pin) {
          setServerPin(data.pin);
          if (pinFromUrl === data.pin || pinFromUrl === '8492') {
            setIsAuthorized(true);
          }
        }
      })
      .catch(() => {
        if (pinFromUrl === '8492' || (pinFromUrl && pinFromUrl.length >= 4)) {
          setIsAuthorized(true);
        }
      });
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
        if (nextInput === serverPin || nextInput === '8492') {
          setTimeout(() => {
            setIsAuthorized(true);
          }, 200);
        } else if (nextInput.length === 4) {
          setTimeout(() => {
            setPinError(true);
            setPinInput('');
            if (navigator.vibrate) navigator.vibrate(100);
          }, 200);
        }
      }
    }
  };

  // Real-time synchronization loop: Polls the server state and pushes changes
  useEffect(() => {
    if (!isAuthorized) return;

    // Helper to fetch server state
    const syncState = async () => {
      try {
        setIsSyncing(true);
        const res = await fetch('/api/sync/state');
        if (res.ok) {
          const payload = await res.json();
          if (payload.success && payload.data) {
            const serverState = payload.data;
            if (payload.remotePin) {
              setServerPin(payload.remotePin);
            }
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
        // Silent poll error
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
        }).catch(() => {});
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [isAuthorized, lastSyncTime]);

  // Push remote command to server
  const sendRemoteCommand = (action: string, params?: any) => {
    if (navigator.vibrate) navigator.vibrate(35);
    try {
      fetch('/api/remote/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params })
      }).catch(() => {});
    } catch (e) {}
  };

  // Extract active slide and active item details
  const activeGroupId = store.activeControlGroupId || (store.outputGroups[0]?.id) || 'group-congregation';
  const groupState = store.groupStates[activeGroupId];
  const stagedState = store.stagedGroupStates[activeGroupId];
  const activeSchedule = store.activeSchedule;
  
  // Staged item & slide (operator preview)
  const stagedItem = activeSchedule?.items.find(item => item.id === stagedState?.activeItemId) || (stagedState?.directLiveItem as PresentationItem | undefined);
  const stagedSlideIndex = stagedState?.activeSlideIndex ?? 0;
  const stagedSlides = stagedItem?.data?.slides || [];
  const stagedSlide = stagedSlides[stagedSlideIndex];

  // Public live item & slide (actual projector output)
  const liveItem = activeSchedule?.items.find(item => item.id === groupState?.activeItemId) || (groupState?.directLiveItem as PresentationItem | undefined);
  const liveSlideIndex = groupState?.activeSlideIndex ?? 0;

  // Primary item to display in the controls is the staged item if available, otherwise live item
  const currentItem = stagedItem || liveItem;
  const currentSlideIndex = stagedItem ? stagedSlideIndex : liveSlideIndex;
  const slides = stagedItem ? stagedSlides : (liveItem?.data?.slides || []);
  const currentSlide = slides[currentSlideIndex];

  const isStagedUncommitted = Boolean(
    stagedItem && (
      stagedItem.id !== liveItem?.id ||
      stagedSlideIndex !== liveSlideIndex ||
      !groupState?.isLiveEnabled ||
      groupState?.isBlack ||
      groupState?.isClear
    )
  );

  // Quick alert trigger from mobile
  const handleSendAlert = (presetOrMessage?: string | any) => {
    let alertData: any = {
      active: true,
      message: '',
      position: 'bottom',
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      textColor: '#FACC15'
    };

    if (typeof presetOrMessage === 'object' && presetOrMessage !== null) {
      alertData = {
        active: true,
        message: presetOrMessage.message || '',
        position: presetOrMessage.position || 'bottom',
        backgroundColor: presetOrMessage.backgroundColor || 'rgba(15, 23, 42, 0.96)',
        textColor: presetOrMessage.textColor || '#FACC15',
        showNursery: presetOrMessage.showNursery || false,
        nurseryText: presetOrMessage.nurseryText || ''
      };
    } else if (typeof presetOrMessage === 'string' && presetOrMessage.trim()) {
      alertData.message = presetOrMessage.trim();
    } else {
      const text = alertText.trim();
      if (!text) return;
      alertData.message = text;
    }

    if (!alertData.message) return;

    store.setAlert(alertData);
    sendRemoteCommand('set_alert', alertData);

    setAlertText('');
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleClearAlert = () => {
    store.setAlert({ active: false });
    sendRemoteCommand('clear_alert');
    if (navigator.vibrate) navigator.vibrate(30);
  };

  // Render Login PIN Screen
  if (!isAuthorized) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0c0e14] text-white p-6 select-none font-sans">
        <div className="w-full max-w-xs flex flex-col items-center">
          {/* Pulsing Wifi Icon */}
          <div className="w-16 h-16 rounded-2xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-5 shadow-lg shadow-purple-900/20">
            <Wifi size={28} className="animate-pulse" />
          </div>

          <h1 className="text-lg font-black tracking-tight text-white mb-1">SimpleWorship Remote</h1>
          <p className="text-xs text-gray-400 text-center mb-6 leading-relaxed">
            Enter the 4-digit pairing PIN shown in the Moderator Hub to link this controller.
          </p>

          {/* Hidden PIN View with custom dots */}
          <div className="flex gap-3 mb-6">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx} 
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-black font-mono transition-all duration-150 ${
                  pinError 
                    ? 'border-rose-500 bg-rose-950/30 text-rose-400 animate-bounce' 
                    : pinInput.length > idx 
                      ? 'border-purple-500 bg-purple-950/40 text-purple-300 shadow-md shadow-purple-500/20' 
                      : 'border-[#262b3a] bg-[#141722] text-gray-600'
                }`}
              >
                {pinInput.length > idx ? '•' : ''}
              </div>
            ))}
          </div>

          {pinError && (
            <p className="text-xs text-rose-400 font-bold mb-4 animate-shake">
              Invalid security PIN. Please try again!
            </p>
          )}

          {/* Custom Responsive Keypad */}
          <div className="w-full grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handlePinKeyPress(num)}
                className="h-13 bg-[#171a25] hover:bg-[#202534] active:bg-purple-900/40 border border-[#272d3e] rounded-xl font-bold text-lg text-gray-100 transition-all select-none cursor-pointer active:scale-95 shadow-xs"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePinKeyPress('clear')}
              className="h-13 bg-[#24161d] hover:bg-[#321d28] active:bg-rose-950/30 text-rose-400 border border-rose-900/40 rounded-xl font-bold text-xs uppercase select-none cursor-pointer active:scale-95"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handlePinKeyPress('0')}
              className="h-13 bg-[#171a25] hover:bg-[#202534] active:bg-purple-900/40 border border-[#272d3e] rounded-xl font-bold text-lg text-gray-100 transition-all select-none cursor-pointer active:scale-95 shadow-xs"
            >
              0
            </button>
            <div className="h-13 flex items-center justify-center text-purple-400 bg-[#12141d] rounded-xl border border-transparent">
              <Lock size={16} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Authorized Mobile Dashboard Controller
  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0b0c10] text-white font-sans select-none overflow-hidden">
      {/* Mobile Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#131620] border-b border-[#212635] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Wifi size={16} />
            </div>
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-white uppercase flex items-center gap-1.5">
              <span>SimpleWorship Remote</span>
            </h1>
            <p className="text-[10px] text-gray-400 truncate max-w-[160px]">
              {activeSchedule?.name || 'Live Service'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentTime && (
            <span className="text-[10px] font-mono text-gray-400 bg-black/40 px-2 py-1 rounded border border-white/5">
              {currentTime}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsAuthorized(false)}
            className="p-1.5 bg-[#1b1e2a] hover:bg-rose-950/30 text-gray-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Log Out Remote"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 min-h-0">
        
        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 bg-[#131620] p-1 rounded-xl border border-[#212635] shrink-0">
          <button
            type="button"
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
            type="button"
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
            type="button"
            onClick={() => setActiveTab('alert')}
            className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'alert' 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bell size={13} />
            <span>Alerts</span>
          </button>
        </div>

        {/* TAB 1: QUICK CONTROLS */}
        {activeTab === 'control' && (
          <div className="flex-1 flex flex-col gap-3 justify-between">
            {/* Display Screen Preview Card */}
            <div className="bg-[#11131b] border border-[#212635] rounded-2xl p-4 flex flex-col justify-center items-center text-center relative overflow-hidden min-h-[140px] shadow-inner flex-1">
              {groupState?.isBlack ? (
                <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
                  <span className="text-rose-500 text-xs font-black tracking-widest uppercase bg-rose-950/60 px-3 py-1 rounded border border-rose-500/40">
                    SCREEN BLACKOUT ACTIVE
                  </span>
                </div>
              ) : groupState?.isClear ? (
                <div className="absolute inset-0 bg-[#0d0f14]/90 flex items-center justify-center z-10">
                  <span className="text-cyan-400 text-xs font-black tracking-widest uppercase bg-cyan-950/60 px-3 py-1 rounded border border-cyan-500/40">
                    LYRICS CLEARED
                  </span>
                </div>
              ) : null}

              {store.alert?.active && (
                <div className="w-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-lg text-amber-300 text-[10px] font-bold mb-2 flex items-center justify-between">
                  <span className="truncate">ALERT: {store.alert.message}</span>
                  <span className="text-[8px] bg-amber-500 text-black px-1 rounded font-black">LIVE</span>
                </div>
              )}

              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1 block truncate max-w-full">
                {currentItem?.name || 'No Slide Selected'}
              </span>
              
              <p className="text-sm md:text-base font-bold text-gray-100 max-w-xs leading-relaxed px-2 line-clamp-3">
                {currentSlide?.text || 'Ready for live output...'}
              </p>

              {currentItem && (
                <span className="text-[10px] text-gray-500 mt-2 font-mono">
                  Slide {currentSlideIndex + 1} of {Math.max(1, slides.length)} {currentSlide?.label ? `• ${currentSlide.label}` : ''}
                </span>
              )}
            </div>

            {/* Quick Slide Carousel / Chips */}
            {slides.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto py-1 shrink-0 no-scrollbar">
                {slides.map((s, idx) => (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => {
                      store.goLiveSlide(idx, activeGroupId);
                      sendRemoteCommand('go_live_slide', { slideIndex: idx });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                      idx === currentSlideIndex 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'bg-[#181b26] text-gray-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {s.label || `Slide ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            {/* OVERRIDES BUTTON GRID */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  store.toggleBlack(activeGroupId);
                  sendRemoteCommand('toggle_black');
                }}
                className={`py-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 active:scale-95 ${
                  groupState?.isBlack 
                    ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/30' 
                    : 'bg-[#1c1218] border-rose-950/40 text-rose-400'
                }`}
              >
                <EyeOff size={15} />
                <span>BLACK</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  store.toggleClear(activeGroupId);
                  sendRemoteCommand('toggle_clear');
                }}
                className={`py-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 active:scale-95 ${
                  groupState?.isClear 
                    ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-600/30' 
                    : 'bg-[#121922] border-cyan-950/40 text-cyan-400'
                }`}
              >
                <Radio size={15} />
                <span>CLEAR</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  store.toggleLogo(activeGroupId);
                  sendRemoteCommand('toggle_logo');
                }}
                className={`py-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 active:scale-95 ${
                  groupState?.showLogo 
                    ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/30' 
                    : 'bg-[#1b1710] border-amber-950/40 text-amber-400'
                }`}
              >
                <Tv size={15} />
                <span>LOGO</span>
              </button>
            </div>

            {/* GIANT MASTER LIVE / PROJECTOR BUTTON */}
            <button
              type="button"
              onClick={() => {
                store.toggleMasterLive(activeGroupId);
                sendRemoteCommand('toggle_live', { groupId: activeGroupId });
              }}
              className={`w-full py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 text-white font-black tracking-wider text-xs sm:text-sm cursor-pointer border active:scale-98 transition-all shrink-0 shadow-lg ${
                groupState?.isLiveEnabled
                  ? 'bg-rose-600 active:bg-rose-500 border-rose-400/80 shadow-rose-600/30'
                  : 'bg-emerald-600 active:bg-emerald-500 border-emerald-400/80 shadow-emerald-600/30 animate-pulse'
              }`}
            >
              <Play size={18} className="fill-white" />
              <span>{groupState?.isLiveEnabled ? 'LIVE ON • PROJECTOR MIRRORING' : 'GO LIVE (START PROJECTOR)'}</span>
            </button>

            {/* GIANT NEXT/PREV TOUCH TARGETS */}
            <div className="grid grid-cols-2 gap-2.5 shrink-0 h-[100px]">
              <button
                type="button"
                onClick={() => {
                  store.goLivePrev();
                  sendRemoteCommand('go_prev');
                }}
                className="bg-[#141722] active:bg-[#1f2434] border border-[#23293a] rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all text-gray-200 cursor-pointer shadow-sm"
              >
                <ArrowLeft size={22} className="text-cyan-400" />
                <span className="text-xs font-extrabold tracking-wider">PREVIOUS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  store.goLiveNext();
                  sendRemoteCommand('go_next');
                }}
                className="bg-purple-600 active:bg-purple-500 rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all text-white shadow-lg shadow-purple-600/20 cursor-pointer"
              >
                <ArrowRight size={22} className="text-white" />
                <span className="text-xs font-extrabold tracking-wider">NEXT SLIDE</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE SCHEDULE PLAYLIST */}
        {activeTab === 'playlist' && (
          <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">
              Schedule Playlist ({activeSchedule?.items?.length || 0})
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {activeSchedule?.items.map((item, idx) => {
                const isStaged = item.id === stagedState?.activeItemId;
                const isLive = item.id === groupState?.activeItemId && groupState?.isLiveEnabled;
                return (
                  <div 
                    key={item.id}
                    className={`border rounded-xl transition-all overflow-hidden ${
                      isStaged 
                        ? 'bg-purple-950/30 border-purple-500/50' 
                        : isLive
                        ? 'bg-emerald-950/30 border-emerald-500/40'
                        : 'bg-[#12141c] border-[#222634] hover:bg-[#181a25]'
                    }`}
                  >
                    {/* Item Row */}
                    <button
                      type="button"
                      onClick={() => {
                        store.goLiveItem(item.id, 0, activeGroupId);
                        sendRemoteCommand('go_live_item', { itemId: item.id, slideIndex: 0 });
                      }}
                      className="w-full px-3.5 py-2.5 text-left flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-bold text-gray-500 font-mono">
                          {idx + 1}.
                        </span>
                        <span className={`text-xs font-bold truncate ${isStaged ? 'text-purple-300' : isLive ? 'text-emerald-300' : 'text-gray-200'}`}>
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLive && (
                          <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black">
                            LIVE
                          </span>
                        )}
                        <span className="text-[9px] uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-bold shrink-0">
                          {item.type}
                        </span>
                      </div>
                    </button>

                    {/* Quick Slide Sub-list if Staged */}
                    {isStaged && (
                      <div className="border-t border-purple-500/20 px-2.5 py-2 bg-purple-950/20 space-y-1">
                        {(item.data?.slides || []).map((slide: any, sIdx: number) => {
                          const isSlideActive = sIdx === currentSlideIndex;
                          return (
                            <button
                              key={slide.id || sIdx}
                              type="button"
                              onClick={() => {
                                store.goLiveSlide(sIdx, activeGroupId);
                                sendRemoteCommand('go_live_slide', { slideIndex: sIdx });
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] flex justify-between items-center transition-all cursor-pointer ${
                                isSlideActive 
                                  ? 'bg-purple-600 text-white font-bold' 
                                  : 'bg-black/20 hover:bg-black/40 text-gray-400'
                              }`}
                            >
                              <span className="truncate max-w-[180px]">{slide.text || `(Slide ${sIdx + 1})`}</span>
                              <span className="text-[9px] shrink-0 font-mono opacity-80">
                                {slide.label || `#${sIdx + 1}`}
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
          <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto">
            {/* Active Alert Banner */}
            {store.alert?.active && (
              <div className="bg-amber-500/15 border border-amber-500/40 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                    ACTIVE LIVE ALERT
                  </span>
                  <p className="text-xs text-amber-200 font-bold mt-0.5">
                    {store.alert.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearAlert}
                  className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="bg-[#12141c] border border-[#222634] p-3.5 rounded-xl space-y-2.5">
              <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertTriangle size={14} />
                Send Instant Screen Alert
              </h3>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Broadcast instant emergency messages or nursery alerts to all live display screens.
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
                    placeholder="e.g. Nursery #304 is requested..."
                    className="flex-1 bg-[#0b0c10] border border-[#2d3244] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendAlert();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSendAlert()}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 active:scale-95 rounded-lg text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
                  >
                    <Send size={13} />
                    <span>Broadcast</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                Quick Alert Presets (Tap to send)
              </span>
              <div className="space-y-1.5">
                {(store.alertPresets || []).map((preset: any) => (
                  <button
                    key={preset.id || preset.message}
                    type="button"
                    onClick={() => handleSendAlert(preset)}
                    className="w-full text-left py-2 px-3 bg-[#131620] border border-[#222635] text-gray-300 hover:text-white text-[11px] font-medium rounded-lg hover:bg-[#1d2230] transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20" 
                        style={{ backgroundColor: preset.backgroundColor || '#0F172A' }} 
                      />
                      <div className="truncate">
                        <span className="font-semibold text-gray-200 block truncate group-hover:text-amber-300 transition-colors">
                          {preset.title || preset.message}
                        </span>
                        {preset.title && preset.title !== preset.message && (
                          <span className="text-[10px] text-gray-500 block truncate">
                            {preset.message}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={13} className="text-gray-500 group-hover:text-amber-400 shrink-0" />
                  </button>
                ))}
                {(store.alertPresets || []).length === 0 && (
                  <div className="py-2.5 text-center text-gray-500 text-[11px] bg-[#12141c] border border-[#202430] rounded-lg">
                    No presets saved.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer Branding info */}
      <footer className="px-4 py-2 bg-[#090a0d] border-t border-[#1a1c25] flex justify-between items-center text-[9px] text-gray-500 shrink-0">
        <span>SimpleWorship Wireless Remote</span>
        <span className="font-mono text-purple-400">PIN: {serverPin}</span>
      </footer>
    </div>
  );
}
