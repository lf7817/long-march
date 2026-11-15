import { create } from 'zustand';
import type { Engine } from './engine/Engine';
import type { GameEvent } from './data';

export type FilterKey = 'all' | 'battle' | 'meeting' | 'terrain' | 'join';

export interface ShowFlags {
  enemies: boolean;
  fourth: boolean;
  second: boolean;
  labels: boolean;
  rivers: boolean;
  ghost: boolean;
}

export interface FxFlags {
  bloom: boolean;
  glow: number;
  particles: number;
  exposure: number;
  exag: number;
}

export interface AppState {
  ready: boolean;
  failed: string | null;
  introVisible: boolean;
  helpOpen: boolean;
  finaleOpen: boolean;
  chronicleOpen: boolean;
  cardOpen: boolean;
  mode: 'panorama' | 'battle';
  activeBattleId: string;
  battleDone: boolean;
  followArmy: string;
  currentStep: number;
  panoramaDay: number;
  day: number;
  playing: boolean;
  speed: number;
  autoPause: boolean;
  follow: boolean;
  sound: boolean;
  show: ShowFlags;
  fx: FxFlags;
  current: GameEvent | null;
  filter: FilterKey;
  engine: Engine | null;
  patch: (p: Partial<AppState>) => void;
  setShow: (k: keyof ShowFlags, v: boolean) => void;
  setFx: (k: keyof FxFlags, v: number | boolean) => void;
}

export const useApp = create<AppState>((set) => ({
  ready: false,
  failed: null,
  introVisible: true,
  helpOpen: false,
  finaleOpen: false,
  chronicleOpen: false,
  cardOpen: false,
  mode: 'panorama',
  activeBattleId: 'chishui',
  battleDone: false,
  followArmy: 'auto',
  currentStep: -1,
  panoramaDay: 0,
  day: 0,
  playing: false,
  speed: 10,
  autoPause: true,
  follow: false,
  sound: true,
  show: { enemies: true, fourth: true, second: true, labels: true, rivers: true, ghost: true },
  fx: { bloom: true, glow: 0.55, particles: 1, exposure: 1.05, exag: 1.2 },
  current: null,
  filter: 'all',
  engine: null,
  patch: (p) => set(p),
  setShow: (k, v) => set((s) => ({ show: { ...s.show, [k]: v } })),
  setFx: (k, v) => set((s) => ({ fx: { ...s.fx, [k]: v } as FxFlags })),
}));