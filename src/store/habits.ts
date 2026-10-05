import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Category } from '@/lib/categories';
import { DateKey, todayKey, toKey } from '@/lib/dates';
import { ALL_DAYS, Completions, dailyTarget, Habit, HabitInput, MAX_AMOUNT, roundAmount, sortTimes } from '@/lib/habit';
import { MAX_OBJECTIVE_LENGTH, Objective, ObjectiveInput } from '@/lib/objectives';

export type { Habit, HabitInput } from '@/lib/habit';

type Settings = {
  /** Mostrar el heatmap en las tarjetas de la pantalla principal. */
  showHeatmaps: boolean;
  /** Ya se vio (o se descartó) el consejo de la vista compacta. */
  compactTipSeen: boolean;
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
  /** Suma (o resta, con `delta` negativo) una cantidad al día de un hábito cuantitativo. */
  addAmount: (id: string, day: DateKey, delta: number) => void;
  addCategory: (name: string) => string;
  /** Añade un objetivo al final; devuelve su id (o null si el título está vacío). */
  addObjective: (habitId: string, input: ObjectiveInput) => string | null;
  updateObjective: (habitId: string, objectiveId: string, input: Partial<ObjectiveInput>) => void;
  /** Marca un objetivo como logrado ese día, o pendiente con null. */
  setObjectiveAchieved: (habitId: string, objectiveId: string, day: DateKey | null) => void;
  deleteObjective: (habitId: string, objectiveId: string) => void;
  /** Sube (-1) o baja (+1) un objetivo en el orden. */
  moveObjective: (habitId: string, objectiveId: string, delta: -1 | 1) => void;
  updateSettings: (settings: Partial<Settings>) => void;
};

/** Máximo de veces en metas por veces (las cantidades llegan hasta MAX_AMOUNT). */
export const MAX_GOAL = 50;
export const MAX_UNIT_LENGTH = 12;

function normalize(input: HabitInput): HabitInput {
  const kind = input.kind === 'quit' ? 'quit' : 'build';
  const unit = input.unit?.trim().slice(0, MAX_UNIT_LENGTH) || null;
  // Al dejar un hábito el límite puede ser 0 (dejarlo del todo); al generarlo hace falta una meta.
  const min = kind === 'quit' ? 0 : unit ? 0.01 : 1;
  const count = unit
    ? Math.min(Math.max(min, roundAmount(input.goal.count)), MAX_AMOUNT)
    : Math.min(Math.max(min, Math.round(input.goal.count)), MAX_GOAL);
  return {
    ...input,
    name: input.name.trim(),
    kind,
    unit,
    goal: { period: input.goal.period, count },
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
      settings: { showHeatmaps: true, compactTipSeen: false },
      hasHydrated: false,

      addHabit: (input) => {
        const now = new Date().toISOString();
        const habit: Habit = {
          ...normalize(input), id: randomUUID(), objectives: [], archived: false, archivedAt: null, createdAt: now, updatedAt: now,
        };
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
          habits: s.habits.map((h) =>
            h.id === id ? { ...h, archived, archivedAt: archived ? todayKey() : null, updatedAt: new Date().toISOString() } : h,
          ),
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

      addAmount: (id, day, delta) => {
        const current = get().completions[id]?.[day] ?? 0;
        get().setCompletion(id, day, Math.min(Math.max(0, roundAmount(current + delta)), MAX_AMOUNT));
      },

      addCategory: (name) => {
        const trimmed = name.trim();
        const existing = get().customCategories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing.id;
        const category: Category = { id: `custom-${randomUUID()}`, name: trimmed, icon: 'pricetag' };
        set((s) => ({ customCategories: [...s.customCategories, category] }));
        return category.id;
      },

      addObjective: (habitId, input) => {
        const title = input.title.trim().slice(0, MAX_OBJECTIVE_LENGTH);
        if (!title) return null;
        const objective: Objective = { id: randomUUID(), title, dueDate: input.dueDate, achievedOn: null, createdAt: new Date().toISOString() };
        set((s) => ({ habits: withObjectives(s.habits, habitId, (os) => [...os, objective]) }));
        return objective.id;
      },

      updateObjective: (habitId, objectiveId, input) =>
        set((s) => ({
          habits: withObjectives(s.habits, habitId, (os) =>
            os.map((o) => {
              if (o.id !== objectiveId) return o;
              // Un título vacío no deja el objetivo sin nombre: se conserva el anterior.
              const title = input.title?.trim().slice(0, MAX_OBJECTIVE_LENGTH) || o.title;
              return { ...o, ...input, title };
            }),
          ),
        })),

      setObjectiveAchieved: (habitId, objectiveId, day) =>
        set((s) => ({
          habits: withObjectives(s.habits, habitId, (os) => os.map((o) => (o.id === objectiveId ? { ...o, achievedOn: day } : o))),
        })),

      deleteObjective: (habitId, objectiveId) =>
        set((s) => ({ habits: withObjectives(s.habits, habitId, (os) => os.filter((o) => o.id !== objectiveId)) })),

      moveObjective: (habitId, objectiveId, delta) =>
        set((s) => ({
          habits: withObjectives(s.habits, habitId, (os) => {
            const from = os.findIndex((o) => o.id === objectiveId);
            const to = from + delta;
            if (from < 0 || to < 0 || to >= os.length) return os;
            const next = [...os];
            [next[from], next[to]] = [next[to], next[from]];
            return next;
          }),
        })),

      updateSettings: (settings) => set((s) => ({ settings: { ...s.settings, ...settings } })),
    }),
    {
      // Clave de cuando la app se llamaba MyHabits; no cambiarla o se pierden los datos guardados.
      name: 'myhabits-store',
      version: 6,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ habits, completions, customCategories, settings }) => ({ habits, completions, customCategories, settings }),
      migrate: (persisted, version) => migrate(persisted as PersistedAny, version),
      onRehydrateStorage: () => () => useHabits.setState({ hasHydrated: true }),
    },
  ),
);

/** Aplica `fn` a la lista de objetivos de un hábito. */
function withObjectives(habits: Habit[], habitId: string, fn: (objectives: Objective[]) => Objective[]): Habit[] {
  return habits.map((h) => (h.id === habitId ? { ...h, objectives: fn(h.objectives), updatedAt: new Date().toISOString() } : h));
}

type PersistedAny = {
  habits?: Record<string, unknown>[];
  completions?: Record<string, Record<string, number | boolean>>;
  customCategories?: Category[];
  settings?: Partial<Settings>;
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
    state.settings = { showHeatmaps: true, compactTipSeen: false };
  }
  if (version < 3) {
    // v3: hábitos cuantitativos. Los anteriores se siguen contando por veces.
    state.habits = (state.habits ?? []).map((h) => ({ unit: null, ...h }));
  }
  if (version < 4) {
    // v4: hábitos para dejar. Todos los anteriores son para generar.
    state.habits = (state.habits ?? []).map((h) => ({ kind: 'build', ...h }));
  }
  if (version < 5) {
    // v5: objetivos por hábito.
    state.habits = (state.habits ?? []).map((h) => ({ objectives: [], ...h }));
  }
  if (version < 6) {
    // v6: fecha de archivo. Para los ya archivados, la última modificación es la mejor pista.
    state.habits = (state.habits ?? []).map((h) => ({
      archivedAt: h.archived && typeof h.updatedAt === 'string' ? toKey(new Date(h.updatedAt)) : null,
      ...h,
    }));
    state.settings = { showHeatmaps: true, ...state.settings, compactTipSeen: false };
  }
  return state as unknown as Pick<HabitsState, 'habits' | 'completions' | 'customCategories' | 'settings'>;
}
