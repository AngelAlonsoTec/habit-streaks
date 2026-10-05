import { addDays, daysBetween, DateKey, fromKey, startOfDay, startOfWeek, toKey, weekdayIndex } from './dates';
import { Habit, isDayComplete, isScheduledOn, weekCount } from './habit';

export type HabitStats = {
  /** Días (meta diaria) o semanas (meta semanal) seguidos cumpliendo. */
  currentStreak: number;
  bestStreak: number;
  streakUnit: 'day' | 'week';
  /** Veces completado en total (o cantidad total en hábitos cuantitativos). */
  total: number;
  /** Porcentaje (0-100) de cumplimiento en los últimos 30 días. */
  rate30: number;
  /** Veces completado por día de la semana (0 = lunes). */
  weekdayCounts: number[];
};

type StatsHabit = Pick<Habit, 'goal' | 'unit' | 'days' | 'createdAt'>;

export function computeStats(habit: StatsHabit, days: Record<DateKey, number> | undefined, now = new Date()): HabitStats {
  const counts = days ?? {};
  const today = startOfDay(now);
  const keys = Object.keys(counts).filter((k) => counts[k] > 0).sort();
  const created = startOfDay(new Date(habit.createdAt));
  const firstDone = keys.length ? fromKey(keys[0]) : created;
  const origin = firstDone < created ? firstDone : created;

  let total = 0;
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const k of keys) {
    total += counts[k];
    weekdayCounts[weekdayIndex(fromKey(k))] += counts[k];
  }

  const windowStart = daysBetween(origin, today) >= 29 ? addDays(today, -29) : origin;
  const streaks = habit.goal.period === 'week'
    ? weeklyStreaks(habit.goal.count, counts, origin, today, windowStart)
    : dailyStreaks(habit, counts, origin, today, windowStart);

  return { ...streaks, total, weekdayCounts };
}

function dailyStreaks(habit: StatsHabit, counts: Record<DateKey, number>, origin: Date, today: Date, windowStart: Date) {
  let run = 0;
  let best = 0;
  let scheduled = 0;
  let completed = 0;
  const span = daysBetween(origin, today);
  for (let i = 0; i <= span; i++) {
    const d = addDays(origin, i);
    if (!isScheduledOn(habit, d)) continue;
    const done = isDayComplete(habit, counts[toKey(d)]);
    const isToday = i === span;
    if (done) run++;
    else if (!isToday) run = 0; // hoy aún no cuenta como fallo
    best = Math.max(best, run);
    if (d >= windowStart && (done || !isToday)) {
      scheduled++;
      if (done) completed++;
    }
  }
  return {
    currentStreak: run,
    bestStreak: best,
    streakUnit: 'day' as const,
    rate30: scheduled ? Math.round((completed / scheduled) * 100) : 0,
  };
}

function weeklyStreaks(goal: number, counts: Record<DateKey, number>, origin: Date, today: Date, windowStart: Date) {
  let run = 0;
  let best = 0;
  let weeks = 0;
  let progress = 0;
  const current = startOfWeek(today);
  for (let w = startOfWeek(origin); w <= current; w = addDays(w, 7)) {
    const count = weekCount(counts, w);
    const met = count >= goal;
    const isCurrent = w.getTime() === current.getTime();
    if (met) run++;
    else if (!isCurrent) run = 0;
    best = Math.max(best, run);
    if (addDays(w, 6) >= windowStart && (met || !isCurrent)) {
      weeks++;
      progress += Math.min(count / goal, 1);
    }
  }
  return {
    currentStreak: run,
    bestStreak: best,
    streakUnit: 'week' as const,
    rate30: weeks ? Math.round((progress / weeks) * 100) : 0,
  };
}

export function streakLabel(n: number, unit: 'day' | 'week'): string {
  if (unit === 'week') return `${n} ${n === 1 ? 'semana' : 'semanas'}`;
  return `${n} ${n === 1 ? 'día' : 'días'}`;
}
