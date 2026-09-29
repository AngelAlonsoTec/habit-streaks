import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cellColor } from '@/components/Heatmap';
import { addDays, DateKey, fromKey, startOfWeek, toKey, todayKey, WEEKDAY_LABELS } from '@/lib/dates';
import { useTheme } from '@/theme';

type Props = {
  counts?: Record<DateKey, number>;
  color: string;
  target: number;
  isScheduled: (date: Date) => boolean;
  onPressDay: (day: DateKey) => void;
  onLongPressDay: (day: DateKey) => void;
};

export function MonthCalendar({ counts, color, target, isScheduled, onPressDay, onLongPressDay }: Props) {
  const theme = useTheme();
  const today = todayKey();
  const [offset, setOffset] = useState(0);

  const { title, weeks, month } = useMemo(() => {
    const t = fromKey(today);
    const first = new Date(t.getFullYear(), t.getMonth() + offset, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const rows: Date[][] = [];
    for (let ws = startOfWeek(first); ws <= last; ws = addDays(ws, 7)) {
      rows.push(Array.from({ length: 7 }, (_, i) => addDays(ws, i)));
    }
    const label = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return { title: label.charAt(0).toUpperCase() + label.slice(1), weeks: rows, month: first.getMonth() };
  }, [today, offset]);

  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={10} accessibilityLabel="Mes anterior">
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Pressable
          onPress={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset === 0}
          hitSlop={10}
          accessibilityLabel="Mes siguiente"
        >
          <Ionicons name="chevron-forward" size={22} color={offset === 0 ? theme.border : theme.text} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {WEEKDAY_LABELS.map((l) => (
          <Text key={l} style={[styles.weekday, { color: theme.muted }]}>{l}</Text>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={toKey(week[0])} style={styles.row}>
          {week.map((d) => {
            const key = toKey(d);
            const inMonth = d.getMonth() === month;
            const future = key > today;
            if (!inMonth) return <View key={key} style={styles.cell} />;
            const count = counts?.[key] ?? 0;
            const progress = count / target;
            const scheduled = isScheduled(d);
            const bg = progress > 0 ? cellColor(color, theme.emptyAlpha, progress, true) : 'transparent';
            const fg = progress >= 1 ? '#FFFFFF' : future || !scheduled ? theme.muted : theme.text;
            return (
              <Pressable
                key={key}
                disabled={future}
                onPress={() => onPressDay(key)}
                onLongPress={() => onLongPressDay(key)}
                accessibilityLabel={`${key}${count ? `, ${count} ${count === 1 ? 'vez' : 'veces'}` : ''}`}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.circle,
                    { backgroundColor: bg },
                    key === today && { borderWidth: 2, borderColor: color },
                    !scheduled && progress === 0 && !future && { opacity: 0.45 },
                  ]}
                >
                  <Text style={[styles.dayText, { color: fg }, progress >= 1 && styles.bold]}>{d.getDate()}</Text>
                  {target > 1 && count > 0 && count < target && (
                    <Text style={[styles.badge, { color: theme.text }]}>{count}/{target}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  cell: { flex: 1, aspectRatio: 1, padding: 3 },
  circle: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '500' },
  bold: { fontWeight: '800' },
  badge: { fontSize: 8, fontWeight: '700', marginTop: -2 },
});
