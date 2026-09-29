import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';

const light = {
  dark: false,
  bg: '#F6F8FA',
  card: '#FFFFFF',
  /** Fondo de chips, segmentos y controles secundarios. */
  surface: '#EEF1F4',
  text: '#1F2328',
  muted: '#656D76',
  border: '#D8DEE4',
  primary: '#1F883D',
  danger: '#CF222E',
  /** Sufijo alfa (hex) para las celdas vacías del heatmap y fondos tintados. */
  emptyAlpha: '24',
};

const dark: typeof light = {
  dark: true,
  bg: '#0D1117',
  card: '#161B22',
  surface: '#21262D',
  text: '#E6EDF3',
  muted: '#8B949E',
  border: '#30363D',
  primary: '#3FB950',
  danger: '#F85149',
  emptyAlpha: '30',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Colores de hábito en hex de 6 dígitos (se les añade alfa para las celdas vacías). */
export const HABIT_COLORS = [
  '#39D353', '#2EC4B6', '#3B82F6', '#6366F1',
  '#A855F7', '#EC4899', '#EF4444', '#F97316',
  '#F59E0B', '#EAB308', '#84CC16', '#64748B',
];

export type IconName = keyof typeof Ionicons.glyphMap;

export const HABIT_ICONS: IconName[] = [
  'barbell', 'walk', 'bicycle', 'body', 'fitness', 'basketball',
  'water', 'nutrition', 'restaurant', 'cafe', 'ban', 'medkit',
  'bed', 'moon', 'sunny', 'leaf', 'heart', 'happy',
  'book', 'school', 'language', 'code-slash', 'pencil', 'brush',
  'color-palette', 'musical-notes', 'camera', 'game-controller', 'cash', 'wallet',
  'briefcase', 'laptop', 'phone-portrait', 'home', 'paw', 'people',
  'call', 'chatbubbles', 'airplane', 'flame', 'star', 'sparkles',
];

/** Añade opacidad (0-1) a un color hex de 6 dígitos. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255);
  return hex + a.toString(16).padStart(2, '0');
}
