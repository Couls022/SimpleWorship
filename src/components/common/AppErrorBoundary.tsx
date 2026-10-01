import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackType?: 'moderator' | 'projector';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Global Application Caught Exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStateAndReload = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Clear runtime ephemeral states without wiping user data
        localStorage.removeItem('simpleworship_group_states_v1');
        localStorage.removeItem('simpleworship_staged_group_states_v1');
        localStorage.removeItem('simpleworship_route_stack_v1');
      }
    } catch {}
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallbackType === 'projector') {
        return (
          <div className="fixed inset-0 z-[999999] bg-black flex items-center justify-center select-none cursor-none">
            <div className="text-center opacity-30 hover:opacity-100 transition-opacity">
              <span className="text-xs tracking-widest text-slate-500 font-mono">
                SIMPLEWORSHIP LIVE OUTPUT • AUTO-RECONNECTING
              </span>
            </div>
          </div>
        );
      }

      return (
        <div className="fixed inset-0 z-[999999] bg-[#0f1117] text-white flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="w-full max-w-lg bg-[#181a24] border border-rose-500/40 rounded-xl shadow-2xl p-6 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle size={24} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Workspace Recovery Engine</h2>
              <p className="text-xs text-gray-400 mt-1">
                A component error was caught. Your presentations, songs, and schedules remain safely stored in IndexedDB.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-[#10121a] border border-[#272b3a] rounded-lg p-3 text-left font-mono text-[11px] text-rose-300/90 overflow-x-auto max-h-32 custom-scrollbar">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 w-full">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reload Workspace</span>
              </button>

              <button
                onClick={this.handleResetStateAndReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#252a38] hover:bg-[#32384a] text-gray-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                title="Clears temporary window session state and reloads"
              >
                <RotateCcw size={14} />
                <span>Reset Session</span>
              </button>
            </div>

            <div className="text-[10px] text-gray-500 flex items-center gap-1.5 pt-1">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>SimpleWorship Crash Isolation & Auto-Recovery Protocol</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
