import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Category } from '@/lib/categories';
import type { DateKey } from '@/lib/dates';
import { ALL_DAYS, Completions, dailyTarget, Habit, HabitInput, sortTimes } from '@/lib/habit';

export type { Habit, HabitInput } from '@/lib/habit';

type Settings = {
  /** Mostrar el heatmap en las tarjetas de la pantalla principal. */
  showHeatmaps: boolean;
};

type HabitsState = {
  habits: Habit[];
  completions: Completions;
  customCategories: Category[];
  settings: Settings;
  hasHydrated: boolean;
  addHabit: (input: HabitInput) => string;
  updateHabit: (id: string, input: Partial<HabitInput>) => void;
  setArchived: (id: string, archived: boolean) => void;
  deleteHabit: (id: string) => void;
  /** Suma una vez; al pasar la meta diaria vuelve a 0 (así un toque siempre hace algo). */
  cycleCompletion: (id: string, day: DateKey) => void;
  setCompletion: (id: string, day: DateKey, count: number) => void;
  addCategory: (name: string) => string;
  updateSettings: (settings: Partial<Settings>) => void;
};

export const MAX_GOAL = 50;

function normalize(input: HabitInput): HabitInput {
  return {
    ...input,
    name: input.name.trim(),
    goal: { period: input.goal.period, count: Math.min(Math.max(1, Math.round(input.goal.count)), MAX_GOAL) },
    days: input.days.length ? [...new Set(input.days)].sort() : ALL_DAYS,
    reminders: sortTimes(input.reminders),
  };
}

export const useHabits = create<HabitsState>()(
  persist(
    (set, get) => ({
      habits: [],
      completions: {},
      customCategories: [],
      settings: { showHeatmaps: true },
      hasHydrated: false,

      addHabit: (input) => {
        const now = new Date().toISOString();
        const habit: Habit = { ...normalize(input), id: randomUUID(), archived: false, createdAt: now, updatedAt: now };
        set((s) => ({ habits: [...s.habits, habit] }));
        return habit.id;
      },

      updateHabit: (id, input) =>
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id ? { ...h, ...normalize({ ...h, ...input }), updatedAt: new Date().toISOString() } : h,
          ),
        })),

      setArchived: (id, archived) =>
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, archived, updatedAt: new Date().toISOString() } : h)),
        })),

      deleteHabit: (id) =>
        set((s) => {
          const { [id]: _removed, ...completions } = s.completions;
          return { habits: s.habits.filter((h) => h.id !== id), completions };
        }),

      cycleCompletion: (id, day) => {
        const habit = get().habits.find((h) => h.id === id);
        if (!habit) return;
        const current = get().completions[id]?.[day] ?? 0;
        const target = dailyTarget(habit);
        // Metas semanales: cada toque alterna el día (hecho / no hecho).
        const next = habit.goal.period === 'week' ? (current > 0 ? 0 : 1) : current >= target ? 0 : current + 1;
        get().setCompletion(id, day, next);
      },

      setCompletion: (id, day, count) =>
        set((s) => {
          const { [day]: _old, ...rest } = s.completions[id] ?? {};
          const days = count > 0 ? { ...rest, [day]: count } : rest;
          return { completions: { ...s.completions, [id]: days } };
        }),

      addCategory: (name) => {
        const trimmed = name.trim();
        const existing = get().customCategories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing.id;
        const category: Category = { id: `custom-${randomUUID()}`, name: trimmed, icon: 'pricetag' };
        set((s) => ({ customCategories: [...s.customCategories, category] }));
        return category.id;
      },

      updateSettings: (settings) => set((s) => ({ settings: { ...s.settings, ...settings } })),
    }),
    {
      // Clave de cuando la app se llamaba MyHabits; no cambiarla o se pierden los datos guardados.
      name: 'myhabits-store',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ habits, completions, customCategories, settings }) => ({ habits, completions, customCategories, settings }),
      migrate: (persisted, version) => migrate(persisted as PersistedAny, version),
      onRehydrateStorage: () => () => useHabits.setState({ hasHydrated: true }),
    },
  ),
);

type PersistedAny = {
  habits?: Record<string, unknown>[];
  completions?: Record<string, Record<string, number | boolean>>;
  customCategories?: Category[];
  settings?: Settings;
};

/** Convierte datos guardados por versiones anteriores al formato actual. */
export function migrate(persisted: PersistedAny, version: number) {
  const state = { ...persisted };
  if (version < 2) {
    state.habits = (state.habits ?? []).map((h) => {
      const { description: _description, ...rest } = h;
      return {
        categories: [],
        timeOfDay: 'anytime',
        goal: { period: 'day', count: 1 },
        days: ALL_DAYS,
        reminders: [],
        archived: false,
        ...rest,
      };
    });
    state.completions = Object.fromEntries(
      Object.entries(state.completions ?? {}).map(([id, days]) => [
        id,
        Object.fromEntries(Object.entries(days).map(([k, v]) => [k, v === true ? 1 : Number(v)])),
      ]),
    );
    state.customCategories = [];
    state.settings = { showHeatmaps: true };
  }
  return state as unknown as Pick<HabitsState, 'habits' | 'completions' | 'customCategories' | 'settings'>;
}
