import { addDays, daysBetween, DateKey, fromKey, startOfDay, startOfWeek, toKey, weekdayIndex } from './dates';
import { habitStart, Habit, isDayComplete, isQuit, isScheduledOn, trackedUntil, weekCount } from './habit';

export type HabitStats = {
  /** Días (meta diaria) o semanas (meta semanal) seguidos cumpliendo (al dejar: sin pasar del límite). */
  currentStreak: number;
  bestStreak: number;
  streakUnit: 'day' | 'week';
  /** Veces completado en total (o cantidad total en hábitos cuantitativos). */
  total: number;
  /** Porcentaje (0-100) de cumplimiento en los últimos 30 días. */
  rate30: number;
  /** Veces completado por día de la semana (0 = lunes). */
  weekdayCounts: number[];
  /** Al dejar un hábito: días (o semanas) en que se pasó del límite. */
  overLimit: number;
};

type StatsHabit = Pick<Habit, 'kind' | 'goal' | 'unit' | 'days' | 'createdAt' | 'archivedAt'>;

export function computeStats(habit: StatsHabit, days: Record<DateKey, number> | undefined, now = new Date()): HabitStats {
  const counts = days ?? {};
  // Un hábito archivado se queda como estaba la última vez que se siguió: lo posterior no es un fallo.
  const until = trackedUntil(habit, counts);
  const lastTracked = until ? fromKey(until) : null;
  const today = lastTracked && lastTracked < startOfDay(now) ? lastTracked : startOfDay(now);
  const keys = Object.keys(counts).filter((k) => counts[k] > 0).sort();
  const origin = habitStart(habit, counts);

  let total = 0;
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const k of keys) {
    total += counts[k];
    weekdayCounts[weekdayIndex(fromKey(k))] += counts[k];
  }

  const windowStart = daysBetween(origin, today) >= 29 ? addDays(today, -29) : origin;
  const streaks = habit.goal.period === 'week'
    ? weeklyStreaks(habit, counts, origin, today, windowStart)
    : dailyStreaks(habit, counts, origin, today, windowStart);

  return { ...streaks, total, weekdayCounts };
}

function dailyStreaks(habit: StatsHabit, counts: Record<DateKey, number>, origin: Date, today: Date, windowStart: Date) {
  let run = 0;
  let best = 0;
  let scheduled = 0;
  let completed = 0;
  let overLimit = 0;
  const quit = isQuit(habit);
  const span = daysBetween(origin, today);
  for (let i = 0; i <= span; i++) {
    const d = addDays(origin, i);
    if (!isScheduledOn(habit, d)) continue;
    const done = isDayComplete(habit, counts[toKey(d)]);
    // Al generar, hoy sin hacer aún no es un fallo; al dejar, pasarse hoy ya lo es.
    const settled = done || i !== span || quit;
    if (done) run++;
    else if (settled) run = 0;
    if (quit && !done) overLimit++;
    best = Math.max(best, run);
    if (d >= windowStart && settled) {
      scheduled++;
      if (done) completed++;
    }
  }
  return {
    currentStreak: run,
    bestStreak: best,
    streakUnit: 'day' as const,
    rate30: scheduled ? Math.round((completed / scheduled) * 100) : 0,
    overLimit,
  };
}

function weeklyStreaks(habit: StatsHabit, counts: Record<DateKey, number>, origin: Date, today: Date, windowStart: Date) {
  const goal = habit.goal.count;
  const quit = isQuit(habit);
  let run = 0;
  let best = 0;
  let weeks = 0;
  let progress = 0;
  let overLimit = 0;
  const current = startOfWeek(today);
  const first = startOfWeek(origin);
  for (let w = first; w <= current; w = addDays(w, 7)) {
    const count = weekCount(counts, w);
    const met = quit ? count <= goal : count >= goal;
    // Como la semana en curso, la primera semana si el hábito empezó a mitad (tenía menos días)
    // solo cuenta si se llegó a la meta.
    const partial = w.getTime() === current.getTime() || (w.getTime() === first.getTime() && w < origin);
    const settled = met || !partial || quit;
    if (met) run++;
    else if (settled) run = 0;
    if (quit && !met) overLimit++;
    best = Math.max(best, run);
    if (addDays(w, 6) >= windowStart && settled) {
      weeks++;
      progress += quit ? Number(met) : Math.min(count / goal, 1);
    }
  }
  return {
    currentStreak: run,
    bestStreak: best,
    streakUnit: 'week' as const,
    rate30: weeks ? Math.round((progress / weeks) * 100) : 0,
    overLimit,
  };
}

export function streakLabel(n: number, unit: 'day' | 'week'): string {
  if (unit === 'week') return `${n} ${n === 1 ? 'semana' : 'semanas'}`;
  return `${n} ${n === 1 ? 'día' : 'días'}`;
}
