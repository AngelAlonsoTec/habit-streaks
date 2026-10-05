import type { IconName } from '@/theme';
import { addDays, DateKey, fromKey, startOfDay, startOfWeek, toKey, weekdayIndex } from './dates';

export type TimeOfDay = 'anytime' | 'morning' | 'afternoon' | 'evening';

/** Generar un hábito (llegar a una meta) o dejarlo (no pasar de un límite). */
export type HabitKind = 'build' | 'quit';

/**
 * `count` veces (o cantidad de `unit`) por día o por semana. Al generar es la meta mínima;
 * al dejar, el máximo permitido (0 = dejarlo del todo).
 */
export type Goal = { period: 'day' | 'week'; count: number };

export type Habit = {
  id: string;
  name: string;
  icon: IconName;
  color: string;
  /** Ids de categoría (predefinidas o personalizadas). */
  categories: string[];
  timeOfDay: TimeOfDay;
  kind: HabitKind;
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
  'name' | 'icon' | 'color' | 'categories' | 'timeOfDay' | 'kind' | 'goal' | 'unit' | 'days' | 'reminders'
>;

/** habitId -> { 'YYYY-MM-DD': veces completado (o cantidad registrada) ese día } */
export type Completions = Record<string, Record<DateKey, number>>;

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Lo que necesitan las reglas de cumplimiento. */
type GoalHabit = Pick<Habit, 'kind' | 'goal' | 'unit'>;

export function isQuantity(habit: Pick<Habit, 'unit'>): boolean {
  return habit.unit != null;
}

export function isQuit(habit: Pick<Habit, 'kind'>): boolean {
  return habit.kind === 'quit';
}

/** Primer día desde el que cuenta un hábito: su creación o su primer registro, lo que sea antes. */
export function habitStart(habit: Pick<Habit, 'createdAt'>, days: Record<DateKey, number> | undefined): Date {
  const created = startOfDay(new Date(habit.createdAt));
  const keys = Object.keys(days ?? {}).filter((k) => (days?.[k] ?? 0) > 0).sort();
  const first = keys.length ? fromKey(keys[0]) : created;
  return first < created ? first : created;
}

export function isScheduledOn(habit: Pick<Habit, 'goal' | 'days'>, date: Date): boolean {
  return habit.goal.period === 'week' || habit.days.includes(weekdayIndex(date));
}

/**
 * Cantidad que da un día por completo (intensidad máxima en heatmap y calendario) al generar.
 * En metas semanales por veces basta con hacerlo una vez; por cantidad, ir al ritmo de la meta (1/7).
 */
export function dailyTarget(habit: Pick<Habit, 'goal' | 'unit'>): number {
  if (habit.goal.period === 'day') return habit.goal.count;
  return isQuantity(habit) ? habit.goal.count / 7 : 1;
}

/** ¿Día logrado? Al generar, llegar a la meta; al dejar, no pasar del límite (un día sin registros cuenta). */
export function isDayComplete(habit: GoalHabit, count: number | undefined): boolean {
  if (isQuit(habit)) return (count ?? 0) <= habit.goal.count;
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

/**
 * Al generar: ¿ya no hace falta hacer nada más ese día? (meta diaria o semanal alcanzada).
 * Al dejar: ¿sigue dentro del límite del día (o de la semana)?
 */
export function isDoneFor(habit: GoalHabit, days: Record<DateKey, number> | undefined, date: Date): boolean {
  if (habit.goal.period === 'week') {
    const week = weekCount(days, date);
    return isQuit(habit) ? week <= habit.goal.count : week >= habit.goal.count;
  }
  return isDayComplete(habit, days?.[toKey(date)]);
}

/** Nivel de una celda del heatmap o del calendario: 0 vacío … 1 completo; -1 = límite superado (al dejar). */
export function dayLevel(habit: GoalHabit, count: number, date: Date, start: Date): number {
  if (!isQuit(habit)) return count / dailyTarget(habit);
  if (date < start) return 0;
  const limit = habit.goal.count;
  if (count > limit) return -1;
  // Más lleno cuanto más lejos del límite: 0 de 2 → 1, 1 de 2 → 0,67, 2 de 2 → 0,33.
  return 1 - count / (limit + 1);
}

/**
 * Nivel de cada día de un hábito para dejar, listo para el heatmap y el calendario (undefined al
 * generar: ahí basta con registrado / meta). Con límite semanal, los días con registros de una
 * semana que se pasó también salen como superados.
 */
export function quitLevel(
  habit: GoalHabit & Pick<Habit, 'createdAt'>,
  days: Record<DateKey, number> | undefined,
): ((date: Date, count: number) => number) | undefined {
  if (!isQuit(habit)) return undefined;
  const start = habitStart(habit, days);
  return (date, count) => {
    if (habit.goal.period === 'week' && count > 0 && weekCount(days, date) > habit.goal.count) return -1;
    return dayLevel(habit, count, date, start);
  };
}

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function describeDays(days: number[]): string {
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Todos los días';
  if (sorted.join() === '0,1,2,3,4') return 'Entre semana';
  if (sorted.join() === '5,6') return 'Fines de semana';
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(' ');
}

export function describeGoal(habit: Pick<Habit, 'kind' | 'goal' | 'unit' | 'days'>): string {
  const { period, count } = habit.goal;
  const days = period === 'week' ? '' : ` · ${describeDays(habit.days)}`;
  if (isQuit(habit)) {
    if (count === 0) return `Sin recaídas${days}`;
    const limit = habit.unit != null ? `${formatAmount(count)} ${habit.unit}` : `${count} ${count === 1 ? 'vez' : 'veces'}`;
    return `Máx. ${limit} ${period === 'week' ? 'por semana' : 'al día'}${days}`;
  }
  if (habit.unit != null) {
    const amount = `${formatAmount(count)} ${habit.unit}`;
    return period === 'week' ? `${amount} por semana` : `${amount} · ${describeDays(habit.days)}`;
  }
  if (period === 'week') return `${count} ${count === 1 ? 'vez' : 'veces'} por semana`;
  const times = count === 1 ? '' : `${count} veces · `;
  return times + describeDays(habit.days);
}

/** Lo registrado frente a la meta o el límite: "3,2 / 5 km", "2/8", "1 / máx. 2", "Sin recaídas". */
export function describeProgress(habit: Pick<Habit, 'kind' | 'unit'>, value: number, target: number): string {
  const unit = habit.unit != null ? ` ${habit.unit}` : '';
  if (isQuit(habit)) {
    if (target === 0) {
      if (value === 0) return 'Sin recaídas';
      return habit.unit != null ? `${formatAmount(value)}${unit}` : `${value} ${value === 1 ? 'recaída' : 'recaídas'}`;
    }
    return `${formatAmount(value)} / máx. ${formatAmount(target)}${unit}`;
  }
  if (habit.unit == null) return `${value}/${target}`;
  return `${formatAmount(value)} / ${formatAmount(target)}${unit}`;
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
