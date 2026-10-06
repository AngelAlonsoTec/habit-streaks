import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export type Bar = { label: string; value: number | null; current?: boolean };

type Props = {
  bars: Bar[];
  color: string;
  /** Muestra la etiqueta solo en una de cada N barras (para meses con 30 días). */
  labelEvery?: number;
  height?: number;
};

/** Barras de 0 a 100 %. Las barras sin dato (null) se dejan vacías; la actual se resalta. */
export function BarChart({ bars, color, labelEvery = 1, height = 140 }: Props) {
  const theme = useTheme();
  const gap = bars.length > 20 ? 2 : 6;
  return (
    <View>
      <View style={[styles.plot, { height, gap }]}>
        {[0.5, 1].map((line) => (
          <View
            key={line}
            style={[styles.gridLine, { bottom: height * line, borderColor: theme.border }]}
          />
        ))}
        {bars.map((b, i) => (
          <View key={i} style={styles.column} accessibilityLabel={`${b.label}: ${b.value == null ? 'sin datos' : `${b.value} %`}`}>
            <View style={[styles.track, { backgroundColor: b.value == null ? 'transparent' : color + theme.emptyAlpha }]}>
              {b.value != null && b.value > 0 && (
                <View
                  style={[
                    styles.bar,
                    { height: `${b.value}%`, backgroundColor: color, opacity: b.current ? 1 : 0.8 },
                  ]}
                />
              )}
            </View>
          </View>
        ))}
      </View>
      <View style={[styles.labels, { gap }]}>
        {bars.map((b, i) => (
          <Text
            key={i}
            numberOfLines={1}
            style={[styles.label, { color: b.current ? theme.text : theme.muted }, b.current && styles.bold]}
          >
            {i % labelEvery === 0 || b.current ? b.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end' },
  gridLine: {
    position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, pointerEvents: 'none',
  },
  column: { flex: 1, height: '100%', alignItems: 'center' },
  // Barras finas (≤ 24 px), con el extremo redondeado y la base recta.
  track: { flex: 1, width: '100%', maxWidth: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  labels: { flexDirection: 'row', marginTop: 6 },
  label: { flex: 1, fontSize: 10, textAlign: 'center' },
  bold: { fontWeight: '800' },
});
