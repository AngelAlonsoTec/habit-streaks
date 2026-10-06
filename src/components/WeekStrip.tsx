import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from '@/components/ProgressRing';
import { addDays, DateKey, fromKey, toKey, WEEKDAY_LABELS, weekdayIndex } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { cardStyle, useTheme } from '@/theme';

type Props = {
  selected: DateKey;
  onSelect: (day: DateKey) => void;
  /** Progreso (0-1) de cada día, o null si ese día no había nada programado. */
  progressFor: (day: Date) => number | null;
};

/**
 * Los últimos 7 días, para ver y marcar días anteriores. Una sola tarjeta: cada día con su anillo
 * de progreso; el elegido, con la inicial en color y el número en un círculo relleno; los completos,
 * con el anillo cerrado y el número en color; hoy, con un punto debajo.
 */
export function WeekStrip({ selected, onSelect, progressFor }: Props) {
  const theme = useTheme();
  const todayKey = useToday();
  const today = fromKey(todayKey);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <View style={[styles.strip, cardStyle(theme)]}>
      {days.map((d) => {
        const key = toKey(d);
        const isSelected = key === selected;
        const progress = progressFor(d);
        const done = progress === 1;
        const numberColor = isSelected ? '#FFFFFF' : done ? theme.primary : progress == null ? theme.muted : theme.text;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Ver ${key}`}
            // Sin fondo de columna (se veía como un cuadro): el círculo relleno ya marca el día elegido.
            style={({ pressed }) => [styles.day, pressed && styles.pressed]}
          >
            <Text style={[styles.weekday, { color: isSelected ? theme.primary : theme.muted }]}>
              {WEEKDAY_LABELS[weekdayIndex(d)]}
            </Text>
            <ProgressRing
              size={38}
              strokeWidth={3}
              progress={progress ?? 0}
              color={theme.primary}
              trackColor={progress == null ? 'transparent' : theme.surface}
            >
              {/* Día completo: además del anillo cerrado, un relleno tenue (como un logro). */}
              <View
                style={[
                  styles.inner,
                  isSelected ? { backgroundColor: theme.primaryFill } : done && { backgroundColor: theme.primary + (theme.dark ? '29' : '1A') },
                ]}
              >
                <Text style={[styles.number, { color: numberColor }, (isSelected || done) && styles.bold]}>{d.getDate()}</Text>
              </View>
            </ProgressRing>
            <View style={[styles.todayDot, { backgroundColor: key === todayKey ? theme.primary : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', borderRadius: 22, paddingHorizontal: 6, paddingVertical: 6 },
  day: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 9, paddingBottom: 7 },
  pressed: { opacity: 0.6 },
  weekday: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  inner: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 13.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '800' },
  todayDot: { width: 4, height: 4, borderRadius: 2 },
});
