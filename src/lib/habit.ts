import type { IconName } from '@/theme';
import { addDays, DateKey, startOfWeek, toKey, weekdayIndex } from './dates';

export type TimeOfDay = 'anytime' | 'morning' | 'afternoon' | 'evening';

/** Meta: `count` veces por día o por semana. */
export type Goal = { period: 'day' | 'week'; count: number };

export type Habit = {
  id: string;
  name: string;
  icon: IconName;
  color: string;
  /** Ids de categoría (predefinidas o personalizadas). */
  categories: string[];
  timeOfDay: TimeOfDay;
  goal: Goal;
  /** Días de la semana en que toca (0 = lunes). Solo aplica a metas diarias. */
  days: number[];
  /** Horas de recordatorio en formato HH:MM, ordenadas. */
  reminders: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HabitInput = Pick<
  Habit,
  'name' | 'icon' | 'color' | 'categories' | 'timeOfDay' | 'goal' | 'days' | 'reminders'
>;

/** habitId -> { 'YYYY-MM-DD': veces completado ese día } */
export type Completions = Record<string, Record<DateKey, number>>;

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function isScheduledOn(habit: Pick<Habit, 'goal' | 'days'>, date: Date): boolean {
  return habit.goal.period === 'week' || habit.days.includes(weekdayIndex(date));
}

/** Veces necesarias en un día para darlo por completado. */
export function dailyTarget(habit: Pick<Habit, 'goal'>): number {
  return habit.goal.period === 'day' ? habit.goal.count : 1;
}

export function isDayComplete(habit: Pick<Habit, 'goal'>, count: number | undefined): boolean {
  return (count ?? 0) >= dailyTarget(habit);
}

/** Total de veces completado en la semana (lunes a domingo) que contiene `date`. */
export function weekCount(days: Record<DateKey, number> | undefined, date: Date): number {
  if (!days) return 0;
  const start = startOfWeek(date);
  let total = 0;
  for (let i = 0; i < 7; i++) total += days[toKey(addDays(start, i))] ?? 0;
  return total;
}

/** ¿Ya no hace falta hacer nada más en este día? (meta diaria cumplida o semanal ya alcanzada). */
export function isDoneFor(habit: Pick<Habit, 'goal'>, days: Record<DateKey, number> | undefined, date: Date): boolean {
  if (habit.goal.period === 'week') return weekCount(days, date) >= habit.goal.count;
  return isDayComplete(habit, days?.[toKey(date)]);
}

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function describeDays(days: number[]): string {
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Todos los días';
  if (sorted.join() === '0,1,2,3,4') return 'Entre semana';
  if (sorted.join() === '5,6') return 'Fines de semana';
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(' ');
}

export function describeGoal(habit: Pick<Habit, 'goal' | 'days'>): string {
  const { period, count } = habit.goal;
  if (period === 'week') return `${count} ${count === 1 ? 'vez' : 'veces'} por semana`;
  const times = count === 1 ? '' : `${count} veces · `;
  return times + describeDays(habit.days);
}

export const TIME_OF_DAY: Record<TimeOfDay, { label: string; icon: IconName; defaultReminder: string }> = {
  morning: { label: 'Mañana', icon: 'sunny-outline', defaultReminder: '08:00' },
  afternoon: { label: 'Tarde', icon: 'partly-sunny-outline', defaultReminder: '15:00' },
  evening: { label: 'Noche', icon: 'moon-outline', defaultReminder: '21:00' },
  anytime: { label: 'Cualquier momento', icon: 'time-outline', defaultReminder: '10:00' },
};

export const TIME_OF_DAY_ORDER: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'anytime'];

export function sortTimes(times: string[]): string[] {
  return [...new Set(times)].sort();
}
