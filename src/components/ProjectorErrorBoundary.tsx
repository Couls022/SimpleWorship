import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackGroupId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ProjectorErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ProjectorErrorBoundary] Caught render exception in projector output pipeline:', error, errorInfo);
  }

  // Auto-recover when props change (e.g., when the operator clicks another slide or item)
  override componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: null });
    }
  }

  override render() {
    if (this.state.hasError) {
      // In production presentation displays, never show an ugly stack trace on screen.
      // Instead, hold a graceful, clean black screen so the congregation sees a pristine display.
      return (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center select-none cursor-none">
          <div className="text-center opacity-20 hover:opacity-100 transition-opacity">
            <span className="text-xs tracking-widest text-slate-500 font-mono">
              OUTPUT STANDBY • RECONNECTING ENGINE
            </span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
