import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { addDays, DateKey, fromKey, toKey, todayKey } from '@/lib/dates';
import {
  abonoState, catalogCategory, chargeOn, Credit, CUSTOM_CATEGORY_COLOR, DEFAULT_PAYOUTS, DEFAULT_PLATFORMS, dueDates, FinanceCategory, FUEL_CATEGORY,
  GoalInput, isCustomCategory, MAX_CATEGORY_LENGTH, MAX_CREDIT_NAME_LENGTH, MAX_GOAL_NAME_LENGTH, MAX_HOURS, MAX_LITERS, MAX_NOTE_LENGTH,
  MAX_ODOMETER, MAX_PAYMENTS, MAX_PLATFORM_LENGTH, MAX_TRIPS, mergeCategories, nextOccurrence, OTHER_CATEGORY, Payouts, planProgress, PlatformEarning,
  Profile, Recurring, RecurringInput, savedAmount, SavingsGoal, SHIFT_CATEGORY, Transaction, TransactionInput, TxKind, withCatalogCategory,
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
  /** Qué día paga cada plataforma (las que no están, al momento). */
  payouts: Payouts;
  /** Tarjetas y créditos de tienda (sus compras a meses son fijos con `creditId`). */
  credits: Credit[];
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
  /** Día de la semana en que paga una plataforma (0 = lunes), o null = al momento. */
  setPayout: (platform: string, weekday: number | null) => void;
  /** Marca una jornada como cobrada ese día (null: vuelve a contar según su plataforma). */
  markShiftPaid: (id: string, date: DateKey | null) => void;
  /** Presupuesto mensual; null lo quita. */
  setBudget: (categoryId: string, amount: number | null) => void;
  /**
   * Crea un fijo que cuenta desde `startDate` (hoy, salvo un bimestral que empieza el mes que viene).
   * Si su categoría es del catálogo y falta (Suscripciones para un conductor), la añade.
   */
  addRecurring: (input: RecurringInput, today: DateKey, startDate?: DateKey) => string | null;
  updateRecurring: (id: string, input: Partial<RecurringInput & { startDate: DateKey }>) => void;
  /** Lo ya registrado se queda; solo deja de registrarse. */
  deleteRecurring: (id: string) => void;
  /** Paga de una vez lo que falta de un fijo con número de pagos (o de una deuda por abonos) y lo da por terminado. */
  settleRecurring: (id: string, today: DateKey) => void;
  /**
   * Lo deja de pagar desde `lastDate` (su último cobro): lo pagado se queda y los cobros que se
   * apuntaron solos después de esa fecha se quitan (no se hicieron).
   */
  endRecurring: (id: string, lastDate: DateKey) => void;
  /** Vuelve a pagarlo desde hoy (sin apuntar lo de mientras estuvo parado). */
  resumeRecurring: (id: string, today: DateKey) => void;
  /** Apunta un abono y da por cumplida la fecha que tocaba (o la próxima, si se adelantó). */
  addAbono: (id: string, amount: number, date: DateKey) => string | null;
  /** Da por pasada la fecha de abono más vieja sin apuntar nada ("este no lo pagué"). */
  skipAbono: (id: string, today: DateKey) => void;
  addCredit: (name: string, day: number) => string | null;
  /** Cambiar el día de pago cambia el de todas sus compras. */
  updateCredit: (id: string, input: Partial<Pick<Credit, 'name' | 'day'>>) => void;
  /** Quita el crédito y sus compras; lo ya pagado se queda. */
  deleteCredit: (id: string) => void;
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
  payouts: DEFAULT_PAYOUTS,
  credits: [],
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
  // Cobrada a mano: nunca antes del día de la jornada.
  const paidOn = input.shift?.paidOn ? (input.shift.paidOn < input.date ? input.date : input.shift.paidOn) : null;
  const shift = platforms.length ? { platforms, hours: optional(input.shift?.hours, MAX_HOURS), paidOn } : null;
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
  const count = input.count && input.count > 0 ? Math.min(Math.round(input.count), MAX_PAYMENTS) : null;
  return {
    kind: input.kind,
    name: input.name.trim().slice(0, MAX_NOTE_LENGTH),
    // En los abonos el importe es solo una sugerencia (0: sin sugerencia).
    amount: input.variable && !(input.amount > 0) ? 0 : clampMoney(input.amount),
    categoryId: category?.id ?? OTHER_CATEGORY[input.kind],
    frequency: input.frequency,
    day: Math.min(Math.max(min, Math.round(input.day)), max),
    count,
    // Un total se reparte en un número de pagos o, en los abonos, es lo que se debe.
    total: (count || input.variable) && input.total != null && input.total > 0 ? clampMoney(input.total) : null,
    creditId: input.creditId ?? null,
    variable: input.variable ?? false,
  };
}

/** Un fijo que empieza en el pasado (una deuda que ya se venía pagando) no apunta lo de antes. */
const yesterdayIfPast = (startDate: DateKey, today: DateKey) => (startDate < today ? toKey(addDays(fromKey(today), -1)) : null);

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

      setPayout: (platform, weekday) =>
        set((s) => {
          const { [platform]: _old, ...rest } = s.payouts;
          return { payouts: weekday == null ? rest : { ...rest, [platform]: Math.min(Math.max(0, Math.round(weekday)), 6) } };
        }),

      markShiftPaid: (id, date) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id && t.shift ? { ...t, shift: { ...t.shift, paidOn: date && date < t.date ? t.date : date } } : t),
        })),

      setBudget: (categoryId, amount) =>
        set((s) => {
          const { [categoryId]: _old, ...rest } = s.budgets;
          return { budgets: amount != null && amount > 0 ? { ...rest, [categoryId]: clampMoney(amount) } : rest };
        }),

      addRecurring: (input, today, startDate = today) => {
        if (!input.name.trim() || (!input.variable && !(input.amount > 0))) return null;
        const categories = withCatalogCategory(get().categories, input.categoryId);
        const r: Recurring = {
          ...normalizeRecurring(input, categories),
          id: randomUUID(),
          startDate,
          lastApplied: yesterdayIfPast(startDate, today),
          createdAt: new Date().toISOString(),
          endedOn: null,
          endKind: null,
        };
        set((s) => ({ categories, recurring: [...s.recurring, r] }));
        return r.id;
      },

      updateRecurring: (id, input) =>
        set((s) => {
          const categories = input.categoryId ? withCatalogCategory(s.categories, input.categoryId) : s.categories;
          return {
            categories,
            recurring: s.recurring.map((r) => {
              if (r.id !== id) return r;
              const next = normalizeRecurring({ ...r, ...input }, categories);
              const startDate = input.startDate ?? r.startDate;
              // Un nombre vacío no deja el fijo sin nombre: se conserva el anterior.
              return { ...r, ...next, name: next.name || r.name, startDate, lastApplied: r.lastApplied ?? yesterdayIfPast(startDate, todayKey()) };
            }),
          };
        }),

      deleteRecurring: (id) => set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) })),

      settleRecurring: (id, today) => {
        // Primero lo que ya tocaba (si hoy había pago, se apunta como siempre).
        get().applyRecurring(today);
        const r = get().recurring.find((x) => x.id === id);
        const owed = !r ? 0 : r.variable ? abonoState(r, get().transactions, today).owed ?? 0 : planProgress(r, today)?.owed ?? 0;
        if (!r || (!r.count && !(r.variable && r.total != null))) return;
        set((s) => ({
          recurring: s.recurring.map((x) => (x.id === id ? { ...x, endedOn: today, endKind: 'settled' as const, lastApplied: today } : x)),
          transactions: owed > 0
            ? [...s.transactions, {
                ...normalize({ kind: r.kind, amount: owed, categoryId: r.categoryId, date: today, note: `${r.name} (liquidación)`, shift: null, fuel: null }, s.categories),
                id: randomUUID(),
                recurringId: r.id,
                createdAt: new Date().toISOString(),
              }]
            : s.transactions,
        }));
      },

      endRecurring: (id, lastDate) =>
        set((s) => {
          const r = s.recurring.find((x) => x.id === id);
          if (!r) return {};
          return {
            recurring: s.recurring.map((x) => (x.id === id ? { ...x, endedOn: lastDate, endKind: 'cancelled' as const } : x)),
            // Los abonos los apuntó la persona: esos sí se pagaron. Lo que se apuntó solo después, no.
            transactions: r.variable ? s.transactions : s.transactions.filter((t) => !(t.recurringId === id && t.date > lastDate)),
          };
        }),

      resumeRecurring: (id, today) =>
        set((s) => {
          const yesterday = toKey(addDays(fromKey(today), -1));
          return {
            recurring: s.recurring.map((r) => (r.id === id
              ? { ...r, endedOn: null, endKind: null, lastApplied: r.lastApplied && r.lastApplied > yesterday ? r.lastApplied : yesterday }
              : r)),
          };
        }),

      addAbono: (id, amount, date) => {
        const r = get().recurring.find((x) => x.id === id);
        if (!r || !(amount > 0)) return null;
        const t: Transaction = {
          ...normalize({ kind: r.kind, amount, categoryId: r.categoryId, date, note: r.name, shift: null, fuel: null }, get().categories),
          id: randomUUID(),
          recurringId: r.id,
          createdAt: new Date().toISOString(),
        };
        set((s) => {
          const transactions = [...s.transactions, t];
          return {
            transactions,
            recurring: s.recurring.map((x) => {
              if (x.id !== id) return x;
              // Cubre la fecha más vieja que tocaba; si no había ninguna, la próxima (se adelantó).
              const overdue = dueDates(x, date);
              const next = overdue.length ? null : nextOccurrence({ ...x, lastApplied: null }, date);
              const lastApplied = overdue[0] ?? (x.lastApplied && x.lastApplied >= date ? x.lastApplied : next ?? x.lastApplied);
              const paidOff = x.total != null && abonoState({ ...x, lastApplied }, transactions, date).owed === 0;
              return paidOff ? { ...x, lastApplied, endedOn: date, endKind: 'settled' as const } : { ...x, lastApplied };
            }),
          };
        });
        return t.id;
      },

      skipAbono: (id, today) =>
        set((s) => ({
          recurring: s.recurring.map((r) => {
            const overdue = r.id === id ? dueDates(r, today) : [];
            return overdue.length ? { ...r, lastApplied: overdue[0] } : r;
          }),
        })),

      addCredit: (name, day) => {
        const trimmed = name.trim().slice(0, MAX_CREDIT_NAME_LENGTH);
        if (!trimmed) return null;
        const credit: Credit = { id: randomUUID(), name: trimmed, day: Math.min(Math.max(1, Math.round(day)), 31), createdAt: new Date().toISOString() };
        set((s) => ({ credits: [...s.credits, credit] }));
        return credit.id;
      },

      updateCredit: (id, input) =>
        set((s) => {
          const day = input.day != null ? Math.min(Math.max(1, Math.round(input.day)), 31) : undefined;
          return {
            credits: s.credits.map((c) => (c.id === id ? { ...c, name: input.name?.trim().slice(0, MAX_CREDIT_NAME_LENGTH) || c.name, day: day ?? c.day } : c)),
            recurring: day != null ? s.recurring.map((r) => (r.creditId === id ? { ...r, day } : r)) : s.recurring,
          };
        }),

      deleteCredit: (id) =>
        set((s) => ({
          credits: s.credits.filter((c) => c.id !== id),
          recurring: s.recurring.filter((r) => r.creditId !== id),
        })),

      applyRecurring: (today) => {
        const { recurring, categories } = get();
        const created: Transaction[] = [];
        let changed = false;
        const updated = recurring.map((r) => {
          // Los abonos no se apuntan solos: se pregunta cuánto se abonó.
          if (r.variable) return r;
          // Si el reloj va hacia atrás (cambio de zona), no se vuelve a registrar lo ya hecho.
          if (today < r.startDate || (r.lastApplied && r.lastApplied >= today)) return r;
          for (const date of dueDates(r, today)) {
            created.push({
              ...normalize(
                { kind: r.kind, amount: chargeOn(r, date), categoryId: r.categoryId, date, note: r.name, shift: null, fuel: null },
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
      version: 4,
      // En trozos: años de movimientos superan lo que Android lee de una sola entrada.
      storage: createJSONStorage(() => chunkedStorage()),
      partialize: ({ profiles, currency, categories, platforms, payouts, credits, transactions, recurring, budgets, goals }) => ({
        profiles, currency, categories, platforms, payouts, credits, transactions, recurring, budgets, goals,
      }),
      migrate: (persisted, version) => migrateFinance(persisted as Partial<FinanceData>, version),
      onRehydrateStorage: () => () => useFinance.setState({ hasHydrated: true }),
    },
  ),
);

/** Convierte datos guardados por versiones anteriores al formato actual. */
export function migrateFinance(persisted: Partial<FinanceData>, version: number): FinanceData {
  const state = { ...persisted };
  if (version < 2) {
    // v2: las categorías del catálogo toman los colores de la paleta de las gráficas.
    state.categories = (state.categories ?? []).map((c) => {
      const catalog = catalogCategory(c.id);
      return catalog ? { ...c, color: catalog.color, icon: catalog.icon } : c;
    });
  }
  if (version < 3 && state.profiles?.length) {
    // v3: los conductores también tienen Renta, Servicios y Suscripciones (pagan casa y Netflix).
    state.categories = mergeCategories(state.categories ?? [], state.profiles);
  }
  if (version < 4) {
    // v4: Uber paga los lunes (lo de las jornadas cuenta en el balance cuando llega) y hay créditos.
    state.payouts = state.payouts ?? DEFAULT_PAYOUTS;
    state.credits = state.credits ?? [];
  }
  return state as FinanceData;
}
