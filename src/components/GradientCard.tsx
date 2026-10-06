import { ReactNode, useId } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type Props = {
  /** Del color de arriba a la izquierda al de abajo a la derecha. */
  colors: [string, string];
  style?: ViewStyle;
  children: ReactNode;
};

/**
 * Tarjeta principal con degradado y dos círculos de luz tenues, dibujada con SVG (sin
 * dependencias nativas nuevas). El contenido va encima, en blanco.
 */
export function GradientCard({ colors, style, children }: Props) {
  // useId trae ":" y otros caracteres que no valen en un id de SVG.
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={[styles.card, { backgroundColor: colors[1] }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
        <Circle cx="92%" cy="-6%" r="34%" fill="#FFFFFF" fillOpacity={0.07} />
        <Circle cx="104%" cy="38%" r="22%" fill="#FFFFFF" fillOpacity={0.05} />
      </Svg>
      {children}
    </View>
  );
}

/** Texto sobre el degradado: blanco y blanco atenuado. */
export const ON_GRADIENT = { text: '#FFFFFF', muted: 'rgba(255, 255, 255, 0.78)', faint: 'rgba(255, 255, 255, 0.16)' };

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, overflow: 'hidden' },
});
