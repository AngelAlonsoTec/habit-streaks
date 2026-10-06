import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export type DonutSegment = { key: string; value: number; color: string };

type Props = {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** Color del anillo vacío (sin datos). */
  trackColor: string;
  /** Lo que va en el centro (el total). */
  children?: ReactNode;
  accessibilityLabel: string;
};

/** Hueco entre segmentos, en px: separa por el color del fondo, sin bordes. */
const GAP = 2;

/** Dona de parte-del-todo. Pocos segmentos (≤ 5): el resto se agrupa antes en "Otros". */
export function DonutChart({ segments, size = 152, thickness = 18, trackColor, children, accessibilityLabel }: Props) {
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? GAP : 0;
  let start = 0;

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={thickness} fill="none" />
        {total > 0 &&
          visible.map((s) => {
            const length = (s.value / total) * circumference;
            const offset = start;
            start += length;
            return (
              <Circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={s.color}
                strokeWidth={thickness}
                fill="none"
                strokeDasharray={`${Math.max(length - gap, 0.01)} ${circumference}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
          })}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
