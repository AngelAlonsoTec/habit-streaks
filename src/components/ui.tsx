import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { IconName, useTheme } from '@/theme';

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
  const fg = selected ? '#FFFFFF' : theme.text;
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
            style={[styles.segment, selected && { backgroundColor: theme.card, boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)' }]}
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

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>{children}</View>
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
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segment: {
    flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 10,
  },
  segmentText: { fontSize: 14 },
  bold: { fontWeight: '700' },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
});
