import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, ViewStyle } from 'react-native';

const light = {
  dark: false,
  bg: '#F3F5F8',
  card: '#FFFFFF',
  /** Fondo de chips, segmentos y controles secundarios. */
  surface: '#EEF1F5',
  text: '#111827',
  muted: '#6B7280',
  border: '#E3E7ED',
  primary: '#1F883D',
  /** Relleno con texto blanco encima (en oscuro, el verde principal es demasiado claro para el blanco). */
  primaryFill: '#1F883D',
  danger: '#CF222E',
  /** Avisos (presupuesto cerca del tope, kilometraje raro). */
  warning: '#B45309',
  /** Sufijo alfa (hex) para las celdas vacías del heatmap y fondos tintados. */
  emptyAlpha: '24',
  /** Sombra suave de las tarjetas (en oscuro, el borde hace ese papel). */
  shadow: '0px 1px 2px rgba(16, 24, 40, 0.04), 0px 4px 14px rgba(16, 24, 40, 0.06)',
  /** Degradados de las tarjetas principales (de arriba a la izquierda a abajo a la derecha). */
  heroHabits: ['#166534', '#22A355'] as [string, string],
  heroFinance: ['#2B2A7A', '#4F46E5'] as [string, string],
};

const dark: typeof light = {
  dark: true,
  bg: '#0B0F14',
  card: '#151A21',
  surface: '#1F262F',
  text: '#E6EDF3',
  muted: '#8B949E',
  border: '#262E38',
  primary: '#3FB950',
  primaryFill: '#238636',
  danger: '#F85149',
  warning: '#E3A008',
  emptyAlpha: '30',
  shadow: 'none',
  heroHabits: ['#0F3D22', '#1A7A3C'],
  heroFinance: ['#1D1B4F', '#3B35B5'],
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Estilo común de las tarjetas: sombra en claro, borde fino en oscuro. */
export function cardStyle(theme: Theme): ViewStyle {
  return theme.dark
    ? { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }
    : { backgroundColor: theme.card, borderWidth: 0, boxShadow: theme.shadow };
}

/** Colores de hábito en hex de 6 dígitos (se les añade alfa para las celdas vacías). */
export const HABIT_COLORS = [
  '#39D353', '#2EC4B6', '#3B82F6', '#6366F1',
  '#A855F7', '#EC4899', '#EF4444', '#F97316',
  '#F59E0B', '#EAB308', '#84CC16', '#64748B',
];

/**
 * Paleta categórica de las gráficas (validada para daltonismo en este orden, en claro y en
 * oscuro): azul, naranja, aguamarina, amarillo, magenta, verde, violeta, rojo. Cada categoría y
 * cada plataforma tiene la suya fija; el gris es para "Otros".
 */
export const CHART_LIGHT = ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#4A3AA7', '#E34948'];
const CHART_DARK = ['#3987E5', '#D95926', '#199E70', '#C98500', '#D55181', '#008300', '#9085E9', '#E66767'];
export const CHART_OTHER = '#8A8F98';

/** El mismo color con el paso que le toca en modo oscuro (los que no son de la paleta, tal cual). */
export function chartColor(hex: string, theme: Theme): string {
  if (!theme.dark) return hex;
  const i = CHART_LIGHT.indexOf(hex.toUpperCase());
  return i >= 0 ? CHART_DARK[i] : hex;
}

/** Color fijo por posición (plataformas): sigue el orden de la paleta; pasado el 8.º, gris. */
export function slotColor(index: number, theme: Theme): string {
  const hex = CHART_LIGHT[index] ?? CHART_OTHER;
  return chartColor(hex, theme);
}

export type IconName = keyof typeof Ionicons.glyphMap;

export const HABIT_ICONS: IconName[] = [
  'barbell', 'walk', 'bicycle', 'body', 'fitness', 'basketball',
  'water', 'nutrition', 'restaurant', 'cafe', 'ban', 'medkit',
  'bed', 'moon', 'sunny', 'leaf', 'heart', 'happy',
  'book', 'school', 'language', 'code-slash', 'pencil', 'brush',
  'color-palette', 'musical-notes', 'camera', 'game-controller', 'cash', 'wallet',
  'briefcase', 'laptop', 'phone-portrait', 'home', 'paw', 'people',
  'call', 'chatbubbles', 'airplane', 'flame', 'star', 'sparkles',
  'logo-no-smoking', 'wine', 'beer', 'fast-food', 'ice-cream', 'tv',
];

/**
 * Blanco o tinta para un icono o texto sobre un color de relleno: el que se lea mejor
 * (con blanco, el amarillo o el aguamarina no llegan a 3:1).
 */
export function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.3 ? '#111827' : '#FFFFFF';
}

/** Añade opacidad (0-1) a un color hex de 6 dígitos. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255);
  return hex + a.toString(16).padStart(2, '0');
}
