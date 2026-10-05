import { StyleSheet, Text, View } from 'react-native';

import { WEEKDAY_LABELS } from '@/lib/dates';
import { formatAmount } from '@/lib/habit';
import { useTheme } from '@/theme';

type Props = {
  counts: number[];
  color: string;
  /** Texto de cada valor (por defecto, el número en formato español). */
  formatValue?: (value: number) => string;
};

/** Barras con las veces completado (o la cantidad registrada) por día de la semana. */
export function WeekdayChart({ counts, color, formatValue = formatAmount }: Props) {
  const theme = useTheme();
  const max = Math.max(...counts, 1);
  const best = counts.indexOf(Math.max(...counts));
  return (
    <View style={styles.row}>
      {counts.map((c, i) => (
        <View key={WEEKDAY_LABELS[i]} style={styles.col}>
          <Text style={[styles.value, { color: theme.muted }]} numberOfLines={1}>{formatValue(c)}</Text>
          <View style={[styles.track, { backgroundColor: color + theme.emptyAlpha }]}>
            <View style={[styles.bar, { height: `${(c / max) * 100}%`, backgroundColor: color, opacity: i === best && c > 0 ? 1 : 0.7 }]} />
          </View>
          <Text style={[styles.label, { color: i === best && c > 0 ? theme.text : theme.muted }]}>{WEEKDAY_LABELS[i]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, height: 130 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  value: { fontSize: 11, fontWeight: '600' },
  track: { flex: 1, width: '100%', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8 },
  label: { fontSize: 12, fontWeight: '700' },
});
