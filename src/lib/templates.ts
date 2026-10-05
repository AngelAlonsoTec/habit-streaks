import type { HabitInput } from './habit';
import { ALL_DAYS } from './habit';

/** Sugerencias para generar un hábito con un toque. */
export const HABIT_TEMPLATES: HabitInput[] = [
  { name: 'Beber agua', icon: 'water', color: '#3B82F6', categories: ['salud', 'nutricion'], kind: 'build', timeOfDay: 'anytime', goal: { period: 'day', count: 8 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Leer', icon: 'book', color: '#F59E0B', categories: ['lectura'], kind: 'build', timeOfDay: 'evening', goal: { period: 'day', count: 20 }, unit: 'min', days: ALL_DAYS, reminders: ['21:30'] },
  { name: 'Meditar', icon: 'leaf', color: '#2EC4B6', categories: ['mente'], kind: 'build', timeOfDay: 'morning', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: ['07:30'] },
  { name: 'Hacer ejercicio', icon: 'barbell', color: '#EF4444', categories: ['ejercicio', 'salud'], kind: 'build', timeOfDay: 'afternoon', goal: { period: 'week', count: 4 }, unit: null, days: ALL_DAYS, reminders: ['18:00'] },
  { name: 'Caminar', icon: 'walk', color: '#39D353', categories: ['ejercicio'], kind: 'build', timeOfDay: 'anytime', goal: { period: 'day', count: 10000 }, unit: 'pasos', days: ALL_DAYS, reminders: [] },
  { name: 'Correr', icon: 'fitness', color: '#2EC4B6', categories: ['ejercicio', 'salud'], kind: 'build', timeOfDay: 'morning', goal: { period: 'week', count: 15 }, unit: 'km', days: ALL_DAYS, reminders: [] },
  { name: 'Estiramientos', icon: 'body', color: '#A855F7', categories: ['ejercicio', 'autocuidado'], kind: 'build', timeOfDay: 'morning', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Estudiar idioma', icon: 'language', color: '#6366F1', categories: ['aprendizaje'], kind: 'build', timeOfDay: 'anytime', goal: { period: 'day', count: 1 }, unit: null, days: [0, 1, 2, 3, 4], reminders: [] },
  { name: 'Dibujar', icon: 'brush', color: '#EC4899', categories: ['arte'], kind: 'build', timeOfDay: 'anytime', goal: { period: 'week', count: 3 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Registrar gastos', icon: 'cash', color: '#84CC16', categories: ['finanzas'], kind: 'build', timeOfDay: 'evening', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: ['22:00'] },
  { name: 'Dormir antes de las 23:00', icon: 'moon', color: '#64748B', categories: ['sueno', 'salud'], kind: 'build', timeOfDay: 'evening', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: ['22:30'] },
  { name: 'Tomar vitaminas', icon: 'medkit', color: '#EAB308', categories: ['salud'], kind: 'build', timeOfDay: 'morning', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: ['09:00'] },
];

/** Sugerencias para dejar un hábito: el límite es el máximo permitido (0 = dejarlo del todo). */
export const QUIT_TEMPLATES: HabitInput[] = [
  { name: 'Dejar de fumar', icon: 'logo-no-smoking', color: '#2EC4B6', categories: ['salud'], kind: 'quit', timeOfDay: 'anytime', goal: { period: 'day', count: 0 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Sin azúcar', icon: 'ice-cream', color: '#F97316', categories: ['nutricion'], kind: 'quit', timeOfDay: 'anytime', goal: { period: 'day', count: 0 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Menos café', icon: 'cafe', color: '#F59E0B', categories: ['salud'], kind: 'quit', timeOfDay: 'anytime', goal: { period: 'day', count: 2 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Menos redes sociales', icon: 'phone-portrait', color: '#6366F1', categories: ['mente'], kind: 'quit', timeOfDay: 'anytime', goal: { period: 'day', count: 60 }, unit: 'min', days: ALL_DAYS, reminders: [] },
  { name: 'Sin alcohol', icon: 'wine', color: '#EC4899', categories: ['salud'], kind: 'quit', timeOfDay: 'anytime', goal: { period: 'day', count: 0 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Menos comida rápida', icon: 'fast-food', color: '#EF4444', categories: ['nutricion'], kind: 'quit', timeOfDay: 'anytime', goal: { period: 'week', count: 1 }, unit: null, days: ALL_DAYS, reminders: [] },
];
