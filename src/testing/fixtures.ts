import { addDays, DateKey, fromKey, toKey } from '@/lib/dates';
import { ALL_DAYS, Habit } from '@/lib/habit';

/** Viernes 25/09/2026 a las 15:00. */
export const NOW = new Date(2026, 8, 25, 15, 0);
export const TODAY = '2026-09-25';

export function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Leer',
    icon: 'book',
    color: '#3B82F6',
    categories: [],
    timeOfDay: 'anytime',
    kind: 'build',
    goal: { period: 'day', count: 1 },
    unit: null,
    days: ALL_DAYS,
    reminders: [],
    objectives: [],
    archived: false,
    archivedAt: null,
    createdAt: new Date(2025, 0, 1).toISOString(),
    updatedAt: new Date(2025, 0, 1).toISOString(),
    ...overrides,
  };
}

/** Los `count` días consecutivos que terminan en `end`. */
export function range(end: DateKey, count: number): DateKey[] {
  return Array.from({ length: count }, (_, i) => toKey(addDays(fromKey(end), -i)));
}

export function counts(keys: DateKey[], value = 1): Record<DateKey, number> {
  return Object.fromEntries(keys.map((k) => [k, value]));
}
