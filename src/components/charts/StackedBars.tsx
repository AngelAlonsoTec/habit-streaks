import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AxisLabels } from '@/components/charts/AxisLabels';
import { niceCeil } from '@/components/charts/scale';
import { useTheme } from '@/theme';

/** `amount` y no `value`: un estilo con `x.value` lo toma por un valor animado al compilar. */
export type StackPart = { key: string; amount: number; color: string };
export type StackedDay = { key: string; label: string; name: string; parts: StackPart[] };

type Props = {
  days: StackedDay[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  format: (n: number) => string;
  formatTick?: (n: number) => string;
  height?: number;
};

/** Columnas apiladas por día (lo que dejó cada app), con 2 px de hueco entre trozos. */
export function StackedBars({ days, selected, onSelect, format, formatTick = format, height = 130 }: Props) {
  const theme = useTheme();
  const totals = days.map((d) => d.parts.reduce((s, p) => s + p.amount, 0));
  const max = niceCeil(Math.max(0, ...totals));
  const dense = days.length > 14;

  return (
    <View>
      <View style={[styles.plot, { height }]}>
        {max > 0 && <View style={[styles.grid, { top: 0, backgroundColor: theme.border }]} />}
        <View style={[styles.grid, { bottom: 0, backgroundColor: theme.muted }]} />
        {max > 0 && <Text style={[styles.tick, { color: theme.muted }]}>{formatTick(max)}</Text>}
        <View style={[styles.columns, { gap: dense ? 2 : 8 }]}>
          {days.map((d, i) => {
            const parts = d.parts.filter((p) => p.amount > 0);
            const dimmed = selected != null && selected !== d.key;
            return (
              <Pressable
                key={d.key}
                onPress={() => onSelect(selected === d.key ? null : d.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === d.key }}
                accessibilityLabel={`${d.name}: ${totals[i] ? parts.map((p) => `${p.key} ${format(p.amount)}`).join(', ') : 'sin jornada'}`}
                style={[styles.column, { opacity: dimmed ? 0.35 : 1 }]}
              >
                {max > 0 && totals[i] > 0 && (
                  <View style={[styles.stack, { height: Math.max(2, (totals[i] / max) * (height - 1)) }]}>
                    {/* De arriba abajo: la primera app queda en la base. */}
                    {[...parts].reverse().map((p, j) => (
                      <View
                        key={p.key}
                        style={[
                          { flex: p.amount, backgroundColor: p.color, minHeight: 2 },
                          j === 0 && styles.cap,
                          j > 0 && styles.gap,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
      <AxisLabels
        labels={days.map((d) => ({ key: d.key, text: d.label, selected: selected === d.key }))}
        gutter={44}
        gap={dense ? 2 : 8}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { position: 'relative' },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  tick: { position: 'absolute', left: 0, top: 2, fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  columns: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 44 },
  column: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  stack: { width: '72%', maxWidth: 24 },
  cap: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  gap: { marginTop: 2 },
});
