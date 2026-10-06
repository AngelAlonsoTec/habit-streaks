import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type Props = {
  size: number;
  strokeWidth: number;
  /** 0 a 1 */
  progress: number;
  color: string;
  trackColor: string;
  /**
   * Círculo relleno dentro del anillo (con un hueco de 2 px). Va en el SVG y no como fondo de una
   * vista: en Android, una vista que gana fondo después de montarse puede perder el redondeo.
   */
  fill?: string;
  children?: ReactNode;
};

export function ProgressRing({ size, strokeWidth, progress, color, trackColor, fill, children }: Props) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const p = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {fill && <Circle cx={size / 2} cy={size / 2} r={r - strokeWidth / 2 - 2} fill={fill} />}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {p > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - p)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
