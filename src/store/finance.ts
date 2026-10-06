import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DateKey, todayKey } from '@/lib/dates';
import {
  CUSTOM_CATEGORY_COLOR, DEFAULT_PLATFORMS, dueDates, FinanceCategory, FUEL_CATEGORY, GoalInput, isCustomCategory,
  MAX_CATEGORY_LENGTH, MAX_GOAL_NAME_LENGTH, MAX_HOURS, MAX_LITERS, MAX_NOTE_LENGTH, MAX_ODOMETER, MAX_PLATFORM_LENGTH,
  MAX_TRIPS, mergeCategories, OTHER_CATEGORY, PlatformEarning, Profile, Recurring, RecurringInput, savedAmount, SavingsGoal, SHIFT_CATEGORY,
  Transaction, TransactionInput, TxKind,
} from '@/lib/finance';
import { CurrencyCode, DEFAULT_CURRENCY, MAX_MONEY, roundMoney } from '@/lib/money';
import { chunkedStorage } from '@/lib/storage';

type FinanceData = {
  /** Perfiles elegidos (vacío = aún no se configuró Finanzas). */
  profiles: Profile[];
  currency: CurrencyCode;
  categories: FinanceCategory[];
  /** Plataformas para las jornadas (Uber, DiDi…). */
  platforms: string[];
  transactions: Transaction[];
  recurring: Recurring[];
  /** Presupuesto mensual por categoría de gasto. */
  budgets: Record<string, number>;
  goals: SavingsGoal[];
};

type FinanceState = FinanceData & {
  hasHydrated: boolean;
  /** Elige los perfiles; añade sus categorías sin quitar las que ya había. */
  setProfiles: (profiles: Profile[]) => void;
  setCurrency: (currency: CurrencyCode) => void;
  /** Devuelve el id, o null si el importe no es válido. */
  addTransaction: (input: TransactionInput) => string | null;
  updateTransaction: (id: string, input: Partial<TransactionInput>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (name: string, kind: TxKind) => string | null;
  /** Solo las propias; sus movimientos pasan a "Otros". */
  deleteCategory: (id: string) => void;
  addPlatform: (name: string) => string | null;
  removePlatform: (name: string) => void;
  /** Presupuesto mensual; null lo quita. */
  setBudget: (categoryId: string, amount: number | null) => void;
  /** Crea un fijo que cuenta desde `startDate` (hoy, salvo un bimestral que empieza el mes que viene). */
  addRecurring: (input: RecurringInput, today: DateKey, startDate?: DateKey) => string | null;
  updateRecurring: (id: string, input: Partial<RecurringInput & { startDate: DateKey }>) => void;
  /** Lo ya registrado se queda; solo deja de registrarse. */
  deleteRecurring: (id: string) => void;
  /** Registra lo que tocaba de los fijos hasta `today`. Devuelve cuántos movimientos creó. */
  applyRecurring: (today: DateKey) => number;
  addGoal: (input: GoalInput) => string | null;
  updateGoal: (id: string, input: Partial<GoalInput>) => void;
  deleteGoal: (id: string) => void;
  /** Abona (o retira, con negativo; nunca más de lo ahorrado) a una meta. */
  addDeposit: (goalId: string, amount: number, date: DateKey) => void;
  /** Borra todos los datos de Finanzas y vuelve a la presentación. */
  resetFinance: () => void;
};

const INITIAL: FinanceData = {
  profiles: [],
  currency: DEFAULT_CURRENCY,
  categories: [],
  platforms: DEFAULT_PLATFORMS,
  transactions: [],
  recurring: [],
  budgets: {},
  goals: [],
};

const clampMoney = (n: number) => Math.min(Math.max(0.01, roundMoney(n)), MAX_MONEY);
const optional = (n: number | null | undefined, max: number, integer = false) => {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return Math.min(integer ? Math.round(n) : roundMoney(n), max);
};

/** Ajusta un movimiento: categoría válida para su tipo, y datos de jornada o carga solo donde aplican. */
function normalize(input: TransactionInput, categories: FinanceCategory[]): TransactionInput {
  const category = categories.find((c) => c.id === input.categoryId && c.kind === input.kind);
  const categoryId = category?.id ?? OTHER_CATEGORY[input.kind];
  // Una jornada: cada plataforma con lo suyo (sin repetir y sin importes vacíos) y las horas una vez.
  const platforms: PlatformEarning[] = [];
  for (const p of input.kind === 'income' && categoryId === SHIFT_CATEGORY ? input.shift?.platforms ?? [] : []) {
    const platform = p.platform.trim().slice(0, MAX_PLATFORM_LENGTH);
    if (!platform || !(p.amount > 0) || platforms.some((x) => x.platform.toLowerCase() === platform.toLowerCase())) continue;
    platforms.push({ platform, amount: clampMoney(p.amount), trips: optional(p.trips, MAX_TRIPS, true) });
  }
  const shift = platforms.length ? { platforms, hours: optional(input.shift?.hours, MAX_HOURS) } : null;
  const fuel = input.kind === 'expense' && categoryId === FUEL_CATEGORY
    ? {
        liters: optional(input.fuel?.liters, MAX_LITERS),
        odometer: optional(input.fuel?.odometer, MAX_ODOMETER, true),
        fullTank: input.fuel?.fullTank ?? true,
      }
    : null;
  return {
    kind: input.kind,
    // El importe de una jornada es la suma de sus plataformas.
    amount: shift ? clampMoney(platforms.reduce((s, p) => s + p.amount, 0)) : clampMoney(input.amount),
    categoryId,
    date: input.date,
    note: input.note.trim().slice(0, MAX_NOTE_LENGTH),
    shift,
    fuel,
  };
}

function normalizeRecurring(input: RecurringInput, categories: FinanceCategory[]): RecurringInput {
  const category = categories.find((c) => c.id === input.categoryId && c.kind === input.kind);
  const max = input.frequency === 'weekly' ? 6 : 31;
  const min = input.frequency === 'weekly' ? 0 : 1;
  return {
    kind: input.kind,
    name: input.name.trim().slice(0, MAX_NOTE_LENGTH),
    amount: clampMoney(input.amount),
    categoryId: category?.id ?? OTHER_CATEGORY[input.kind],
    frequency: input.frequency,
    day: Math.min(Math.max(min, Math.round(input.day)), max),
  };
}

/** Marca la meta como lograda (o deja de estarlo si se retira por debajo). */
function withAchievement(goal: SavingsGoal, date: DateKey): SavingsGoal {
  const reached = savedAmount(goal) >= goal.target;
  return { ...goal, achievedOn: reached ? goal.achievedOn ?? date : null };
}

export const useFinance = create<FinanceState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      hasHydrated: false,

      setProfiles: (profiles) =>
        set((s) => {
          const unique = [...new Set(profiles)];
          if (!unique.length) return {};
          return {
            profiles: unique,
            categories: mergeCategories(s.categories, unique),
            platforms: s.platforms.length ? s.platforms : DEFAULT_PLATFORMS,
          };
        }),

      setCurrency: (currency) => set({ currency }),

      addTransaction: (input) => {
        if (!(input.amount > 0)) return null;
        const t: Transaction = {
          ...normalize(input, get().categories),
          id: randomUUID(),
          recurringId: null,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ transactions: [...s.transactions, t] }));
        return t.id;
      },

      updateTransaction: (id, input) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...normalize({ ...t, ...input }, s.categories) } : t)),
        })),

      deleteTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      addCategory: (name, kind) => {
        const trimmed = name.trim().slice(0, MAX_CATEGORY_LENGTH);
        if (!trimmed) return null;
        const existing = get().categories.find((c) => c.kind === kind && c.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing.id;
        const category: FinanceCategory = {
          id: `custom-${randomUUID()}`, name: trimmed, icon: 'pricetag', color: CUSTOM_CATEGORY_COLOR, kind,
        };
        set((s) => ({ categories: [...s.categories, category] }));
        return category.id;
      },

      deleteCategory: (id) =>
        set((s) => {
          const category = s.categories.find((c) => c.id === id);
          if (!category || !isCustomCategory(id)) return {};
          const other = OTHER_CATEGORY[category.kind];
          const { [id]: _budget, ...budgets } = s.budgets;
          return {
            categories: s.categories.filter((c) => c.id !== id),
            transactions: s.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: other } : t)),
            recurring: s.recurring.map((r) => (r.categoryId === id ? { ...r, categoryId: other } : r)),
            budgets,
          };
        }),

      addPlatform: (name) => {
        const trimmed = name.trim().slice(0, MAX_PLATFORM_LENGTH);
        if (!trimmed) return null;
        const existing = get().platforms.find((p) => p.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing;
        set((s) => ({ platforms: [...s.platforms, trimmed] }));
        return trimmed;
      },

      removePlatform: (name) => set((s) => ({ platforms: s.platforms.filter((p) => p !== name) })),

      setBudget: (categoryId, amount) =>
        set((s) => {
          const { [categoryId]: _old, ...rest } = s.budgets;
          return { budgets: amount != null && amount > 0 ? { ...rest, [categoryId]: clampMoney(amount) } : rest };
        }),

      addRecurring: (input, today, startDate = today) => {
        if (!input.name.trim() || !(input.amount > 0)) return null;
        const r: Recurring = {
          ...normalizeRecurring(input, get().categories),
          id: randomUUID(),
          startDate: startDate > today ? startDate : today,
          lastApplied: null,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ recurring: [...s.recurring, r] }));
        return r.id;
      },

      updateRecurring: (id, input) =>
        set((s) => ({
          recurring: s.recurring.map((r) => {
            if (r.id !== id) return r;
            const next = normalizeRecurring({ ...r, ...input }, s.categories);
            // Un nombre vacío no deja el fijo sin nombre: se conserva el anterior.
            return { ...r, ...next, name: next.name || r.name, startDate: input.startDate ?? r.startDate };
          }),
        })),

      deleteRecurring: (id) => set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) })),

      applyRecurring: (today) => {
        const { recurring, categories } = get();
        const created: Transaction[] = [];
        let changed = false;
        const updated = recurring.map((r) => {
          // Si el reloj va hacia atrás (cambio de zona), no se vuelve a registrar lo ya hecho.
          if (today < r.startDate || (r.lastApplied && r.lastApplied >= today)) return r;
          for (const date of dueDates(r, today)) {
            created.push({
              ...normalize(
                { kind: r.kind, amount: r.amount, categoryId: r.categoryId, date, note: r.name, shift: null, fuel: null },
                categories,
              ),
              id: randomUUID(),
              recurringId: r.id,
              createdAt: new Date().toISOString(),
            });
          }
          changed = true;
          return { ...r, lastApplied: today };
        });
        if (changed) set((s) => ({ recurring: updated, transactions: [...s.transactions, ...created] }));
        return created.length;
      },

      addGoal: (input) => {
        const name = input.name.trim().slice(0, MAX_GOAL_NAME_LENGTH);
        if (!name || !(input.target > 0)) return null;
        const goal: SavingsGoal = {
          ...input,
          name,
          target: clampMoney(input.target),
          id: randomUUID(),
          deposits: [],
          achievedOn: null,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ goals: [...s.goals, goal] }));
        return goal.id;
      },

      updateGoal: (id, input) =>
        set((s) => ({
          goals: s.goals.map((g) => {
            if (g.id !== id) return g;
            const name = input.name?.trim().slice(0, MAX_GOAL_NAME_LENGTH) || g.name;
            const target = input.target != null && input.target > 0 ? clampMoney(input.target) : g.target;
            const next = { ...g, ...input, name, target };
            return withAchievement(next, todayKey());
          }),
        })),

      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addDeposit: (goalId, amount, date) =>
        set((s) => ({
          goals: s.goals.map((g) => {
            if (g.id !== goalId) return g;
            // No se puede retirar más de lo que hay.
            const value = roundMoney(Math.min(Math.max(amount, -savedAmount(g)), MAX_MONEY));
            if (value === 0) return g;
            return withAchievement({ ...g, deposits: [...g.deposits, { id: randomUUID(), date, amount: value }] }, date);
          }),
        })),

      resetFinance: () => set({ ...INITIAL }),
    }),
    {
      name: 'finance-store',
      version: 1,
      // En trozos: años de movimientos superan lo que Android lee de una sola entrada.
      storage: createJSONStorage(() => chunkedStorage()),
      partialize: ({ profiles, currency, categories, platforms, transactions, recurring, budgets, goals }) => ({
        profiles, currency, categories, platforms, transactions, recurring, budgets, goals,
      }),
      onRehydrateStorage: () => () => useFinance.setState({ hasHydrated: true }),
    },
  ),
);
