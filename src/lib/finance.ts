import type { IconName } from '@/theme';

import { addDays, DateKey, daysBetween, formatShortDate, fromKey, startOfWeek, toKey, weekdayIndex } from './dates';
import { CurrencyCode, parseMoney, roundMoney } from './money';

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
  { id: 'sueldo', name: 'Sueldo', icon: 'briefcase', color: '#008300', kind: 'income' },
  { id: 'viajes', name: 'Viajes', icon: 'car', color: '#1BAF7A', kind: 'income' },
  { id: 'mesada', name: 'Mesada', icon: 'wallet', color: '#2A78D6', kind: 'income' },
  { id: 'beca', name: 'Beca', icon: 'school', color: '#4A3AA7', kind: 'income' },
  { id: 'trabajos', name: 'Trabajos extra', icon: 'hammer', color: '#EB6834', kind: 'income' },
  { id: 'bonos', name: 'Bonos y extras', icon: 'gift', color: '#E87BA4', kind: 'income' },
  { id: 'ventas', name: 'Ventas', icon: 'pricetag', color: '#EDA100', kind: 'income' },
  { id: 'otros-ingresos', name: 'Otros ingresos', icon: 'add-circle', color: '#8A8F98', kind: 'income' },

  { id: 'comida', name: 'Comida', icon: 'restaurant', color: '#EB6834', kind: 'expense' },
  { id: 'super', name: 'Súper', icon: 'cart', color: '#008300', kind: 'expense' },
  { id: 'transporte', name: 'Transporte', icon: 'bus', color: '#2A78D6', kind: 'expense' },
  { id: 'gasolina', name: 'Gasolina', icon: 'speedometer', color: '#E34948', kind: 'expense' },
  { id: 'mantenimiento', name: 'Mantenimiento', icon: 'construct', color: '#4A3AA7', kind: 'expense' },
  { id: 'lavado', name: 'Lavado', icon: 'water', color: '#1BAF7A', kind: 'expense' },
  { id: 'casetas', name: 'Casetas y estacionamiento', icon: 'ticket', color: '#EDA100', kind: 'expense' },
  { id: 'seguro-auto', name: 'Seguro del auto', icon: 'shield-checkmark', color: '#E87BA4', kind: 'expense' },
  { id: 'renta-auto', name: 'Renta del auto', icon: 'key', color: '#2A78D6', kind: 'expense' },
  { id: 'renta', name: 'Renta', icon: 'home', color: '#4A3AA7', kind: 'expense' },
  { id: 'servicios', name: 'Servicios', icon: 'flash', color: '#EDA100', kind: 'expense' },
  { id: 'escuela', name: 'Escuela', icon: 'school', color: '#4A3AA7', kind: 'expense' },
  { id: 'celular', name: 'Celular', icon: 'phone-portrait', color: '#1BAF7A', kind: 'expense' },
  { id: 'salud', name: 'Salud', icon: 'medkit', color: '#E87BA4', kind: 'expense' },
  { id: 'ocio', name: 'Ocio', icon: 'game-controller', color: '#E34948', kind: 'expense' },
  { id: 'ropa', name: 'Ropa', icon: 'shirt', color: '#EDA100', kind: 'expense' },
  { id: 'suscripciones', name: 'Suscripciones', icon: 'tv', color: '#2A78D6', kind: 'expense' },
  { id: 'otros-gastos', name: 'Otros gastos', icon: 'ellipsis-horizontal', color: '#8A8F98', kind: 'expense' },
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
    'gasolina', 'mantenimiento', 'lavado', 'casetas', 'seguro-auto', 'renta-auto', 'comida', 'renta', 'servicios', 'celular',
    'suscripciones', 'otros-gastos',
  ],
};

export const CUSTOM_CATEGORY_COLOR = '#8A8F98';
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
  return sortByCatalog([...current, ...categoriesFor(profiles).filter((c) => !have.has(c.id))]);
}

/**
 * Añade una categoría del catálogo que falte (p. ej., "Suscripciones" al elegir Netflix siendo solo
 * conductor). Si ya está o no es del catálogo, devuelve las mismas.
 */
export function withCatalogCategory(current: FinanceCategory[], id: string): FinanceCategory[] {
  const catalog = catalogCategory(id);
  if (!catalog || current.some((c) => c.id === id)) return current;
  return sortByCatalog([...current, catalog]);
}

/** Orden del catálogo; las propias, al final y en el orden en que se crearon (sort es estable). */
function sortByCatalog(categories: FinanceCategory[]): FinanceCategory[] {
  const order = (c: FinanceCategory) => {
    const i = CATALOG.findIndex((x) => x.id === c.id);
    return i < 0 ? CATALOG.length : i;
  };
  return [...categories].sort((a, b) => order(a) - order(b));
}

/** Las más usadas en los últimos 90 días primero (a igual uso, en su orden de siempre). */
export function sortByUse(categories: FinanceCategory[], transactions: Transaction[], today: DateKey): FinanceCategory[] {
  const since = toKey(addDays(fromKey(today), -90));
  const uses = new Map<string, number>();
  for (const t of transactions) if (t.date >= since) uses.set(t.categoryId, (uses.get(t.categoryId) ?? 0) + 1);
  return [...categories].sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0));
}

/** Color e icono de siempre de una categoría del catálogo (null si es propia). */
export function catalogCategory(id: string): FinanceCategory | null {
  return CATALOG.find((c) => c.id === id) ?? null;
}

export function isCustomCategory(id: string): boolean {
  return !CATALOG.some((c) => c.id === id);
}

export const DEFAULT_PLATFORMS = ['Uber', 'DiDi', 'inDrive'];
export const MAX_PLATFORM_LENGTH = 20;

/**
 * Día de la semana en que paga cada plataforma lo de la semana anterior (0 = lunes). Las que no
 * están pagan al momento (efectivo, o lo que se cobra al terminar el viaje).
 */
export type Payouts = Record<string, number>;

/** Uber paga los lunes; las demás, al momento hasta que se diga otra cosa en Ajustes. */
export const DEFAULT_PAYOUTS: Payouts = { Uber: 0 };

// ---------- Movimientos ----------

/** Lo que dejó una plataforma en una jornada. */
export type PlatformEarning = { platform: string; amount: number; trips: number | null };

export type ShiftInfo = {
  /** Una o varias: muchos conductores tienen Uber y DiDi abiertas a la vez. */
  platforms: PlatformEarning[];
  /** Horas conectado en total, contadas una sola vez aunque hubiera varias apps (null si no se apuntaron). */
  hours: number | null;
  /** Día en que se marcó como cobrada antes de su día de pago (null o ausente: según la plataforma). */
  paidOn?: DateKey | null;
};

/** Viajes de la jornada (null si no se apuntó ninguno). */
export function shiftTrips(shift: ShiftInfo): number | null {
  const withTrips = shift.platforms.filter((p) => p.trips);
  return withTrips.length ? withTrips.reduce((s, p) => s + p.trips!, 0) : null;
}

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

// ---------- Lo que se escribe a mano ----------

/** La unidad que la gente escribe detrás del número: "45,230 km", "30 lts", "17 viajes". */
const UNIT_SUFFIX = /\s*(kms?|kil[oó]metros?|l|lts?|litros?|viajes?|h|hrs?|horas?)\.?$/i;

/** Número de un campo con unidad (litros, km, viajes). Con `integer` se redondea. */
export function parseQuantity(text: string, currency: CurrencyCode, integer = false): number | null {
  const n = parseMoney(text.trim().replace(UNIT_SUFFIX, ''), currency);
  return n == null ? null : integer ? Math.round(n) : n;
}

/** Horas como se escriben: "8", "8.5", "8,5", "8:30", "8h", "8 h 30", "8h30min", "45 min". */
export function parseHours(text: string, currency: CurrencyCode): number | null {
  const s = text.trim().toLowerCase();
  const clock = /^(\d{1,2})\s*(?::|h|hrs?|horas?)\s*(?:(\d{1,2})\s*(?:m|min|minutos?)?)?$/.exec(s);
  const minutesOnly = /^(\d{1,4})\s*(?:m|min|minutos?)$/.exec(s);
  let hours: number | null;
  if (clock) {
    const minutes = clock[2] ? Number(clock[2]) : 0;
    hours = minutes < 60 ? Number(clock[1]) + minutes / 60 : null;
  } else if (minutesOnly) {
    hours = Number(minutesOnly[1]) / 60;
  } else {
    hours = parseQuantity(s, currency);
  }
  return hours != null && hours > 0 ? Math.round(hours * 100) / 100 : null;
}

/** "8 h", "8 h 30 min", "45 min". */
export function formatHours(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Más recientes primero; en el mismo día, el último registrado arriba. */
export function byNewest(a: Pick<Transaction, 'date' | 'createdAt'>, b: Pick<Transaction, 'date' | 'createdAt'>): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

// ---------- Cuándo llega el dinero de las jornadas ----------

/** Cuándo llega lo de una jornada del día `date`: ese mismo día, o el siguiente `weekday` después de ella. */
export function payoutDate(date: DateKey, weekday: number | undefined): DateKey {
  if (weekday == null) return date;
  let d = addDays(fromKey(date), 1);
  while (weekdayIndex(d) !== weekday) d = addDays(d, 1);
  return toKey(d);
}

export type ShiftPayment = { platform: string; amount: number; date: DateKey };

/** Lo de cada plataforma de una jornada y el día en que llega (si se marcó como cobrada antes, ese día). */
export function shiftPayments(t: Transaction, payouts: Payouts): ShiftPayment[] {
  if (!t.shift) return [];
  const paidOn = t.shift.paidOn && t.shift.paidOn > t.date ? t.shift.paidOn : t.shift.paidOn ? t.date : null;
  return t.shift.platforms.map((p) => {
    const date = payoutDate(t.date, payouts[p.platform]);
    return { platform: p.platform, amount: p.amount, date: paidOn && paidOn < date ? paidOn : date };
  });
}

/**
 * Los movimientos como dinero que entra y sale, para el balance: lo de una jornada cuenta el día en
 * que llega cada plataforma, y lo que todavía no llega (después de `today`) no cuenta. Las
 * estadísticas de manejo siguen usando el día trabajado.
 */
export function cashFlow(transactions: Transaction[], payouts: Payouts, today: DateKey): Transaction[] {
  const out: Transaction[] = [];
  for (const t of transactions) {
    if (!t.shift) {
      out.push(t);
      continue;
    }
    for (const p of shiftPayments(t, payouts)) {
      if (p.date <= today) out.push({ ...t, id: `${t.id}:${p.platform}`, amount: p.amount, date: p.date, shift: null });
    }
  }
  return out;
}

export type PendingShift = {
  transaction: Transaction;
  /** Lo que falta por llegar de esa jornada. */
  amount: number;
  /** Cuándo llega (si son varias apps, la última). */
  date: DateKey;
  platforms: string[];
  /** Lo que falta de cada app y cuándo llega (pueden pagar en días distintos). */
  parts: ShiftPayment[];
};

/** Jornadas con dinero por cobrar, de la que llega antes a la que llega después. */
export function pendingShifts(transactions: Transaction[], payouts: Payouts, today: DateKey): PendingShift[] {
  const pending: PendingShift[] = [];
  for (const t of transactions) {
    const parts = shiftPayments(t, payouts).filter((p) => p.date > today);
    if (!parts.length) continue;
    pending.push({
      transaction: t,
      amount: roundMoney(parts.reduce((s, p) => s + p.amount, 0)),
      date: parts.reduce((max, p) => (p.date > max ? p.date : max), parts[0].date),
      platforms: parts.map((p) => p.platform),
      parts,
    });
  }
  return pending.sort((a, b) => a.date.localeCompare(b.date) || a.transaction.date.localeCompare(b.transaction.date));
}

/** "Llega el lunes 12" o, si cada app paga otro día, "Uber llega el lunes 12; DiDi, el martes 13". */
export function describeArrival(parts: ShiftPayment[]): string {
  if (new Set(parts.map((p) => p.date)).size <= 1) return `Llega el ${weekdayDate(parts[0].date)}`;
  return [...parts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p, i) => (i === 0 ? `${p.platform} llega el ${weekdayDate(p.date)}` : `${p.platform}, el ${weekdayDate(p.date)}`))
    .join('; ');
}

/** "lunes 12": el día de la semana con su número. */
export function weekdayDate(date: DateKey): string {
  const d = fromKey(date);
  return `${WEEKDAY_SINGULAR[weekdayIndex(d)]} ${d.getDate()}`;
}

/** "Al momento" o "Cada lunes". */
export function describePayout(weekday: number | undefined): string {
  return weekday == null ? 'Al momento' : `Cada ${WEEKDAY_SINGULAR[weekday]}`;
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

// ---------- Series para las gráficas ----------

/** Todos los días del periodo, en orden. */
export function rangeDays(range: Range): DateKey[] {
  const days: DateKey[] = [];
  for (let d = fromKey(range.start); toKey(d) <= range.end; d = addDays(d, 1)) days.push(toKey(d));
  return days;
}

export type DailyFlow = { date: DateKey; income: number; expense: number };

/** Ingresos y gastos de cada día del periodo (los días sin nada, en cero). */
export function dailyFlow(transactions: Transaction[], range: Range): DailyFlow[] {
  const byDay = new Map<DateKey, DailyFlow>(rangeDays(range).map((date) => [date, { date, income: 0, expense: 0 }]));
  for (const t of transactions) {
    const day = byDay.get(t.date);
    if (!day) continue;
    if (t.kind === 'income') day.income = roundMoney(day.income + t.amount);
    else day.expense = roundMoney(day.expense + t.amount);
  }
  return [...byDay.values()];
}

/**
 * Cómo va el balance (ingresos − gastos − ahorro) al cierre de cada día, desde el inicio del
 * periodo hasta hoy (o hasta su final, si ya pasó). Vacío si el periodo aún no empieza.
 */
export function balanceSeries(transactions: Transaction[], goals: SavingsGoal[], range: Range, today: DateKey): number[] {
  const end = today < range.end ? today : range.end;
  if (end < range.start) return [];
  const delta = new Map<DateKey, number>();
  const add = (date: DateKey, n: number) => delta.set(date, (delta.get(date) ?? 0) + n);
  for (const t of transactions) if (inRange(t.date, range)) add(t.date, t.kind === 'income' ? t.amount : -t.amount);
  for (const g of goals) for (const d of g.deposits) if (inRange(d.date, range)) add(d.date, -d.amount);
  let running = 0;
  return rangeDays({ start: range.start, end }).map((date) => {
    running += delta.get(date) ?? 0;
    return roundMoney(running);
  });
}

export type ShiftDay = { date: DateKey; byPlatform: Record<string, number> };

/** Lo que dejó cada app cada día del periodo. */
export function shiftDays(transactions: Transaction[], range: Range): ShiftDay[] {
  const byDay = new Map<DateKey, ShiftDay>(rangeDays(range).map((date) => [date, { date, byPlatform: {} }]));
  for (const t of transactions) {
    const day = t.kind === 'income' && t.shift ? byDay.get(t.date) : undefined;
    if (!day) continue;
    for (const p of t.shift!.platforms) day.byPlatform[p.platform] = roundMoney((day.byPlatform[p.platform] ?? 0) + p.amount);
  }
  return [...byDay.values()];
}

export type Slice = { categoryId: string | null; amount: number };

/** Las `max` categorías con más gasto y el resto junto en "Otros" (categoryId null), para la dona. */
export function topSlices(totals: CategoryTotal[], max = 4): Slice[] {
  const top: Slice[] = totals.slice(0, max).map((t) => ({ categoryId: t.categoryId, amount: t.amount }));
  const rest = roundMoney(totals.slice(max).reduce((s, t) => s + t.amount, 0));
  return rest > 0 ? [...top, { categoryId: null, amount: rest }] : top;
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

type Acc = {
  income: number;
  hours: number;
  incomeWithHours: number;
  trips: number;
  incomeWithTrips: number;
  shifts: number;
  /** Jornadas compartidas con otra app: sus horas no se pueden repartir. */
  shared: number;
};

const emptyAcc = (): Acc => ({ income: 0, hours: 0, incomeWithHours: 0, trips: 0, incomeWithTrips: 0, shifts: 0, shared: 0 });

function addTrips(acc: Acc, p: PlatformEarning) {
  if (!p.trips) return;
  acc.trips += p.trips;
  acc.incomeWithTrips += p.amount;
}

const rate = (amount: number, per: number) => (per > 0 ? roundMoney(amount / per) : null);

export function driverStats(transactions: Transaction[], range: Range): DriverStats {
  const total = emptyAcc();
  const byPlatform = new Map<string, Acc>();
  let vehicleCosts = 0;
  for (const t of transactions) {
    if (!inRange(t.date, range)) continue;
    if (t.kind === 'income' && t.shift) {
      const { platforms, hours } = t.shift;
      total.income += t.amount;
      total.shifts += 1;
      // Por hora y por viaje solo con las jornadas que los apuntaron (si no, saldría inflado).
      if (hours) {
        total.hours += hours;
        total.incomeWithHours += t.amount;
      }
      for (const p of platforms) {
        addTrips(total, p);
        const acc = byPlatform.get(p.platform) ?? emptyAcc();
        acc.income += p.amount;
        acc.shifts += 1;
        addTrips(acc, p);
        // Con varias apps a la vez las horas no se pueden repartir entre ellas.
        if (platforms.length > 1) acc.shared += 1;
        else if (hours) {
          acc.hours += hours;
          acc.incomeWithHours += p.amount;
        }
        byPlatform.set(p.platform, acc);
      }
    } else if (t.kind === 'expense' && VEHICLE_CATEGORIES.includes(t.categoryId)) {
      vehicleCosts += t.amount;
    }
  }
  const platforms = [...byPlatform.entries()]
    .map(([platform, a]) => ({
      platform,
      income: roundMoney(a.income),
      // Por hora y plataforma solo si siempre se usó sola: si no, "9 h" de Uber engañaría.
      hours: a.shared ? 0 : roundMoney(a.hours),
      trips: a.trips,
      shifts: a.shifts,
      perHour: a.shared ? null : rate(a.incomeWithHours, a.hours),
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

export type Efficiency = {
  kmPerLiter: number;
  costPerKm: number;
  km: number;
  intervals: number;
  /** Aproximado con cargas parciales (no hay dos llenas seguidas que medir). */
  estimated: boolean;
};

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
  if (!last.length) return estimateEfficiency(fills);
  const km = last.reduce((s, i) => s + i.km, 0);
  const totalLiters = last.reduce((s, i) => s + i.liters, 0);
  const totalCost = last.reduce((s, i) => s + i.cost, 0);
  return {
    kmPerLiter: Math.round((km / totalLiters) * 10) / 10,
    costPerKm: roundMoney(totalCost / km),
    km,
    intervals: last.length,
    estimated: false,
  };
}

/** Cargas y kilómetros mínimos para dar una aproximación con cargas parciales. */
const ESTIMATE_MIN_FILLS = 3;
const ESTIMATE_MIN_KM = 300;
const ESTIMATE_MAX_FILLS = 10;

/**
 * Aproximación para quien nunca llena el tanque ("póngale 300"): entre la primera y la última
 * de las últimas cargas con kilometraje, los km entre los litros cargados después de la primera.
 * El error es lo que cambie el nivel del tanque entre una y otra, que se diluye con más cargas.
 */
function estimateEfficiency(fills: Transaction[]): Efficiency | null {
  const recent = fills.slice(-ESTIMATE_MAX_FILLS);
  const firstIndex = recent.findIndex((f) => f.fuel?.odometer != null);
  const lastIndex = recent.findLastIndex((f) => f.fuel?.odometer != null);
  if (firstIndex < 0 || lastIndex - firstIndex < ESTIMATE_MIN_FILLS - 1) return null;
  const after = recent.slice(firstIndex + 1, lastIndex + 1);
  if (after.some((f) => f.fuel?.liters == null)) return null;
  const km = recent[lastIndex].fuel!.odometer! - recent[firstIndex].fuel!.odometer!;
  const liters = after.reduce((s, f) => s + f.fuel!.liters!, 0);
  const cost = after.reduce((s, f) => s + f.amount, 0);
  if (km < ESTIMATE_MIN_KM || !liters || km / liters < 1 || km / liters > 100) return null;
  return {
    kmPerLiter: Math.round((km / liters) * 10) / 10,
    costPerKm: roundMoney(cost / km),
    km,
    intervals: after.length,
    estimated: true,
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

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly';

export type Recurring = {
  id: string;
  kind: TxKind;
  name: string;
  amount: number;
  categoryId: string;
  frequency: Frequency;
  /**
   * Semanal: día de la semana (0 = lunes). Mensual y bimestral: día del mes (1-31).
   * Quincenal: no se usa (15 y fin de mes).
   */
  day: number;
  /** Desde cuándo cuenta: no se registra nada anterior. En los bimestrales, su mes marca los meses que tocan. */
  startDate: DateKey;
  /** Última fecha que ya se registró (null si todavía ninguna). */
  lastApplied: DateKey | null;
  createdAt: string;
  /** Cuántos pagos en total (null o ausente: sin fin, como Netflix). */
  count?: number | null;
  /** Total a repartir entre los pagos (el último ajusta los centavos); null: todos de `amount`. */
  total?: number | null;
  /** Crédito al que pertenece (una compra a meses). */
  creditId?: string | null;
  /** Último día en que puede tocar (se liquidó o se dejó de pagar): después ya no se apunta nada. */
  endedOn?: DateKey | null;
  /** Por qué terminó antes: se liquidó de una vez, o se dejó de pagar (como una suscripción cancelada). */
  endKind?: 'settled' | 'cancelled' | null;
  /**
   * Abonos: las fechas son fijas pero el importe varía, así que no se apunta solo; en su fecha se
   * pregunta cuánto se abonó. `amount` es lo sugerido (0: sin sugerencia) y `total`, lo que se debe.
   */
  variable?: boolean;
};

export type RecurringInput = Pick<Recurring, 'kind' | 'name' | 'amount' | 'categoryId' | 'frequency' | 'day'>
  & Partial<Pick<Recurring, 'count' | 'total' | 'creditId' | 'variable'>>;

/** Como mucho, 10 años de mensualidades. */
export const MAX_PAYMENTS = 120;

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'bimonthly', label: 'Bimestral' },
];

const WEEKDAY_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const WEEKDAY_SINGULAR = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function occursOn(r: Pick<Recurring, 'frequency' | 'day' | 'startDate'>, date: Date): boolean {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  switch (r.frequency) {
    case 'weekly':
      return weekdayIndex(date) === r.day;
    case 'biweekly':
      return date.getDate() === 15 || date.getDate() === lastDay;
    case 'monthly':
      // El 31 en un mes de 30 días (o febrero) toca el último día del mes.
      return date.getDate() === Math.min(r.day, lastDay);
    case 'bimonthly': {
      // Como la luz o la beca: un mes sí y otro no, contando desde el mes de inicio.
      const start = fromKey(r.startDate);
      const months = (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
      return months % 2 === 0 && date.getDate() === Math.min(r.day, lastDay);
    }
  }
}

/** Como mucho se ponen al día dos años (si la app no se abrió en mucho tiempo). */
const MAX_CATCH_UP_DAYS = 731;

type Schedule = Pick<Recurring, 'frequency' | 'day' | 'startDate'>
  & Partial<Pick<Recurring, 'count' | 'endedOn' | 'variable' | 'lastApplied'>>;

/** Las fechas de todos los pagos de un fijo con número de pagos (vacío si no tiene fin). */
export function planDates(r: Schedule): DateKey[] {
  const count = Math.min(r.count ?? 0, MAX_PAYMENTS);
  const dates: DateKey[] = [];
  for (let d = fromKey(r.startDate); dates.length < count; d = addDays(d, 1)) if (occursOn(r, d)) dates.push(toKey(d));
  return dates;
}

/** Hasta cuándo puede tocar: el último pago o el día en que se liquidó (null: sin fin). */
export function lastChargeDate(r: Schedule): DateKey | null {
  const last = r.count ? planDates(r).at(-1) ?? null : null;
  if (r.endedOn) return last && last < r.endedOn ? last : r.endedOn;
  return last;
}

/** Importe del pago número `index` (0 = el primero): todos iguales salvo el último si hay un total. */
export function paymentAmount(r: Pick<Recurring, 'amount' | 'count' | 'total'>, index: number): number {
  if (r.count && r.total != null && index === r.count - 1) return roundMoney(r.total - r.amount * (r.count - 1));
  return r.amount;
}

/** Fechas en que tocaba y aún no se registró, hasta `today` incluido. */
export function dueDates(r: Recurring, today: DateKey): DateKey[] {
  const lastCharge = lastChargeDate(r);
  const end = fromKey(lastCharge && lastCharge < today ? lastCharge : today);
  const first = r.lastApplied ? addDays(fromKey(r.lastApplied), 1) : fromKey(r.startDate);
  const from = daysBetween(first, end) > MAX_CATCH_UP_DAYS ? addDays(end, -MAX_CATCH_UP_DAYS) : first;
  const dates: DateKey[] = [];
  for (let d = from; d <= end; d = addDays(d, 1)) if (occursOn(r, d)) dates.push(toKey(d));
  return dates;
}

/**
 * Próxima fecha en que toca (después de hoy), o null si ya no le quedan pagos. En los abonos, si ya
 * se abonó por adelantado, la siguiente a esa.
 */
export function nextOccurrence(r: Schedule, today: DateKey): DateKey | null {
  const lastCharge = lastChargeDate(r);
  if (lastCharge && lastCharge <= today) return null;
  const after = r.variable && r.lastApplied && r.lastApplied > today ? r.lastApplied : today;
  let d = fromKey(r.startDate > after ? r.startDate : toKey(addDays(fromKey(after), 1)));
  while (!occursOn(r, d)) d = addDays(d, 1);
  const next = toKey(d);
  return lastCharge && next > lastCharge ? null : next;
}

export type PlanProgress = {
  /** Pagos en total, los que ya tocaron (hasta hoy) y los que faltan. */
  count: number;
  paid: number;
  remaining: number;
  /** Lo que falta por pagar. */
  owed: number;
  /** El último pago (o el día en que se liquidó). */
  lastDate: DateKey;
  /** Ya no le queda nada: pagó el último o lo liquidó. */
  finished: boolean;
};

/** Cómo va un fijo con número de pagos (null si no tiene fin o es de abonos). */
export function planProgress(r: Recurring, today: DateKey): PlanProgress | null {
  if (!r.count || r.variable) return null;
  const dates = planDates(r);
  const ended = r.endedOn != null && r.endedOn <= today;
  const left = ended ? [] : dates.map((date, i) => ({ date, i })).filter((x) => x.date > today);
  return {
    count: dates.length,
    paid: dates.length - left.length,
    remaining: left.length,
    owed: roundMoney(left.reduce((s, x) => s + paymentAmount(r, x.i), 0)),
    lastDate: lastChargeDate(r) ?? dates.at(-1)!,
    finished: left.length === 0,
  };
}

/** Ya no le toca nada: terminó su plan, se liquidó, se dejó de pagar o (abonos) se pagó todo. */
export function isEnded(r: Recurring, today: DateKey): boolean {
  return nextOccurrence(r, today) == null && (!r.variable || dueDates(r, today).length === 0);
}

/** Lo que se ha pagado de un fijo (lo que apuntó solo y los abonos): cuánto, cuántas veces y la última. */
export function paidTo(r: Recurring, transactions: Transaction[]): { amount: number; count: number; last: DateKey | null } {
  let amount = 0;
  let count = 0;
  let last: DateKey | null = null;
  for (const t of transactions) {
    if (t.recurringId !== r.id) continue;
    amount += t.amount;
    count += 1;
    if (!last || t.date > last) last = t.date;
  }
  return { amount: roundMoney(amount), count, last };
}

export type AbonoState = {
  /** Fechas en que tocaba abonar y aún no se abonó (hasta hoy). */
  overdue: DateKey[];
  /** La próxima fecha de abono, o null si ya terminó. */
  next: DateKey | null;
  paid: number;
  /** Lo que falta (si se debe un total). */
  owed: number | null;
  /** Lo sugerido para el próximo abono (lo que falta, si es menos), o null si no hay sugerencia. */
  suggested: number | null;
};

/** Cómo van unos abonos: los que tocaban y no se han hecho, el próximo, lo abonado y lo que falta. */
export function abonoState(r: Recurring, transactions: Transaction[], today: DateKey): AbonoState {
  const paid = paidTo(r, transactions).amount;
  const owed = r.total != null ? Math.max(0, roundMoney(r.total - paid)) : null;
  const suggested = r.amount > 0 ? (owed != null ? Math.min(r.amount, owed) : r.amount) : null;
  return { overdue: dueDates(r, today), next: nextOccurrence(r, today), paid, owed, suggested };
}

export function describeFrequency(r: Pick<Recurring, 'frequency' | 'day'>): string {
  switch (r.frequency) {
    case 'weekly':
      return `Cada semana, los ${WEEKDAY_PLURAL[r.day]}`;
    case 'biweekly':
      return 'Cada quincena (15 y fin de mes)';
    case 'monthly':
      return r.day >= 31 ? 'Cada mes, el último día' : `Cada mes, el día ${r.day}`;
    case 'bimonthly':
      return r.day >= 31 ? 'Cada dos meses, el último día' : `Cada dos meses, el día ${r.day}`;
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
    case 'bimonthly':
      return r.day >= 31 ? 'Fin de mes, cada 2 meses' : `El ${r.day}, cada 2 meses`;
  }
}

/** Lo que supone al mes (una semanal pesa 52/12 veces). */
export function monthlyEquivalent(r: Pick<Recurring, 'frequency' | 'amount'>): number {
  const times = { weekly: 52 / 12, biweekly: 2, monthly: 1, bimonthly: 1 / 2 }[r.frequency];
  return roundMoney(r.amount * times);
}

/** Lo que supone en un año (52 semanas, 24 quincenas, 12 meses o 6 bimestres). */
export function yearlyEquivalent(r: Pick<Recurring, 'frequency' | 'amount'>): number {
  const times = { weekly: 52, biweekly: 24, monthly: 12, bimonthly: 6 }[r.frequency];
  return roundMoney(r.amount * times);
}

/** Cuándo toca, en corto: "mañana", "en 3 días" o "el 20 oct". */
export function describeWhen(date: DateKey, today: DateKey): string {
  const days = daysBetween(fromKey(today), fromKey(date));
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days > 1 && days < 7) return `en ${days} días`;
  return `el ${formatShortDate(date, today)}`;
}

/** Los fijos que aún tienen cobros, en el orden en que tocan (a igual fecha, por nombre). */
export function byNextCharge(recurring: Recurring[], today: DateKey): { recurring: Recurring; date: DateKey }[] {
  return recurring
    .map((r) => ({ recurring: r, date: nextOccurrence(r, today) }))
    .filter((x): x is { recurring: Recurring; date: DateKey } => x.date != null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.recurring.name.localeCompare(b.recurring.name));
}

/** El importe del cobro de un fijo en `date` (el último de un plan puede ajustar centavos). */
export function chargeOn(r: Recurring, date: DateKey): number {
  return r.count ? paymentAmount(r, planDates(r).indexOf(date)) : r.amount;
}

export type FixedSummary = {
  /** Lo que suman los cobros de los gastos fijos en el mes de `today`. */
  month: number;
  /** De eso, lo que ya tocó (hasta hoy incluido) y lo que falta. */
  paid: number;
  pending: number;
  /** Lo normal al mes y al año, con todos los gastos fijos. */
  perMonth: number;
  perYear: number;
  /** Lo que se va en suscripciones (Netflix, Spotify…) al mes. */
  subscriptions: number;
};

/**
 * Cuánto se llevan los gastos fijos este mes, y al mes y al año en general. Los abonos cuentan lo
 * abonado este mes y, lo que falta, por lo sugerido.
 */
export function fixedSummary(recurring: Recurring[], today: DateKey, transactions: Transaction[] = []): FixedSummary {
  const all = recurring.filter((r) => r.kind === 'expense');
  // Los que ya terminaron no cuentan para lo de cada mes.
  const expenses = all.filter((r) => !isEnded(r, today));
  const range = periodRange('month', 0, today);
  const days = rangeDays(range);
  let paid = 0;
  let pending = 0;
  for (const r of all.filter((x) => x.variable)) {
    for (const t of transactions) if (t.recurringId === r.id && inRange(t.date, range) && t.date <= today) paid += t.amount;
    const state = abonoState(r, transactions, today);
    const toCome = [...state.overdue, ...days.filter((d) => d > today && d <= (lastChargeDate(r) ?? d) && d >= r.startDate && occursOn(r, fromKey(d)))];
    pending += Math.min((state.suggested ?? 0) * toCome.length, state.owed ?? Infinity);
  }
  for (const r of all.filter((x) => !x.variable)) {
    const lastCharge = lastChargeDate(r);
    // Solo desde que existe: un fijo creado el 10 para el día 1 empieza a contar el mes que viene.
    for (const day of days) {
      if (day < r.startDate || (lastCharge && day > lastCharge) || !occursOn(r, fromKey(day))) continue;
      if (day <= today) paid += chargeOn(r, day);
      else pending += chargeOn(r, day);
    }
  }
  const sum = (list: Recurring[], f: (r: Recurring) => number) => roundMoney(list.reduce((s, r) => s + f(r), 0));
  return {
    month: roundMoney(paid + pending),
    paid: roundMoney(paid),
    pending: roundMoney(pending),
    perMonth: sum(expenses, monthlyEquivalent),
    // Un plan que termina antes (o una deuda por abonos) cuenta solo lo que le falta.
    perYear: sum(expenses, (r) => Math.min(
      yearlyEquivalent(r),
      planProgress(r, today)?.owed ?? (r.variable ? abonoState(r, transactions, today).owed : null) ?? Infinity,
    )),
    subscriptions: sum(expenses.filter((r) => r.categoryId === SUBSCRIPTIONS_CATEGORY), monthlyEquivalent),
  };
}

// ---------- Lo que viene ----------

export type MonthCommitment = {
  /** "2026-11" */
  key: string;
  /** "nov" */
  label: string;
  /** Fijos sin fin (renta, Netflix…) y deudas (mensualidades, compras a meses, abonos). */
  fixed: number;
  debts: number;
};

export type Outlook = {
  /** Último día del mes en curso. */
  monthEnd: DateKey;
  /** Balance del mes hasta hoy (con el dinero que ya llegó). */
  balance: number;
  /** Lo que aún entra este mes: ingresos fijos y jornadas por cobrar que llegan antes de que acabe. */
  incoming: number;
  /** Lo que aún sale este mes: fijos, mensualidades y abonos (los atrasados también). */
  outgoing: number;
  /** Lo que se suele gastar al día fuera de los fijos, y los días que faltan del mes. */
  dailySpend: number;
  daysLeft: number;
  /** Cómo cierra el mes si todo sigue igual. */
  projected: number;
  /** Lo que se debe (planes, compras a meses y abonos con total) y cuándo termina lo que tiene fecha. */
  debt: number;
  debtEnds: DateKey | null;
  /** Lo que piden los fijos y las deudas este mes y los 5 siguientes. */
  months: MonthCommitment[];
  /** Lo que entra al mes en promedio (los últimos 3 meses completos con ingresos), o null si aún no hay. */
  avgIncome: number | null;
  /** Lo que se llevan cada mes los fijos y las deudas que siguen activos. */
  committed: number;
};

/** Las fechas de cobro de un fijo entre unos días (en abonos, solo las que aún no se abonan). */
function chargeDates(r: Recurring, days: DateKey[]): DateKey[] {
  const lastCharge = lastChargeDate(r);
  return days.filter((d) => d >= r.startDate && (!lastCharge || d <= lastCharge) && (!r.variable || d > (r.lastApplied ?? ''))
    && occursOn(r, fromKey(d)));
}

/** Lo que piden unos cobros: el importe de cada uno, o en abonos lo sugerido (sin pasar de `cap`). */
function chargesIn(r: Recurring, dates: DateKey[], suggested: number | null, cap: number | null): number {
  if (!r.variable) return dates.reduce((s, d) => s + chargeOn(r, d), 0);
  return Math.min((suggested ?? 0) * dates.length, cap ?? Infinity);
}

/**
 * El panorama del mes y de los que vienen: cómo cierra el mes si todo sigue igual (lo que ya hay, lo
 * que falta por entrar y salir, y lo que se gasta al día), lo que se debe y cuánto piden los fijos y
 * las deudas los próximos meses. `cash` son los movimientos como dinero que llega (ver cashFlow).
 */
export function outlook(input: {
  cash: Transaction[];
  transactions: Transaction[];
  recurring: Recurring[];
  goals: SavingsGoal[];
  pending: PendingShift[];
  today: DateKey;
}): Outlook {
  const { cash, transactions, recurring, goals, pending, today } = input;
  const month = periodRange('month', 0, today);
  const rest = rangeDays({ start: toKey(addDays(fromKey(today), 1)), end: month.end }).filter((d) => d <= month.end);
  const active = recurring.filter((r) => !isEnded(r, today));
  const expenses = active.filter((r) => r.kind === 'expense');

  const abonos = new Map(active.filter((r) => r.variable).map((r) => [r.id, abonoState(r, transactions, today)]));
  const incoming = active
    .filter((r) => r.kind === 'income' && !r.variable)
    .reduce((s, r) => s + chargesIn(r, chargeDates(r, rest), null, null), 0)
    + pending.filter((p) => p.date <= month.end).reduce((s, p) => s + p.amount, 0);
  // Los abonos atrasados también se deben este mes.
  const outgoing = expenses.reduce((s, r) => {
    const state = abonos.get(r.id);
    const dates = [...(state?.overdue ?? []), ...chargeDates(r, rest)];
    return s + chargesIn(r, dates, state?.suggested ?? null, state?.owed ?? null);
  }, 0);

  // Gasto del día a día: lo que no es fijo, en los últimos 30 días (o desde que se empezó a apuntar).
  const since = toKey(addDays(fromKey(today), -29));
  const daily = transactions.filter((t) => t.kind === 'expense' && !t.recurringId && t.date >= since && t.date <= today);
  const first = transactions.reduce<DateKey | null>((min, t) => (min == null || t.date < min ? t.date : min), null);
  const span = first ? Math.min(30, Math.max(7, daysBetween(fromKey(first), fromKey(today)) + 1)) : 30;
  const dailySpend = roundMoney(daily.reduce((s, t) => s + t.amount, 0) / span);

  const balance = periodTotals(cash, goals, month).balance;
  const projected = roundMoney(balance + incoming - outgoing - dailySpend * rest.length);

  const debtOf = (r: Recurring) => planProgress(r, today)?.owed ?? abonos.get(r.id)?.owed ?? 0;
  const isDebt = (r: Recurring) => r.count != null || r.creditId != null || (r.variable === true && r.total != null);
  const debts = expenses.filter(isDebt);
  const debtEnds = debts.reduce<DateKey | null>((max, r) => {
    const last = planProgress(r, today)?.lastDate ?? null;
    return last && (max == null || last > max) ? last : max;
  }, null);

  // Mes a mes; lo que se debe por abonos se va acabando (no se cuenta dos veces).
  const t = fromKey(today);
  const left = new Map([...abonos].map(([id, state]) => [id, state.owed]));
  const months = Array.from({ length: 6 }, (_, i): MonthCommitment => {
    const start = new Date(t.getFullYear(), t.getMonth() + i, 1);
    const days = rangeDays({ start: toKey(start), end: toKey(new Date(start.getFullYear(), start.getMonth() + 1, 0)) });
    const sum = (list: Recurring[]) => roundMoney(list.reduce((s, r) => {
      const cap = left.get(r.id) ?? null;
      const amount = chargesIn(r, chargeDates(r, days), abonos.get(r.id)?.suggested ?? null, cap);
      if (cap != null) left.set(r.id, roundMoney(cap - amount));
      return s + amount;
    }, 0));
    return {
      key: toKey(start).slice(0, 7),
      label: start.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
      fixed: sum(expenses.filter((r) => !isDebt(r))),
      debts: sum(debts),
    };
  });

  // Lo que entra al mes: el promedio de los últimos 3 meses completos que tuvieron ingresos.
  const incomes = [1, 2, 3]
    .map((back) => periodTotals(cash, [], periodRange('month', -back, today)).income)
    .filter((n) => n > 0);

  return {
    monthEnd: month.end,
    balance,
    incoming: roundMoney(incoming),
    outgoing: roundMoney(outgoing),
    dailySpend,
    daysLeft: rest.length,
    projected,
    debt: roundMoney(debts.reduce((s, r) => s + debtOf(r), 0)),
    debtEnds,
    months,
    avgIncome: incomes.length ? roundMoney(incomes.reduce((s, n) => s + n, 0) / incomes.length) : null,
    committed: fixedSummary(recurring, today, transactions).perMonth,
  };
}

// ---------- Créditos ----------

/** Una tarjeta o un crédito de tienda: sus compras a meses se pagan el mismo día de cada mes. */
export type Credit = { id: string; name: string; day: number; createdAt: string };

export const MAX_CREDIT_NAME_LENGTH = 30;

/**
 * Las próximas fechas de pago de un crédito (desde mañana: lo que se compra hoy no se paga hoy),
 * para elegir el primer pago de una compra.
 */
export function creditDueDates(day: number, today: DateKey, count = 2): DateKey[] {
  const r = { frequency: 'monthly' as const, day, startDate: today };
  const dates: DateKey[] = [];
  for (let d = addDays(fromKey(today), 1); dates.length < count; d = addDays(d, 1)) if (occursOn(r, d)) dates.push(toKey(d));
  return dates;
}

/** El primer pago de una compra en la que ya se llevan `paid` pagos: tantos meses antes del próximo. */
export function startForPaid(day: number, today: DateKey, paid: number): DateKey {
  const next = fromKey(creditDueDates(day, today, 1)[0]);
  const month = new Date(next.getFullYear(), next.getMonth() - paid, 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return toKey(new Date(month.getFullYear(), month.getMonth(), Math.min(day, last)));
}

export type CreditSummary = {
  /** El próximo pago y cuánto es (la suma de las compras que tocan ese día). */
  next: DateKey | null;
  nextAmount: number;
  /** Lo que falta por pagar de todas sus compras. */
  owed: number;
  /** Cuándo se termina de pagar todo. */
  lastDate: DateKey | null;
  /** Compras que aún se pagan, y las ya liquidadas. */
  active: Recurring[];
  finished: Recurring[];
};

export function creditSummary(creditId: string, recurring: Recurring[], today: DateKey): CreditSummary {
  const purchases = recurring.filter((r) => r.creditId === creditId);
  const progress = new Map(purchases.map((r) => [r.id, planProgress(r, today)]));
  const active = purchases.filter((r) => !progress.get(r.id)?.finished);
  const nexts = active.map((r) => ({ r, date: nextOccurrence(r, today) })).filter((x) => x.date != null);
  const next = nexts.reduce<DateKey | null>((min, x) => (min == null || x.date! < min ? x.date! : min), null);
  return {
    next,
    nextAmount: roundMoney(nexts.filter((x) => x.date === next).reduce((s, x) => s + chargeOn(x.r, x.date!), 0)),
    owed: roundMoney(active.reduce((s, r) => s + (progress.get(r.id)?.owed ?? 0), 0)),
    lastDate: active.reduce<DateKey | null>((max, r) => {
      const last = progress.get(r.id)?.lastDate ?? null;
      return last && (max == null || last > max) ? last : max;
    }, null),
    active,
    finished: purchases.filter((r) => progress.get(r.id)?.finished),
  };
}

// ---------- Servicios conocidos ----------

export const SUBSCRIPTIONS_CATEGORY = 'suscripciones';

/** Un servicio de pago que se reconoce por su nombre para mostrarlo con su inicial y su color. */
export type KnownService = {
  name: string;
  /** Lo que va en su insignia (una o dos letras). */
  mono: string;
  color: string;
  categoryId: string;
  /** Cómo se reconoce: el nombre normalizado empieza así ("=" delante: tiene que ser exacto). */
  keys: string[];
};

export const KNOWN_SERVICES: KnownService[] = [
  { name: 'Netflix', mono: 'N', color: '#E50914', categoryId: 'suscripciones', keys: ['netflix'] },
  { name: 'HBO Max', mono: 'H', color: '#5B2BE0', categoryId: 'suscripciones', keys: ['hbo', '=max'] },
  { name: 'Disney+', mono: 'D+', color: '#113CCF', categoryId: 'suscripciones', keys: ['disney'] },
  { name: 'Prime Video', mono: 'P', color: '#00A8E1', categoryId: 'suscripciones', keys: ['primevideo', 'amazonprime', '=prime'] },
  { name: 'Spotify', mono: 'S', color: '#1DB954', categoryId: 'suscripciones', keys: ['spotify'] },
  { name: 'YouTube Premium', mono: 'YT', color: '#FF0033', categoryId: 'suscripciones', keys: ['youtube'] },
  { name: 'Apple TV+', mono: 'tv', color: '#6E6E73', categoryId: 'suscripciones', keys: ['appletv'] },
  { name: 'Paramount+', mono: 'P+', color: '#0064FF', categoryId: 'suscripciones', keys: ['paramount'] },
  { name: 'ViX', mono: 'V', color: '#FF5A00', categoryId: 'suscripciones', keys: ['vix'] },
  { name: 'Crunchyroll', mono: 'C', color: '#F47521', categoryId: 'suscripciones', keys: ['crunchyroll'] },
  { name: 'iCloud+', mono: 'iC', color: '#3693F3', categoryId: 'suscripciones', keys: ['icloud'] },
  { name: 'Google One', mono: 'G', color: '#4285F4', categoryId: 'suscripciones', keys: ['googleone'] },
  { name: 'Xbox Game Pass', mono: 'X', color: '#107C10', categoryId: 'suscripciones', keys: ['xbox', 'gamepass'] },
  { name: 'PlayStation Plus', mono: 'PS', color: '#0070D1', categoryId: 'suscripciones', keys: ['playstation', 'psplus'] },
  { name: 'ChatGPT Plus', mono: 'AI', color: '#10A37F', categoryId: 'suscripciones', keys: ['chatgpt'] },
  { name: 'Microsoft 365', mono: 'M', color: '#D83B01', categoryId: 'suscripciones', keys: ['microsoft', 'office365'] },
  { name: 'Duolingo', mono: 'D', color: '#58CC02', categoryId: 'suscripciones', keys: ['duolingo'] },
  { name: 'Uber One', mono: 'U1', color: '#4B5563', categoryId: 'suscripciones', keys: ['uberone'] },
  { name: 'Rappi Pro', mono: 'R', color: '#FF441F', categoryId: 'suscripciones', keys: ['rappi'] },
  { name: 'Meli+', mono: 'M+', color: '#FFE600', categoryId: 'suscripciones', keys: ['meliplus', '=meli', 'mercadolibre'] },
  { name: 'Smart Fit', mono: 'SF', color: '#F2B807', categoryId: 'salud', keys: ['smartfit'] },
];

/** "Disney Plus", "disney+" y "Disney+ Premium" se escriben igual: "disneyplus…". */
const serviceKey = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]/g, '');

/** El servicio conocido al que se refiere un nombre ("Netflix premium" → Netflix), o null. */
export function knownService(name: string): KnownService | null {
  const key = serviceKey(name);
  if (!key) return null;
  return KNOWN_SERVICES.find((s) => s.keys.some((k) => (k.startsWith('=') ? key === k.slice(1) : key.startsWith(k)))) ?? null;
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
