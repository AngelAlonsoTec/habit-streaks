import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

type Props = {
  /** Valores en orden; pueden ser menos que `slots` (el periodo aún no termina). */
  values: number[];
  /** Puntos que tendrá el periodo completo: la línea avanza hasta donde va. */
  slots: number;
  color: string;
  /** Color del aro del punto final (el fondo sobre el que va). */
  ringColor: string;
  /** Línea del cero, si la línea lo cruza. */
  zeroColor: string;
  height?: number;
  accessibilityLabel: string;
};

const PAD = 6;

/** Línea de 2 px con un velo suave debajo y el último punto marcado (tendencia del balance). */
export function Sparkline({ values, slots, color, ringColor, zeroColor, height = 56, accessibilityLabel }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const step = slots > 1 ? (width - PAD * 2) / (slots - 1) : 0;
  const x = (i: number) => PAD + i * step;
  const y = (v: number) => PAD + (1 - (v - min) / span) * (height - PAD * 2);

  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = values.length > 1 ? `${line} L${x(values.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';
  const last = values.length - 1;

  return (
    <View onLayout={onLayout} style={{ height }} accessible accessibilityLabel={accessibilityLabel}>
      {width > 0 && values.length > 0 && (
        <Svg width={width} height={height}>
          {min < 0 && max > 0 && <Line x1={PAD} x2={width - PAD} y1={y(0)} y2={y(0)} stroke={zeroColor} strokeWidth={1} />}
          {area !== '' && <Path d={area} fill={color} fillOpacity={0.14} />}
          {values.length > 1 && <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
          <Circle cx={x(last)} cy={y(values[last])} r={6} fill={ringColor} />
          <Circle cx={x(last)} cy={y(values[last])} r={4} fill={color} />
        </Svg>
      )}
    </View>
  );
}
