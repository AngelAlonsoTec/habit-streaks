import { useId } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * Fondo de las pantallas principales: tres manchas de color muy suaves (arriba, a un lado y más
 * abajo) sobre el color de fondo, para que no se vea plano sin quitarle protagonismo a las tarjetas.
 * Va detrás de todo y no recibe toques.
 */
export function ScreenBackdrop({ colors }: { colors: [string, string, string] }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  // useId trae ":" y otros caracteres que no valen en un id de SVG.
  const id = `b${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const strength = theme.dark ? 1.2 : 1;
  const blobs = [
    { x: width * 0.08, y: -height * 0.04, r: width * 1.05, color: colors[0], opacity: 0.12 * strength },
    { x: width * 1.02, y: height * 0.16, r: width * 0.85, color: colors[1], opacity: 0.09 * strength },
    { x: width * 0.05, y: height * 0.78, r: width * 0.95, color: colors[2], opacity: 0.055 * strength },
  ];
  return (
    <View style={styles.fill}>
      <Svg width={width} height={height}>
        <Defs>
          {blobs.map((b, i) => (
            <RadialGradient key={i} id={`${id}${i}`} cx={b.x} cy={b.y} r={b.r} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
              <Stop offset="1" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blobs.map((_, i) => (
          <Rect key={i} x="0" y="0" width={width} height={height} fill={`url(#${id}${i})`} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' },
});
