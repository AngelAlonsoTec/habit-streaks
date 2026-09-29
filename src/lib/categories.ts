import type { IconName } from '@/theme';

export type Category = { id: string; name: string; icon: IconName };

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'salud', name: 'Salud', icon: 'heart' },
  { id: 'ejercicio', name: 'Ejercicio', icon: 'barbell' },
  { id: 'nutricion', name: 'Nutrición', icon: 'nutrition' },
  { id: 'sueno', name: 'Sueño', icon: 'bed' },
  { id: 'mente', name: 'Mente', icon: 'leaf' },
  { id: 'aprendizaje', name: 'Aprendizaje', icon: 'school' },
  { id: 'lectura', name: 'Lectura', icon: 'book' },
  { id: 'arte', name: 'Arte', icon: 'color-palette' },
  { id: 'musica', name: 'Música', icon: 'musical-notes' },
  { id: 'finanzas', name: 'Finanzas', icon: 'cash' },
  { id: 'trabajo', name: 'Trabajo', icon: 'briefcase' },
  { id: 'hogar', name: 'Hogar', icon: 'home' },
  { id: 'social', name: 'Social', icon: 'people' },
  { id: 'autocuidado', name: 'Autocuidado', icon: 'sparkles' },
  { id: 'dejar', name: 'Dejar un vicio', icon: 'ban' },
];
