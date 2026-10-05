/** Fecha local en formato YYYY-MM-DD. Independiente de zona horaria. */
export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): DateKey {
  return toKey(new Date());
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Día de la semana empezando en lunes (0 = lunes, 6 = domingo). */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -weekdayIndex(d));
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

export const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** "Hoy", "Ayer" o la fecha completa: "Lunes, 3 de octubre". */
export function formatDay(key: DateKey, today: DateKey = todayKey()): string {
  if (key === today) return 'Hoy';
  if (key === toKey(addDays(fromKey(today), -1))) return 'Ayer';
  const text = fromKey(key).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** El mismo día `months` meses después; si ese mes es más corto, su último día (31/1 + 1 → 28/2). */
export function addMonths(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay));
}

/** "12 mar"; con el año si no es el de `today` ("12 mar 2027"). */
export function formatShortDate(key: DateKey, today: DateKey = todayKey()): string {
  const d = fromKey(key);
  const text = `${d.getDate()} ${MONTH_LABELS[d.getMonth()].toLowerCase()}`;
  return d.getFullYear() === fromKey(today).getFullYear() ? text : `${text} ${d.getFullYear()}`;
}

/** Título corto de un día cercano: "Hoy", "Ayer" o "Viernes 2". */
export function formatDayTitle(key: DateKey, today: DateKey = todayKey()): string {
  if (key === today) return 'Hoy';
  if (key === toKey(addDays(fromKey(today), -1))) return 'Ayer';
  const d = fromKey(key);
  const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d.getDate()}`;
}
