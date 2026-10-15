import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Mode } from '../lib/mode';

interface UiState {
  /** Which "app" is showing: games or series & movies. Per device, not synced. */
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export const useUi = create<UiState>()(
  persist((set) => ({ mode: 'games', setMode: (mode) => set({ mode }) }), { name: 'gamestraker-ui' }),
);

export const useMode = () => useUi((s) => s.mode);
