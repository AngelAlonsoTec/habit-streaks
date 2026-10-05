import { daysBetween, DateKey, formatShortDate, fromKey } from './dates';
import type { Habit } from './habit';

/** Un hito a largo plazo de un hábito ("Alcanzar el A1"). Se marca a mano al lograrlo. */
export type Objective = {
  id: string;
  title: string;
  /** Fecha límite opcional. */
  dueDate: DateKey | null;
  /** Día en que se logró; null mientras está pendiente. */
  achievedOn: DateKey | null;
  createdAt: string;
};

export type ObjectiveInput = Pick<Objective, 'title' | 'dueDate'>;

export const MAX_OBJECTIVE_LENGTH = 80;

/** El próximo objetivo: el primero pendiente en el orden elegido. */
export function nextObjective(objectives: Objective[]): Objective | undefined {
  return objectives.find((o) => o.achievedOn == null);
}

export type DueTone = 'normal' | 'soon' | 'overdue';

/** Texto del plazo de un objetivo pendiente: "Antes del 31 dic · quedan 87 días", "Vence mañana"… */
export function describeDue(dueDate: DateKey, today: DateKey): { text: string; tone: DueTone } {
  const left = daysBetween(fromKey(today), fromKey(dueDate));
  if (left < 0) {
    const ago = -left;
    return { text: `Plazo vencido hace ${ago} ${ago === 1 ? 'día' : 'días'}`, tone: 'overdue' };
  }
  if (left === 0) return { text: 'Vence hoy', tone: 'soon' };
  if (left === 1) return { text: 'Vence mañana', tone: 'soon' };
  return {
    text: `Antes del ${formatShortDate(dueDate, today)} · quedan ${left} días`,
    tone: left <= 7 ? 'soon' : 'normal',
  };
}

/** Plazo en pocas letras para la tarjeta: "plazo vencido", "vence hoy", "vence mañana", "12 días". */
export function describeDueShort(dueDate: DateKey, today: DateKey): { text: string; tone: DueTone } {
  const { tone } = describeDue(dueDate, today);
  const left = daysBetween(fromKey(today), fromKey(dueDate));
  const text = left < 0 ? 'plazo vencido' : left === 0 ? 'vence hoy' : left === 1 ? 'vence mañana' : `${left} días`;
  return { text, tone };
}

/** Estado de un objetivo en una línea: logrado (con fecha), con plazo o sin plazo. */
export function describeObjective(objective: Objective, today: DateKey): { text: string; tone: DueTone | 'done' } {
  if (objective.achievedOn) return { text: `Logrado el ${formatShortDate(objective.achievedOn, today)}`, tone: 'done' };
  if (objective.dueDate) return describeDue(objective.dueDate, today);
  return { text: 'Sin fecha límite', tone: 'normal' };
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => `Alcanzar el ${l}`);
const RUNNING = ['Correr 5 km seguidos', 'Correr 10 km', 'Correr una media maratón', 'Correr una maratón'];
const READING = ['Terminar un libro', 'Leer 12 libros este año', 'Leer un libro en otro idioma'];
const EXERCISE = ['Hacer 20 flexiones seguidas', 'Hacer una dominada', 'Entrenar 3 meses seguidos'];
const QUITTING = ['Superar la primera semana', 'Llegar a un mes', 'Llegar a tres meses', 'Llegar a un año'];
const GENERIC = ['Primer mes completo', 'Tres meses seguidos', 'Convertirlo en rutina'];

/** Sin tildes y en minúsculas, para buscar palabras en el nombre del hábito. */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Sugerencias de objetivos según el hábito (idiomas → niveles A1…C2, correr → 5K, 10K…), sin repetir. */
export function suggestObjectives(habit: Pick<Habit, 'name' | 'icon' | 'categories' | 'kind' | 'objectives'>): string[] {
  const name = plain(habit.name);
  let list = GENERIC;
  if (habit.kind === 'quit') list = QUITTING;
  else if (habit.icon === 'language' || /ingles|idioma|frances|aleman|italiano|portugues|japones|chino|coreano|english/.test(name)) list = LEVELS;
  else if (/correr|running|trotar|maraton/.test(name)) list = RUNNING;
  else if (habit.categories.includes('lectura') || /leer|lectura|libro/.test(name)) list = READING;
  else if (habit.categories.includes('ejercicio')) list = EXERCISE;
  const taken = new Set(habit.objectives.map((o) => plain(o.title)));
  return list.filter((s) => !taken.has(plain(s)));
}
