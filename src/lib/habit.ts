import type { IconName } from '@/theme';
import { addDays, DateKey, startOfWeek, toKey, weekdayIndex } from './dates';

export type TimeOfDay = 'anytime' | 'morning' | 'afternoon' | 'evening';

/** Meta: `count` veces (o cantidad de `unit`) por día o por semana. */
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
  /** Unidad de los hábitos cuantitativos (km, min, páginas…). null = se cuentan veces, un toque cada una. */
  unit: string | null;
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
  'name' | 'icon' | 'color' | 'categories' | 'timeOfDay' | 'goal' | 'unit' | 'days' | 'reminders'
>;

/** habitId -> { 'YYYY-MM-DD': veces completado (o cantidad registrada) ese día } */
export type Completions = Record<string, Record<DateKey, number>>;

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function isQuantity(habit: Pick<Habit, 'unit'>): boolean {
  return habit.unit != null;
}

export function isScheduledOn(habit: Pick<Habit, 'goal' | 'days'>, date: Date): boolean {
  return habit.goal.period === 'week' || habit.days.includes(weekdayIndex(date));
}

/**
 * Cantidad que da un día por completo (intensidad máxima en heatmap y calendario).
 * En metas semanales por veces basta con hacerlo una vez; por cantidad, ir al ritmo de la meta (1/7).
 */
export function dailyTarget(habit: Pick<Habit, 'goal' | 'unit'>): number {
  if (habit.goal.period === 'day') return habit.goal.count;
  return isQuantity(habit) ? habit.goal.count / 7 : 1;
}

export function isDayComplete(habit: Pick<Habit, 'goal' | 'unit'>, count: number | undefined): boolean {
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
export function isDoneFor(habit: Pick<Habit, 'goal' | 'unit'>, days: Record<DateKey, number> | undefined, date: Date): boolean {
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

export function describeGoal(habit: Pick<Habit, 'goal' | 'unit' | 'days'>): string {
  const { period, count } = habit.goal;
  if (habit.unit != null) {
    const amount = `${formatAmount(count)} ${habit.unit}`;
    return period === 'week' ? `${amount} por semana` : `${amount} · ${describeDays(habit.days)}`;
  }
  if (period === 'week') return `${count} ${count === 1 ? 'vez' : 'veces'} por semana`;
  const times = count === 1 ? '' : `${count} veces · `;
  return times + describeDays(habit.days);
}

/** Lo registrado frente a la meta: "3,2 / 5 km", "2/8". */
export function describeProgress(habit: Pick<Habit, 'unit'>, value: number, target: number): string {
  if (habit.unit == null) return `${value}/${target}`;
  return `${formatAmount(value)} / ${formatAmount(target)} ${habit.unit}`;
}

// ---- Cantidades ----

/** Mayor cantidad admitida en una meta o un registro. */
export const MAX_AMOUNT = 1_000_000;

/** Redondea a 2 decimales (evita arrastrar errores de coma flotante al sumar 0,1 + 0,2…). */
export function roundAmount(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "3,5", "10.000", "0,25" (formato español, hasta 2 decimales). */
export function formatAmount(n: number): string {
  return roundAmount(n).toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

/**
 * Lee una cantidad escrita por el usuario: admite coma o punto decimal ("1,5", "1.5")
 * y punto o espacio de miles ("10.000", "10 000"). Devuelve null si no es un número positivo.
 */
export function parseAmount(text: string): number | null {
  let s = text.trim().replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = roundAmount(Number(s));
  return n > 0 && n <= MAX_AMOUNT ? n : null;
}

/** Unidades sugeridas en el asistente, con una meta diaria de partida y sus sumas rápidas. */
export const UNIT_PRESETS: { unit: string; goal: number; steps: number[] }[] = [
  { unit: 'min', goal: 30, steps: [5, 10, 15, 30] },
  { unit: 'h', goal: 1, steps: [0.25, 0.5, 1, 2] },
  { unit: 'km', goal: 5, steps: [0.5, 1, 2, 5] },
  { unit: 'pasos', goal: 10000, steps: [500, 1000, 2000, 5000] },
  { unit: 'páginas', goal: 20, steps: [1, 5, 10, 20] },
  { unit: 'vasos', goal: 8, steps: [1, 2, 3] },
  { unit: 'ml', goal: 2000, steps: [100, 250, 330, 500] },
  { unit: 'L', goal: 2, steps: [0.25, 0.5, 1] },
  { unit: 'reps', goal: 50, steps: [5, 10, 20, 50] },
  { unit: 'kcal', goal: 500, steps: [50, 100, 200, 500] },
];

export function unitPreset(unit: string | null) {
  return UNIT_PRESETS.find((p) => p.unit.toLowerCase() === unit?.toLowerCase());
}

/** Números "redondos" para las sumas rápidas de unidades propias. */
const NICE = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

/** Botones de suma rápida: los de la unidad si es conocida; si no, fracciones redondas de la meta. */
export function quickSteps(habit: Pick<Habit, 'unit' | 'goal'>): number[] {
  const preset = unitPreset(habit.unit);
  if (preset) return preset.steps;
  const target = habit.goal.period === 'day' ? habit.goal.count : habit.goal.count / 7;
  const nice = (x: number) => NICE.reduce((best, n) => (Math.abs(n - x) < Math.abs(best - x) ? n : best));
  const steps = [...new Set([target / 10, target / 4, target / 2, target].map(nice))].sort((a, b) => a - b);
  return steps.slice(-4);
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
