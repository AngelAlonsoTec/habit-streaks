import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from '@/components/ProgressRing';
import { addDays, DateKey, fromKey, toKey, WEEKDAY_LABELS, weekdayIndex } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { useTheme } from '@/theme';

type Props = {
  selected: DateKey;
  onSelect: (day: DateKey) => void;
  /** Progreso (0-1) de cada día, o null si ese día no había nada programado. */
  progressFor: (day: Date) => number | null;
};

/** Los últimos 7 días, para ver y marcar días anteriores. */
export function WeekStrip({ selected, onSelect, progressFor }: Props) {
  const theme = useTheme();
  const today = fromKey(useToday());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <View style={styles.row}>
      {days.map((d) => {
        const key = toKey(d);
        const isSelected = key === selected;
        const progress = progressFor(d);
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Ver ${key}`}
            style={[styles.day, isSelected && { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text style={[styles.weekday, { color: isSelected ? theme.text : theme.muted }]}>
              {WEEKDAY_LABELS[weekdayIndex(d)]}
            </Text>
            <ProgressRing
              size={34}
              strokeWidth={3}
              progress={progress ?? 0}
              color={theme.primary}
              trackColor={progress == null ? 'transparent' : theme.surface}
            >
              <Text style={[styles.number, { color: theme.text }, isSelected && styles.bold]}>{d.getDate()}</Text>
            </ProgressRing>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent', flex: 1,
  },
  weekday: { fontSize: 11, fontWeight: '700' },
  number: { fontSize: 13, fontWeight: '600' },
  bold: { fontWeight: '800' },
});
