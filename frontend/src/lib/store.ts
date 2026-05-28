import { create } from "zustand";

interface AppStore {
  window: 30 | 60 | 252;
  threshold: number;
  selectedPair: [string, string] | null;
  setWindow: (w: 30 | 60 | 252) => void;
  setThreshold: (t: number) => void;
  selectPair: (a1: string, a2: string) => void;
  clearPair: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  window: 60,
  threshold: 2.0,
  selectedPair: null,
  setWindow: (window) => set({ window }),
  setThreshold: (threshold) => set({ threshold }),
  selectPair: (a1, a2) => set({ selectedPair: [a1, a2] }),
  clearPair: () => set({ selectedPair: null }),
}));
