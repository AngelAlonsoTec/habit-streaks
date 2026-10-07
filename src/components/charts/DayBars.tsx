import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AxisLabels } from '@/components/charts/AxisLabels';
import { SelectedBand } from '@/components/charts/SelectedBand';
import { niceCeil } from '@/components/charts/scale';
import { useTheme } from '@/theme';

export type DayFlow = {
  key: string;
  /** Etiqueta bajo la columna ("L", "15"). */
  label: string;
  /** La etiqueta solo se ve al elegir la columna (en el mes se rotulan 1, 5, 10…). */
  hideLabel?: boolean;
  /** Para el lector de pantalla: "Martes 6". */
  name: string;
  income: number;
  expense: number;
};

type Props = {
  days: DayFlow[];
  incomeColor: string;
  expenseColor: string;
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Formato de las cantidades (accesibilidad). */
  format: (n: number) => string;
  /** Formato corto de los topes del eje ("$2k"). */
  formatTick?: (n: number) => string;
  height?: number;
};

/**
 * Ingresos hacia arriba y gastos hacia abajo de una misma línea base, con una sola escala:
 * la posición dice qué es cada cosa (el color solo acompaña). Tocar un día lo resalta.
 */
export function DayBars({ days, incomeColor, expenseColor, selected, onSelect, format, formatTick = format, height = 150 }: Props) {
  const theme = useTheme();
  const maxIncome = niceCeil(Math.max(0, ...days.map((d) => d.income)));
  const maxExpense = niceCeil(Math.max(0, ...days.map((d) => d.expense)));
  const range = maxIncome + maxExpense || 1;
  const top = (height * maxIncome) / range;
  const bottom = height - top;
  const dense = days.length > 14;

  return (
    <View>
      <View style={[styles.plot, { height }]}>
        {/* Rejilla: los dos topes y la línea base, finas y discretas. */}
        {maxIncome > 0 && <View style={[styles.grid, { top: 0, backgroundColor: theme.border }]} />}
        {maxExpense > 0 && <View style={[styles.grid, { top: height - 1, backgroundColor: theme.border }]} />}
        <View style={[styles.grid, styles.baseline, { top, backgroundColor: theme.muted }]} />
        {maxIncome > 0 && <Text style={[styles.tick, { top: 2, color: theme.muted }]}>{formatTick(maxIncome)}</Text>}
        {maxExpense > 0 && <Text style={[styles.tick, { bottom: 2, color: theme.muted }]}>−{formatTick(maxExpense)}</Text>}

        <View style={[styles.columns, { gap: dense ? 2 : 8 }]}>
          {days.map((d) => {
            const dimmed = selected != null && selected !== d.key;
            return (
              <Pressable
                key={d.key}
                onPress={() => onSelect(selected === d.key ? null : d.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === d.key }}
                accessibilityLabel={`${d.name}: ingresos ${format(d.income)}, gastos ${format(d.expense)}`}
                style={[styles.column, { opacity: dimmed ? 0.35 : 1 }]}
              >
                {selected === d.key && <SelectedBand gap={dense ? 2 : 8} />}
                <View style={[styles.half, styles.up, { height: top }]}>
                  {d.income > 0 && (
                    <View
                      style={[
                        styles.bar,
                        styles.barUp,
                        { height: Math.max(2, (d.income / maxIncome) * top), backgroundColor: incomeColor },
                      ]}
                    />
                  )}
                </View>
                <View style={[styles.half, { height: bottom }]}>
                  {d.expense > 0 && (
                    <View
                      style={[
                        styles.bar,
                        styles.barDown,
                        { height: Math.max(2, (d.expense / maxExpense) * bottom), backgroundColor: expenseColor },
                      ]}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <AxisLabels
        labels={days.map((d) => ({ key: d.key, text: d.label, selected: selected === d.key, hidden: d.hideLabel }))}
        gutter={44}
        gap={dense ? 2 : 8}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { position: 'relative' },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  baseline: { height: 1 },
  tick: { position: 'absolute', left: 0, fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  columns: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', paddingLeft: 44 },
  column: { flex: 1, alignItems: 'center' },
  half: { width: '100%', alignItems: 'center' },
  up: { justifyContent: 'flex-end' },
  // Barras finas (≤ 24 px) con el extremo de datos redondeado y la base recta.
  bar: { width: '72%', maxWidth: 24 },
  barUp: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barDown: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
});
