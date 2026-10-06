import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from '@/components/ProgressRing';
import { addDays, DateKey, fromKey, toKey, WEEKDAY_LABELS, weekdayIndex } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { cardStyle, inkOn, useTheme } from '@/theme';

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
            style={[styles.day, isSelected ? { backgroundColor: theme.primary } : cardStyle(theme)]}
          >
            <Text style={[styles.weekday, { color: isSelected ? inkOn(theme.primary) : theme.muted }]}>
              {WEEKDAY_LABELS[weekdayIndex(d)]}
            </Text>
            <ProgressRing
              size={32}
              strokeWidth={3}
              progress={progress ?? 0}
              color={isSelected ? inkOn(theme.primary) : theme.primary}
              trackColor={progress == null ? 'transparent' : isSelected ? '#FFFFFF40' : theme.surface}
            >
              <Text style={[styles.number, { color: isSelected ? inkOn(theme.primary) : theme.text }, isSelected && styles.bold]}>
                {d.getDate()}
              </Text>
            </ProgressRing>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  day: { alignItems: 'center', gap: 5, paddingVertical: 9, borderRadius: 16, flex: 1 },
  weekday: { fontSize: 11, fontWeight: '700' },
  number: { fontSize: 13, fontWeight: '600' },
  bold: { fontWeight: '800' },
});
