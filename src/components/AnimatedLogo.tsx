import { useEffect, useId, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const SIZE = 3;
const CELL = 22;
const GAP = 7;
const GRID = SIZE * CELL + (SIZE - 1) * GAP;
const BOX = GRID * 2;
/** Lo pintado de cada cuadro en reposo: como el heatmap de unos días, no un bloque sólido. */
const LEVELS = [0.3, 0.55, 0.9, 0.55, 0.9, 0.3, 0.9, 0.3, 0.55];

/**
 * El símbolo de la app: una cuadrícula de días con sus tonos, por la que pasa una onda en diagonal
 * (como si se fueran cumpliendo), con un resplandor suave detrás. Si el teléfono pide menos
 * movimiento, se queda quieta.
 */
export function AnimatedLogo({ color }: { color: string }) {
  const [progress] = useState(() => new Animated.Value(0));
  // useId trae ":" y otros caracteres que no valen en un id de SVG.
  const glowId = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    );
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (active && !reduce) animation.start();
      })
      .catch(() => {});
    return () => {
      active = false;
      animation.stop();
    };
  }, [progress]);

  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={BOX} height={BOX} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.32} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={BOX} height={BOX} fill={`url(#${glowId})`} />
      </Svg>
      <View style={styles.grid}>
        {LEVELS.map((level, i) => {
          // La onda va de la esquina de arriba a la izquierda a la de abajo a la derecha.
          const delay = (((i % SIZE) + Math.floor(i / SIZE)) / (2 * (SIZE - 1))) * 0.6;
          const inputRange = [0, delay, delay + 0.2, delay + 0.4, 1];
          return (
            <Animated.View
              key={i}
              style={[
                styles.cell,
                {
                  backgroundColor: color,
                  opacity: progress.interpolate({ inputRange, outputRange: [level, level, 1, level, level] }),
                  transform: [{ scale: progress.interpolate({ inputRange, outputRange: [1, 1, 1.12, 1, 1] }) }],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center', marginVertical: -GRID / 2 },
  grid: { width: GRID, flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 7 },
});
