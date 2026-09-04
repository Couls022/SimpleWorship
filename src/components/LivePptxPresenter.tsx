import '../utils/initPptxViewer';
import React, { useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { useStore } from '../store/useStore';
import { PowerPointViewer } from 'pptx-react-viewer';
import 'pptx-react-viewer/styles';
import { toValidPptxUint8Array } from '../utils/pptxValidator';
import { PresentationItem } from '../types';
import { Presentation } from 'lucide-react';

interface LivePptxPresenterProps {
  groupId: string;
  liveItem: PresentationItem;
  activeSlideIndex: number;
}

class PptxPresenterErrorBoundary extends Component<{ children: ReactNode; itemName: string }, { hasError: boolean }> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[LivePptxPresenter] Caught presentation viewer error:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#15171e] text-gray-400 p-4 text-center">
          <Presentation size={32} className="text-amber-500/70 mb-2" />
          <span className="text-xs font-semibold text-gray-200 mb-1">{this.props.itemName}</span>
          <span className="text-[11px] text-gray-500 max-w-xs">
            Presenter View Active: Use the slide cards above or controls below to navigate presentation slides cleanly.
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

export const LivePptxPresenter: React.FC<LivePptxPresenterProps> = ({
  groupId,
  liveItem,
  activeSlideIndex
}) => {
  const setGroupState = useStore(state => state.setGroupState);
  
  const validBytes = useMemo(() => toValidPptxUint8Array(liveItem.data?.fileBytes), [liveItem.data?.fileBytes]);

  const handleActiveSlideChange = useCallback((index: number) => {
    setGroupState(groupId, {
      activeSlideIndex: index
    });
  }, [groupId, setGroupState]);

  if (!validBytes) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#15171e] text-gray-400 p-4 text-center">
        <Presentation size={28} className="text-amber-400 mb-2 opacity-80" />
        <span className="text-xs font-bold text-gray-200">{liveItem.name || 'PowerPoint Presentation'}</span>
        <span className="text-[10px] text-amber-400/80 font-mono mt-1">
          {liveItem.data?.slides?.length || 0} Slides extracted & ready for presenter navigation
        </span>
      </div>
    );
  }

  return (
    <PptxPresenterErrorBoundary itemName={liveItem.name || 'Presentation'}>
      <div className="w-full h-full bg-black pptx-presenter-override">
        <PowerPointViewer
          content={validBytes}
          fileName={liveItem.name || 'Presentation.pptx'}
          onActiveSlideChange={handleActiveSlideChange}
        />
      </div>
    </PptxPresenterErrorBoundary>
  );
};
