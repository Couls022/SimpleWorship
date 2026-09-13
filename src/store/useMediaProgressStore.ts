import { create } from 'zustand';

interface MediaProgressState {
  progress: Record<string, { currentTime: number, duration: number }>;
  setProgress: (groupId: string, currentTime: number, duration: number) => void;
}

export const useMediaProgressStore = create<MediaProgressState>((set) => ({
  progress: {},
  setProgress: (groupId, currentTime, duration) => set(state => ({
    progress: {
      ...state.progress,
      [groupId]: { currentTime, duration }
    }
  }))
}));
