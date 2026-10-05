import type { HabitInput } from './habit';
import { ALL_DAYS } from './habit';

/** Sugerencias para crear un hábito con un toque. */
export const HABIT_TEMPLATES: HabitInput[] = [
  { name: 'Beber agua', icon: 'water', color: '#3B82F6', categories: ['salud', 'nutricion'], timeOfDay: 'anytime', goal: { period: 'day', count: 8 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Leer', icon: 'book', color: '#F59E0B', categories: ['lectura'], timeOfDay: 'evening', goal: { period: 'day', count: 20 }, unit: 'min', days: ALL_DAYS, reminders: ['21:30'] },
  { name: 'Meditar', icon: 'leaf', color: '#2EC4B6', categories: ['mente'], timeOfDay: 'morning', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: ['07:30'] },
  { name: 'Hacer ejercicio', icon: 'barbell', color: '#EF4444', categories: ['ejercicio', 'salud'], timeOfDay: 'afternoon', goal: { period: 'week', count: 4 }, unit: null, days: ALL_DAYS, reminders: ['18:00'] },
  { name: 'Caminar', icon: 'walk', color: '#39D353', categories: ['ejercicio'], timeOfDay: 'anytime', goal: { period: 'day', count: 10000 }, unit: 'pasos', days: ALL_DAYS, reminders: [] },
  { name: 'Correr', icon: 'fitness', color: '#2EC4B6', categories: ['ejercicio', 'salud'], timeOfDay: 'morning', goal: { period: 'week', count: 15 }, unit: 'km', days: ALL_DAYS, reminders: [] },
  { name: 'Estiramientos', icon: 'body', color: '#A855F7', categories: ['ejercicio', 'autocuidado'], timeOfDay: 'morning', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Estudiar idioma', icon: 'language', color: '#6366F1', categories: ['aprendizaje'], timeOfDay: 'anytime', goal: { period: 'day', count: 1 }, unit: null, days: [0, 1, 2, 3, 4], reminders: [] },
  { name: 'Dibujar', icon: 'brush', color: '#EC4899', categories: ['arte'], timeOfDay: 'anytime', goal: { period: 'week', count: 3 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Registrar gastos', icon: 'cash', color: '#84CC16', categories: ['finanzas'], timeOfDay: 'evening', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: ['22:00'] },
  { name: 'Dormir antes de las 23:00', icon: 'moon', color: '#64748B', categories: ['sueno', 'salud'], timeOfDay: 'evening', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: ['22:30'] },
  { name: 'Sin azúcar', icon: 'ban', color: '#F97316', categories: ['nutricion', 'dejar'], timeOfDay: 'anytime', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: [] },
  { name: 'Tomar vitaminas', icon: 'medkit', color: '#EAB308', categories: ['salud'], timeOfDay: 'morning', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: ['09:00'] },
];
