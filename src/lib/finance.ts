import type { IconName } from '@/theme';

import { addDays, DateKey, daysBetween, formatShortDate, fromKey, startOfWeek, toKey, weekdayIndex } from './dates';
import { roundMoney } from './money';

// ---------- Perfiles y categorías ----------

export type Profile = 'worker' | 'student' | 'driver';

export const PROFILES: { id: Profile; label: string; description: string; icon: IconName }[] = [
  { id: 'worker', label: 'Trabajador', description: 'Sueldo, gastos de la casa, presupuestos y pagos fijos.', icon: 'briefcase' },
  { id: 'student', label: 'Estudiante', description: 'Mesada o beca, gastos de la escuela y ahorro.', icon: 'school' },
  { id: 'driver', label: 'Conductor de app', description: 'Ganancia por plataforma, horas, viajes y gasolina.', icon: 'car' },
];

export type TxKind = 'income' | 'expense';

export type FinanceCategory = { id: string; name: string; icon: IconName; color: string; kind: TxKind };

/** Gasolina: sus gastos guardan litros y kilometraje. */
export const FUEL_CATEGORY = 'gasolina';
/** Viajes en apps: sus ingresos guardan plataforma, horas y viajes. */
export const SHIFT_CATEGORY = 'viajes';
/** Gastos del auto: se descuentan de lo que deja manejar. */
export const VEHICLE_CATEGORIES = ['gasolina', 'mantenimiento', 'lavado', 'casetas', 'seguro-auto', 'renta-auto'];
/** Adonde van los movimientos de una categoría propia que se borra (todos los perfiles las tienen). */
export const OTHER_CATEGORY: Record<TxKind, string> = { income: 'otros-ingresos', expense: 'otros-gastos' };

const CATALOG: FinanceCategory[] = [
  { id: 'sueldo', name: 'Sueldo', icon: 'briefcase', color: '#1F883D', kind: 'income' },
  { id: 'viajes', name: 'Viajes', icon: 'car', color: '#2EC4B6', kind: 'income' },
  { id: 'mesada', name: 'Mesada', icon: 'wallet', color: '#39D353', kind: 'income' },
  { id: 'beca', name: 'Beca', icon: 'school', color: '#3B82F6', kind: 'income' },
  { id: 'trabajos', name: 'Trabajos extra', icon: 'hammer', color: '#84CC16', kind: 'income' },
  { id: 'bonos', name: 'Bonos y extras', icon: 'gift', color: '#A855F7', kind: 'income' },
  { id: 'ventas', name: 'Ventas', icon: 'pricetag', color: '#F59E0B', kind: 'income' },
  { id: 'otros-ingresos', name: 'Otros ingresos', icon: 'add-circle', color: '#64748B', kind: 'income' },

  { id: 'comida', name: 'Comida', icon: 'restaurant', color: '#F97316', kind: 'expense' },
  { id: 'super', name: 'Súper', icon: 'cart', color: '#84CC16', kind: 'expense' },
  { id: 'transporte', name: 'Transporte', icon: 'bus', color: '#3B82F6', kind: 'expense' },
  { id: 'gasolina', name: 'Gasolina', icon: 'speedometer', color: '#EF4444', kind: 'expense' },
  { id: 'mantenimiento', name: 'Mantenimiento', icon: 'construct', color: '#64748B', kind: 'expense' },
  { id: 'lavado', name: 'Lavado', icon: 'water', color: '#2EC4B6', kind: 'expense' },
  { id: 'casetas', name: 'Casetas y estacionamiento', icon: 'ticket', color: '#EAB308', kind: 'expense' },
  { id: 'seguro-auto', name: 'Seguro del auto', icon: 'shield-checkmark', color: '#6366F1', kind: 'expense' },
  { id: 'renta-auto', name: 'Renta del auto', icon: 'key', color: '#A855F7', kind: 'expense' },
  { id: 'renta', name: 'Renta', icon: 'home', color: '#6366F1', kind: 'expense' },
  { id: 'servicios', name: 'Servicios', icon: 'flash', color: '#EAB308', kind: 'expense' },
  { id: 'escuela', name: 'Escuela', icon: 'school', color: '#3B82F6', kind: 'expense' },
  { id: 'celular', name: 'Celular', icon: 'phone-portrait', color: '#2EC4B6', kind: 'expense' },
  { id: 'salud', name: 'Salud', icon: 'medkit', color: '#EC4899', kind: 'expense' },
  { id: 'ocio', name: 'Ocio', icon: 'game-controller', color: '#A855F7', kind: 'expense' },
  { id: 'ropa', name: 'Ropa', icon: 'shirt', color: '#F59E0B', kind: 'expense' },
  { id: 'suscripciones', name: 'Suscripciones', icon: 'tv', color: '#EF4444', kind: 'expense' },
  { id: 'otros-gastos', name: 'Otros gastos', icon: 'ellipsis-horizontal', color: '#64748B', kind: 'expense' },
];

const PROFILE_CATEGORIES: Record<Profile, string[]> = {
  worker: [
    'sueldo', 'bonos', 'ventas', 'otros-ingresos',
    'comida', 'super', 'transporte', 'gasolina', 'renta', 'servicios', 'celular', 'salud', 'ocio', 'ropa', 'suscripciones', 'otros-gastos',
  ],
  student: [
    'mesada', 'beca', 'trabajos', 'otros-ingresos',
    'comida', 'transporte', 'escuela', 'celular', 'ocio', 'ropa', 'suscripciones', 'otros-gastos',
  ],
  driver: [
    'viajes', 'bonos', 'otros-ingresos',
    'gasolina', 'mantenimiento', 'lavado', 'casetas', 'seguro-auto', 'renta-auto', 'comida', 'celular', 'otros-gastos',
  ],
};

export const CUSTOM_CATEGORY_COLOR = '#64748B';
export const MAX_CATEGORY_LENGTH = 24;

/** Categorías de los perfiles elegidos, en el orden del catálogo. */
export function categoriesFor(profiles: Profile[]): FinanceCategory[] {
  const ids = new Set(profiles.flatMap((p) => PROFILE_CATEGORIES[p]));
  return CATALOG.filter((c) => ids.has(c.id));
}

/**
 * Añade las categorías de los perfiles que falten. No quita ninguna (pueden tener movimientos):
 * quien deja de manejar conserva "Gasolina" con su historial.
 */
export function mergeCategories(current: FinanceCategory[], profiles: Profile[]): FinanceCategory[] {
  const have = new Set(current.map((c) => c.id));
  const added = categoriesFor(profiles).filter((c) => !have.has(c.id));
  const order = (c: FinanceCategory) => {
    const i = CATALOG.findIndex((x) => x.id === c.id);
    return i < 0 ? CATALOG.length : i;
  };
  // Orden del catálogo; las propias, al final y en el orden en que se crearon (sort es estable).
  return [...current, ...added].sort((a, b) => order(a) - order(b));
}

export function isCustomCategory(id: string): boolean {
  return !CATALOG.some((c) => c.id === id);
}

export const DEFAULT_PLATFORMS = ['Uber', 'DiDi', 'inDrive'];
export const MAX_PLATFORM_LENGTH = 20;

// ---------- Movimientos ----------

export type ShiftInfo = {
  platform: string;
  /** Horas conectado (null si no se apuntaron). */
  hours: number | null;
  trips: number | null;
};

export type FuelInfo = {
  liters: number | null;
  /** Kilometraje del tablero al cargar. */
  odometer: number | null;
  /** Tanque lleno: entre dos cargas llenas se puede medir el rendimiento. */
  fullTank: boolean;
};

export type Transaction = {
  id: string;
  kind: TxKind;
  amount: number;
  categoryId: string;
  date: DateKey;
  note: string;
  shift: ShiftInfo | null;
  fuel: FuelInfo | null;
  /** Fijo que lo registró solo (null si se registró a mano). */
  recurringId: string | null;
  createdAt: string;
};

export type TransactionInput = Pick<Transaction, 'kind' | 'amount' | 'categoryId' | 'date' | 'note' | 'shift' | 'fuel'>;

export const MAX_NOTE_LENGTH = 60;
export const MAX_HOURS = 24;
export const MAX_TRIPS = 200;
export const MAX_LITERS = 1000;
export const MAX_ODOMETER = 9_999_999;

/** Más recientes primero; en el mismo día, el último registrado arriba. */
export function byNewest(a: Pick<Transaction, 'date' | 'createdAt'>, b: Pick<Transaction, 'date' | 'createdAt'>): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

// ---------- Periodos ----------

export type FinancePeriod = 'week' | 'month';
export type Range = { start: DateKey; end: DateKey };

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Semana (lunes a domingo) o mes natural; `offset` 0 = el actual, -1 = el anterior. */
export function periodRange(period: FinancePeriod, offset: number, today: DateKey): Range {
  const t = fromKey(today);
  if (period === 'week') {
    const start = addDays(startOfWeek(t), offset * 7);
    return { start: toKey(start), end: toKey(addDays(start, 6)) };
  }
  const start = new Date(t.getFullYear(), t.getMonth() + offset, 1);
  return { start: toKey(start), end: toKey(new Date(start.getFullYear(), start.getMonth() + 1, 0)) };
}

/** "Esta semana", "Semana pasada", "21 – 27 sep", "Octubre" o "Diciembre 2025". */
export function describePeriod(period: FinancePeriod, offset: number, today: DateKey): string {
  const range = periodRange(period, offset, today);
  if (period === 'month') {
    const d = fromKey(range.start);
    const name = MONTH_NAMES[d.getMonth()];
    return d.getFullYear() === fromKey(today).getFullYear() ? name : `${name} ${d.getFullYear()}`;
  }
  if (offset === 0) return 'Esta semana';
  if (offset === -1) return 'Semana pasada';
  const start = fromKey(range.start);
  const end = fromKey(range.end);
  const startText = start.getMonth() === end.getMonth() ? String(start.getDate()) : formatShortDate(range.start, today);
  return `${startText} – ${formatShortDate(range.end, today)}`;
}

export const PREVIOUS_PERIOD: Record<FinancePeriod, string> = { week: 'la semana anterior', month: 'el mes anterior' };

export function inRange(date: DateKey, range: Range): boolean {
  return date >= range.start && date <= range.end;
}

// ---------- Totales ----------

export type Totals = {
  income: number;
  expense: number;
  /** Apartado para metas de ahorro (descontando lo retirado). */
  saved: number;
  /** Lo que queda libre: ingresos − gastos − ahorro. */
  balance: number;
};

export function periodTotals(transactions: Transaction[], goals: SavingsGoal[], range: Range): Totals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (!inRange(t.date, range)) continue;
    if (t.kind === 'income') income += t.amount;
    else expense += t.amount;
  }
  let saved = 0;
  for (const g of goals) for (const d of g.deposits) if (inRange(d.date, range)) saved += d.amount;
  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    saved: roundMoney(saved),
    balance: roundMoney(income - expense - saved),
  };
}

export type CategoryTotal = { categoryId: string; amount: number; count: number };

/** Total por categoría de un tipo de movimiento, de mayor a menor. */
export function totalsByCategory(transactions: Transaction[], kind: TxKind, range: Range): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const t of transactions) {
    if (t.kind !== kind || !inRange(t.date, range)) continue;
    const entry = map.get(t.categoryId) ?? { categoryId: t.categoryId, amount: 0, count: 0 };
    entry.amount = roundMoney(entry.amount + t.amount);
    entry.count += 1;
    map.set(t.categoryId, entry);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

/** Lo gastado en una categoría en el mes natural de `date`. */
export function monthSpent(transactions: Transaction[], categoryId: string, date: DateKey, excludeId?: string): number {
  const month = date.slice(0, 7);
  let sum = 0;
  for (const t of transactions) {
    if (t.kind === 'expense' && t.categoryId === categoryId && t.date.startsWith(month) && t.id !== excludeId) sum += t.amount;
  }
  return roundMoney(sum);
}

// ---------- Presupuestos ----------

/** A partir de qué parte del presupuesto se avisa. */
export const BUDGET_WARNING = 0.8;

export type BudgetLevel = 'ok' | 'near' | 'over';

export function budgetLevel(spent: number, budget: number): BudgetLevel {
  if (spent > budget) return 'over';
  if (spent >= budget * BUDGET_WARNING) return 'near';
  return 'ok';
}

// ---------- Conductor ----------

export type PlatformStats = {
  platform: string;
  income: number;
  hours: number;
  trips: number;
  shifts: number;
  perHour: number | null;
  perTrip: number | null;
};

export type DriverStats = {
  platforms: PlatformStats[];
  income: number;
  hours: number;
  trips: number;
  /** Gasolina, mantenimiento, casetas… del periodo. */
  vehicleCosts: number;
  /** Lo que deja manejar: viajes − gastos del auto. */
  net: number;
  perHour: number | null;
  netPerHour: number | null;
  perTrip: number | null;
};

type Acc = { income: number; hours: number; incomeWithHours: number; trips: number; incomeWithTrips: number; shifts: number };

const emptyAcc = (): Acc => ({ income: 0, hours: 0, incomeWithHours: 0, trips: 0, incomeWithTrips: 0, shifts: 0 });

function addShift(acc: Acc, t: Transaction) {
  acc.income += t.amount;
  acc.shifts += 1;
  // Por hora y por viaje solo con las jornadas que los apuntaron (si no, saldría inflado).
  if (t.shift?.hours) {
    acc.hours += t.shift.hours;
    acc.incomeWithHours += t.amount;
  }
  if (t.shift?.trips) {
    acc.trips += t.shift.trips;
    acc.incomeWithTrips += t.amount;
  }
}

const rate = (amount: number, per: number) => (per > 0 ? roundMoney(amount / per) : null);

export function driverStats(transactions: Transaction[], range: Range): DriverStats {
  const total = emptyAcc();
  const byPlatform = new Map<string, Acc>();
  let vehicleCosts = 0;
  for (const t of transactions) {
    if (!inRange(t.date, range)) continue;
    if (t.kind === 'income' && t.shift) {
      addShift(total, t);
      const acc = byPlatform.get(t.shift.platform) ?? emptyAcc();
      addShift(acc, t);
      byPlatform.set(t.shift.platform, acc);
    } else if (t.kind === 'expense' && VEHICLE_CATEGORIES.includes(t.categoryId)) {
      vehicleCosts += t.amount;
    }
  }
  const platforms = [...byPlatform.entries()]
    .map(([platform, a]) => ({
      platform,
      income: roundMoney(a.income),
      hours: roundMoney(a.hours),
      trips: a.trips,
      shifts: a.shifts,
      perHour: rate(a.incomeWithHours, a.hours),
      perTrip: rate(a.incomeWithTrips, a.trips),
    }))
    .sort((a, b) => b.income - a.income);
  const perHour = rate(total.incomeWithHours, total.hours);
  return {
    platforms,
    income: roundMoney(total.income),
    hours: roundMoney(total.hours),
    trips: total.trips,
    vehicleCosts: roundMoney(vehicleCosts),
    net: roundMoney(total.income - vehicleCosts),
    perHour,
    netPerHour: perHour == null ? null : roundMoney((total.incomeWithHours - vehicleCosts) / total.hours),
    perTrip: rate(total.incomeWithTrips, total.trips),
  };
}

// ---------- Gasolina ----------

export type FuelStats = { spent: number; liters: number; fills: number; pricePerLiter: number | null };

export function fuelStats(transactions: Transaction[], range: Range): FuelStats {
  let spent = 0;
  let fills = 0;
  let liters = 0;
  let spentWithLiters = 0;
  for (const t of transactions) {
    if (!t.fuel || !inRange(t.date, range)) continue;
    spent += t.amount;
    fills += 1;
    if (t.fuel.liters) {
      liters += t.fuel.liters;
      spentWithLiters += t.amount;
    }
  }
  return { spent: roundMoney(spent), liters: roundMoney(liters), fills, pricePerLiter: rate(spentWithLiters, liters) };
}

const byDate = (a: Transaction, b: Transaction) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

export type Efficiency = { kmPerLiter: number; costPerKm: number; km: number; intervals: number };

/**
 * Rendimiento por el método del tanque lleno: entre dos cargas llenas con kilometraje, los km
 * recorridos entre los litros de las cargas posteriores a la primera (las parciales de en medio
 * cuentan). Usa los últimos `maxIntervals` tramos hasta `until`. Una carga sin litros, o una llena
 * sin kilometraje, corta la cuenta: ese tramo no se puede medir.
 */
export function fuelEfficiency(transactions: Transaction[], until?: DateKey, maxIntervals = 5): Efficiency | null {
  const fills = transactions.filter((t) => t.fuel && (!until || t.date <= until)).sort(byDate);
  const intervals: { km: number; liters: number; cost: number }[] = [];
  let start: number | null = null;
  let liters = 0;
  let cost = 0;
  for (const f of fills) {
    const fuel = f.fuel!;
    if (start != null) {
      if (fuel.liters == null) {
        start = null;
        continue;
      }
      liters += fuel.liters;
      cost += f.amount;
    }
    if (!fuel.fullTank) continue;
    if (fuel.odometer == null) {
      start = null;
      continue;
    }
    if (start != null && fuel.odometer > start && liters > 0) {
      const km = fuel.odometer - start;
      // Fuera de lo posible (un kilometraje mal escrito): ese tramo no cuenta.
      if (km / liters >= 1 && km / liters <= 100) intervals.push({ km, liters, cost });
    }
    start = fuel.odometer;
    liters = 0;
    cost = 0;
  }
  const last = intervals.slice(-maxIntervals);
  if (!last.length) return null;
  const km = last.reduce((s, i) => s + i.km, 0);
  const totalLiters = last.reduce((s, i) => s + i.liters, 0);
  const totalCost = last.reduce((s, i) => s + i.cost, 0);
  return {
    kmPerLiter: Math.round((km / totalLiters) * 10) / 10,
    costPerKm: roundMoney(totalCost / km),
    km,
    intervals: last.length,
  };
}

/** Último kilometraje apuntado en una carga hasta `date` (sin contar la que se está editando). */
export function lastOdometer(transactions: Transaction[], date: DateKey, excludeId?: string): number | null {
  const previous = transactions
    .filter((t) => t.fuel?.odometer != null && t.date <= date && t.id !== excludeId)
    .sort(byDate)
    .at(-1);
  return previous?.fuel?.odometer ?? null;
}

// ---------- Fijos ----------

export type Frequency = 'weekly' | 'biweekly' | 'monthly';

export type Recurring = {
  id: string;
  kind: TxKind;
  name: string;
  amount: number;
  categoryId: string;
  frequency: Frequency;
  /** Semanal: día de la semana (0 = lunes). Mensual: día del mes (1-31). Quincenal: no se usa (15 y fin de mes). */
  day: number;
  /** Desde cuándo cuenta: no se registra nada anterior. */
  startDate: DateKey;
  /** Última fecha que ya se registró (null si todavía ninguna). */
  lastApplied: DateKey | null;
  createdAt: string;
};

export type RecurringInput = Pick<Recurring, 'kind' | 'name' | 'amount' | 'categoryId' | 'frequency' | 'day'>;

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
];

const WEEKDAY_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const WEEKDAY_SINGULAR = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function occursOn(r: Pick<Recurring, 'frequency' | 'day'>, date: Date): boolean {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  switch (r.frequency) {
    case 'weekly':
      return weekdayIndex(date) === r.day;
    case 'biweekly':
      return date.getDate() === 15 || date.getDate() === lastDay;
    case 'monthly':
      // El 31 en un mes de 30 días (o febrero) toca el último día del mes.
      return date.getDate() === Math.min(r.day, lastDay);
  }
}

/** Como mucho se ponen al día dos años (si la app no se abrió en mucho tiempo). */
const MAX_CATCH_UP_DAYS = 731;

/** Fechas en que tocaba y aún no se registró, hasta `today` incluido. */
export function dueDates(r: Recurring, today: DateKey): DateKey[] {
  const end = fromKey(today);
  const first = r.lastApplied ? addDays(fromKey(r.lastApplied), 1) : fromKey(r.startDate);
  const from = daysBetween(first, end) > MAX_CATCH_UP_DAYS ? addDays(end, -MAX_CATCH_UP_DAYS) : first;
  const dates: DateKey[] = [];
  for (let d = from; d <= end; d = addDays(d, 1)) if (occursOn(r, d)) dates.push(toKey(d));
  return dates;
}

/** Próxima fecha en que se registrará (después de hoy). */
export function nextOccurrence(r: Pick<Recurring, 'frequency' | 'day' | 'startDate'>, today: DateKey): DateKey {
  const start = fromKey(r.startDate > today ? r.startDate : toKey(addDays(fromKey(today), 1)));
  let d = start;
  while (!occursOn(r, d)) d = addDays(d, 1);
  return toKey(d);
}

export function describeFrequency(r: Pick<Recurring, 'frequency' | 'day'>): string {
  switch (r.frequency) {
    case 'weekly':
      return `Cada semana, los ${WEEKDAY_PLURAL[r.day]}`;
    case 'biweekly':
      return 'Cada quincena (15 y fin de mes)';
    case 'monthly':
      return r.day >= 31 ? 'Cada mes, el último día' : `Cada mes, el día ${r.day}`;
  }
}

/** Versión corta para listas: "Cada lunes", "Cada quincena", "El día 6 de cada mes". */
export function describeFrequencyShort(r: Pick<Recurring, 'frequency' | 'day'>): string {
  switch (r.frequency) {
    case 'weekly':
      return `Cada ${WEEKDAY_SINGULAR[r.day]}`;
    case 'biweekly':
      return 'Cada quincena';
    case 'monthly':
      return r.day >= 31 ? 'Fin de cada mes' : `El ${r.day} de cada mes`;
  }
}

/** Lo que supone al mes (una semanal pesa 52/12 veces). */
export function monthlyEquivalent(r: Pick<Recurring, 'frequency' | 'amount'>): number {
  const times = r.frequency === 'weekly' ? 52 / 12 : r.frequency === 'biweekly' ? 2 : 1;
  return roundMoney(r.amount * times);
}

// ---------- Metas de ahorro ----------

/** Abono a una meta (negativo = retiro). */
export type Deposit = { id: string; date: DateKey; amount: number };

export type SavingsGoal = {
  id: string;
  name: string;
  icon: IconName;
  color: string;
  target: number;
  dueDate: DateKey | null;
  deposits: Deposit[];
  /** Día en que se alcanzó (null si aún no). */
  achievedOn: DateKey | null;
  createdAt: string;
};

export type GoalInput = Pick<SavingsGoal, 'name' | 'icon' | 'color' | 'target' | 'dueDate'>;

export const GOAL_ICONS: IconName[] = [
  'wallet', 'airplane', 'car', 'home', 'school', 'laptop',
  'phone-portrait', 'gift', 'medkit', 'shield-checkmark', 'game-controller', 'heart',
];

export const MAX_GOAL_NAME_LENGTH = 40;

export function savedAmount(goal: Pick<SavingsGoal, 'deposits'>): number {
  return roundMoney(goal.deposits.reduce((s, d) => s + d.amount, 0));
}

export type Pace = {
  remaining: number;
  /** Cuánto apartar por semana (si quedan menos de dos meses) o por mes para llegar a tiempo. */
  perWeek: number | null;
  perMonth: number | null;
  daysLeft: number | null;
  overdue: boolean;
};

const DAYS_PER_MONTH = 365.25 / 12;

/**
 * Cuánto apartar para llegar a tiempo, repartido en pagos redondos: meses de calendario
 * ("en 6 meses" son 6 pagos, no 5,98) o semanas si quedan menos de dos meses.
 */
export function savingsPace(goal: SavingsGoal, today: DateKey): Pace {
  const remaining = roundMoney(Math.max(0, goal.target - savedAmount(goal)));
  if (!goal.dueDate || remaining === 0) return { remaining, perWeek: null, perMonth: null, daysLeft: null, overdue: false };
  const start = fromKey(today);
  const due = fromKey(goal.dueDate);
  const daysLeft = daysBetween(start, due);
  if (daysLeft <= 0) return { remaining, perWeek: null, perMonth: null, daysLeft, overdue: daysLeft < 0 };
  // Si ya se abonó en esta semana o este mes, ese pago ya está hecho: el resto se reparte en los siguientes.
  const paidSince = (from: DateKey) => goal.deposits.some((d) => d.amount > 0 && d.date >= from && d.date <= today);
  if (daysLeft < 60) {
    const weeks = Math.round(daysLeft / 7) - (paidSince(toKey(startOfWeek(start))) ? 1 : 0);
    return { remaining, perWeek: Math.ceil(remaining / Math.max(1, weeks)), perMonth: null, daysLeft, overdue: false };
  }
  const months = (due.getFullYear() - start.getFullYear()) * 12 + due.getMonth() - start.getMonth()
    + (due.getDate() - start.getDate()) / DAYS_PER_MONTH;
  const payments = Math.round(months) - (paidSince(`${today.slice(0, 7)}-01`) ? 1 : 0);
  return { remaining, perWeek: null, perMonth: Math.ceil(remaining / Math.max(1, payments)), daysLeft, overdue: false };
}
