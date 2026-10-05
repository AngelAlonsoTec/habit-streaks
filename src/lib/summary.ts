import { addDays, DateKey, MONTH_LABELS, startOfDay, startOfWeek, toKey, weekdayIndex, WEEKDAY_LABELS } from './dates';
import { Completions, Habit, habitStart, isDayComplete, isQuantity, isQuit, isScheduledOn, weekCount } from './habit';

export type Period = 'week' | 'month' | 'quarter' | 'year';

export type PeriodRange = { start: Date; end: Date; label: string };

/** Veces que tocaba hacer un hábito y cuántas se cumplieron (fraccionario en metas semanales). */
export type Occurrences = { scheduled: number; done: number };

export type SummaryBucket = { label: string; rate: number | null; current: boolean };

export type HabitSummary = { habit: Habit; rate: number | null } & Occurrences;

export type Summary = {
  range: PeriodRange;
  /** Cumplimiento 0-100, o null si en el periodo no tocaba nada. */
  rate: number | null;
  previousRate: number | null;
  /**
   * Veces completado (suma de repeticiones; en hábitos cuantitativos, un día con registro cuenta una vez).
   * Los hábitos para dejar no suman: registrar una recaída no es completar nada.
   */
  completions: number;
  /** Días en que se cumplieron todos los hábitos diarios que tocaban. */
  perfectDays: number;
  /** Días con al menos un hábito marcado (de los que se generan). */
  activeDays: number;
  /** Días transcurridos del periodo (hasta hoy). */
  elapsedDays: number;
  buckets: SummaryBucket[];
  habits: HabitSummary[];
  /** Cumplimiento 0-100 por día de la semana (0 = lunes) de los hábitos diarios. */
  weekdayRates: (number | null)[];
  /** Cumplimiento 0-1 de los hábitos diarios por día, para el heatmap de constancia. */
  dailyRates: Record<DateKey, number>;
  /** Objetivos logrados en el periodo, del más reciente al más antiguo. */
  objectivesAchieved: { habit: Habit; title: string; on: DateKey }[];
};

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const shortMonth = (d: Date) => MONTH_LABELS[d.getMonth()].toLowerCase();

/** Rango del periodo: `offset` 0 es el actual, -1 el anterior, etc. */
export function periodRange(period: Period, offset: number, today: Date): PeriodRange {
  const t = startOfDay(today);
  if (period === 'week') {
    const start = addDays(startOfWeek(t), 7 * offset);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const label = sameMonth
      ? `${start.getDate()} – ${end.getDate()} ${shortMonth(end)} ${end.getFullYear()}`
      : `${start.getDate()} ${shortMonth(start)} – ${end.getDate()} ${shortMonth(end)} ${end.getFullYear()}`;
    return { start, end, label };
  }
  if (period === 'month') {
    const start = new Date(t.getFullYear(), t.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { start, end, label: `${capitalize(MONTH_NAMES[start.getMonth()])} ${start.getFullYear()}` };
  }
  if (period === 'quarter') {
    const q = Math.floor(t.getMonth() / 3) + offset;
    const start = new Date(t.getFullYear(), q * 3, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    const n = Math.floor(start.getMonth() / 3) + 1;
    return { start, end, label: `T${n} ${start.getFullYear()} · ${shortMonth(start)} – ${shortMonth(end)}` };
  }
  const start = new Date(t.getFullYear() + offset, 0, 1);
  const end = new Date(start.getFullYear(), 11, 31);
  return { start, end, label: String(start.getFullYear()) };
}

/**
 * Veces que tocaba el hábito entre `from` y `to` (hasta hoy) y cuántas se cumplieron.
 * Hoy sin hacer no cuenta como fallo (al dejar un hábito, pasarse del límite hoy sí). Las metas semanales cuentan cada semana cuyo lunes
 * cae en el rango; con `dailyOnly` se ignoran (para gráficas por día).
 */
export function occurrences(
  habit: Habit,
  days: Record<DateKey, number> | undefined,
  from: Date,
  to: Date,
  today: Date,
  dailyOnly = false,
  origin = habitStart(habit, days),
): Occurrences {
  const t = startOfDay(today);
  const quit = isQuit(habit);
  let scheduled = 0;
  let done = 0;

  if (habit.goal.period === 'day') {
    const start = from > origin ? from : origin;
    const end = to < t ? to : t;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (!isScheduledOn(habit, d)) continue;
      const complete = isDayComplete(habit, days?.[toKey(d)]);
      if (!complete && !quit && d.getTime() === t.getTime()) continue;
      scheduled++;
      if (complete) done++;
    }
    return { scheduled, done };
  }

  if (dailyOnly) return { scheduled, done };
  const firstMonday = weekdayIndex(from) === 0 ? from : addDays(startOfWeek(from), 7);
  const currentWeek = startOfWeek(t);
  for (let w = firstMonday; w <= to && w <= t; w = addDays(w, 7)) {
    if (addDays(w, 6) < origin) continue;
    const count = weekCount(days, w);
    const met = quit ? count <= habit.goal.count : count >= habit.goal.count;
    // La semana en curso y la primera, si el hábito empezó a mitad, solo cuentan si se llegó a la meta.
    if (!met && !quit && (w.getTime() === currentWeek.getTime() || w < origin)) continue;
    scheduled++;
    done += quit ? Number(met) : Math.min(count / habit.goal.count, 1);
  }
  return { scheduled, done };
}

/** Día de inicio de cada hábito, calculado una vez (evita reordenar sus registros en cada consulta). */
type Origins = Map<string, Date>;

function sumOccurrences(
  habits: Habit[], completions: Completions, origins: Origins, from: Date, to: Date, today: Date, dailyOnly = false,
) {
  return habits.reduce<Occurrences>(
    (acc, h) => {
      const o = occurrences(h, completions[h.id], from, to, today, dailyOnly, origins.get(h.id));
      return { scheduled: acc.scheduled + o.scheduled, done: acc.done + o.done };
    },
    { scheduled: 0, done: 0 },
  );
}

const toRate = (o: Occurrences) => (o.scheduled ? Math.round((o.done / o.scheduled) * 100) : null);

function buildBuckets(
  period: Period, range: PeriodRange, habits: Habit[], completions: Completions, origins: Origins, today: Date,
): SummaryBucket[] {
  const t = startOfDay(today);
  const bucket = (label: string, from: Date, to: Date, dailyOnly: boolean): SummaryBucket => ({
    label,
    rate: from > t ? null : toRate(sumOccurrences(habits, completions, origins, from, to, t, dailyOnly)),
    current: from <= t && t <= to,
  });

  if (period === 'week' || period === 'month') {
    const out: SummaryBucket[] = [];
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
      const label = period === 'week' ? WEEKDAY_LABELS[weekdayIndex(d)] : String(d.getDate());
      out.push(bucket(label, d, d, true));
    }
    return out;
  }
  if (period === 'quarter') {
    const out: SummaryBucket[] = [];
    for (let w = startOfWeek(range.start); w <= range.end; w = addDays(w, 7)) {
      const from = w < range.start ? range.start : w;
      const to = addDays(w, 6) > range.end ? range.end : addDays(w, 6);
      // Etiqueta: el mes, solo en la semana en que empieza (la primera barra o la que contiene el día 1).
      const monthStart = out.length === 0 ? from : [...Array(7)].map((_, i) => addDays(w, i)).find((d) => d.getDate() === 1 && d <= to);
      out.push(bucket(monthStart ? MONTH_LABELS[monthStart.getMonth()].toLowerCase() : '', from, to, false));
    }
    return out;
  }
  return Array.from({ length: 12 }, (_, m) => {
    const from = new Date(range.start.getFullYear(), m, 1);
    const to = new Date(range.start.getFullYear(), m + 1, 0);
    return bucket(MONTH_LABELS[m].charAt(0), from, to, false);
  });
}

export function summarize(
  habits: Habit[],
  completions: Completions,
  period: Period,
  offset: number,
  today = new Date(),
): Summary {
  const t = startOfDay(today);
  const range = periodRange(period, offset, t);
  const prev = periodRange(period, offset - 1, t);
  const end = range.end < t ? range.end : t;
  const origins: Origins = new Map(habits.map((h) => [h.id, habitStart(h, completions[h.id])]));

  const perHabit: HabitSummary[] = habits.map((h) => {
    const o = occurrences(h, completions[h.id], range.start, range.end, t, false, origins.get(h.id));
    return { habit: h, ...o, rate: toRate(o) };
  });
  const total = perHabit.reduce<Occurrences>(
    (acc, h) => ({ scheduled: acc.scheduled + h.scheduled, done: acc.done + h.done }),
    { scheduled: 0, done: 0 },
  );

  let completionsCount = 0;
  let perfectDays = 0;
  let activeDays = 0;
  let elapsedDays = 0;
  const dailyRates: Record<DateKey, number> = {};
  const weekday = Array.from({ length: 7 }, () => ({ scheduled: 0, done: 0 }));

  for (let d = range.start; d <= end; d = addDays(d, 1)) {
    elapsedDays++;
    const key = toKey(d);
    let dayCount = 0;
    const day = { scheduled: 0, done: 0 };
    // Hábitos de hoy aún sin hacer: no cuentan como fallo, pero el día todavía no es perfecto.
    let pendingToday = 0;
    for (const h of habits) {
      const count = completions[h.id]?.[key] ?? 0;
      // Las cantidades no se suman: 5 km y 10.000 pasos no son 10.005 veces.
      if (!isQuit(h)) dayCount += isQuantity(h) ? Number(count > 0) : count;
      if (h.goal.period !== 'day') continue;
      const o = occurrences(h, completions[h.id], d, d, t, true, origins.get(h.id));
      day.scheduled += o.scheduled;
      day.done += o.done;
      const origin = origins.get(h.id);
      if (d.getTime() === t.getTime() && o.scheduled === 0 && isScheduledOn(h, d) && origin && origin <= d) pendingToday++;
    }
    completionsCount += dayCount;
    if (dayCount > 0) activeDays++;
    if (day.scheduled > 0) {
      dailyRates[key] = day.done / day.scheduled;
      if (day.done === day.scheduled && pendingToday === 0) perfectDays++;
      weekday[weekdayIndex(d)].scheduled += day.scheduled;
      weekday[weekdayIndex(d)].done += day.done;
    }
  }

  return {
    range,
    rate: toRate(total),
    previousRate: toRate(sumOccurrences(habits, completions, origins, prev.start, prev.end, t)),
    completions: completionsCount,
    perfectDays,
    activeDays,
    elapsedDays,
    buckets: buildBuckets(period, range, habits, completions, origins, t),
    habits: perHabit.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.habit.name.localeCompare(b.habit.name)),
    weekdayRates: weekday.map(toRate),
    dailyRates,
    objectivesAchieved: habits
      .flatMap((h) => h.objectives.map((o) => ({ habit: h, title: o.title, on: o.achievedOn })))
      .filter((o): o is { habit: Habit; title: string; on: DateKey } => o.on != null && o.on >= toKey(range.start) && o.on <= toKey(end))
      .sort((a, b) => b.on.localeCompare(a.on)),
  };
}
