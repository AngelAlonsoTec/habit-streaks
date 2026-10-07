import { Ionicons } from '@expo/vector-icons';
import { Children, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { cardStyle, IconName, inkOn, useTheme } from '@/theme';

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>{children}</Text>
      {right}
    </View>
  );
}

type ChipProps = {
  label: string;
  icon?: IconName;
  selected?: boolean;
  color?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
};

export function Chip({ label, icon, selected, color, onPress, onLongPress, accessibilityLabel }: ChipProps) {
  const theme = useTheme();
  const accent = color ?? theme.primary;
  const fg = selected ? inkOn(accent) : theme.text;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? accent : theme.surface, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {icon && <Ionicons name={icon} size={15} color={fg} />}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Chips en dos filas como mucho: si hay más de los que caben, se deslizan de lado (en vez de
 * apilarse en muchas filas). Con tres o menos, una sola fila.
 */
export function ChipRows({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const half = Math.ceil(items.length / 2);
  const rows = items.length <= 3 ? [items] : [items.slice(0, half), items.slice(half)];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.chipRows}>
        {rows.map((row, i) => (
          <View key={i} testID="chip-row" style={styles.chipRow}>{row}</View>
        ))}
      </View>
    </ScrollView>
  );
}

type SegmentedProps<T extends string> = {
  value: T;
  options: { value: T; label: string; icon?: IconName }[];
  onChange: (value: T) => void;
  color?: string;
  style?: ViewStyle;
};

export function Segmented<T extends string>({ value, options, onChange, color, style }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surface }, style]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              selected && { backgroundColor: theme.dark ? theme.border : theme.card, boxShadow: '0px 1px 3px rgba(16, 24, 40, 0.12)' },
            ]}
          >
            {o.icon && <Ionicons name={o.icon} size={16} color={selected ? color ?? theme.text : theme.muted} />}
            <Text
              numberOfLines={1}
              style={[styles.segmentText, { color: selected ? theme.text : theme.muted }, selected && styles.bold]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Botón redondo de icono para los encabezados propios de las pestañas. */
export function HeaderButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: theme.surface }]}
    >
      <Ionicons name={icon} size={23} color={theme.text} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, cardStyle(theme), style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  chipRows: { gap: 8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  segmented: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  segment: {
    flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 11,
  },
  segmentText: { fontSize: 14 },
  bold: { fontWeight: '700' },
  headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 20, padding: 16 },
});
