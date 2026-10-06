import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui';
import { addDays, addMonths, DateKey, fromKey, startOfWeek, toKey, WEEKDAY_LABELS } from '@/lib/dates';
import { useTheme } from '@/theme';

type Props = {
  /** Fecha elegida, o null = sin fecha. */
  value: DateKey | null;
  onChange: (value: DateKey | null) => void;
  /** Primer día que se puede elegir (para plazos, hoy). */
  minKey?: DateKey;
  /** Último día que se puede elegir (para registrar algo pasado, hoy). */
  maxKey?: DateKey;
  /** Atajos; por defecto, plazos desde `minKey`. */
  presets?: { label: string; key: DateKey }[];
  /** Ofrecer "Sin fecha". */
  allowNone?: boolean;
  color: string;
};

/** Atajos habituales para un plazo, calculados desde `today`. */
export function datePresets(today: DateKey): { label: string; key: DateKey }[] {
  const t = fromKey(today);
  return [
    { label: 'En 1 mes', key: toKey(addMonths(t, 1)) },
    { label: 'En 3 meses', key: toKey(addMonths(t, 3)) },
    { label: 'En 6 meses', key: toKey(addMonths(t, 6)) },
    { label: 'Fin de año', key: toKey(new Date(t.getFullYear(), 11, 31)) },
    { label: 'En 1 año', key: toKey(addMonths(t, 12)) },
  ];
}

/** Elige una fecha dentro de unos límites: atajos y un calendario para un día concreto. */
export function DatePicker({ value, onChange, minKey, maxKey, presets: customPresets, allowNone = true, color }: Props) {
  const theme = useTheme();
  const presets = customPresets ?? (minKey ? datePresets(minKey) : []);
  const isPreset = presets.some((p) => p.key === value);
  const [showCalendar, setShowCalendar] = useState(value != null && !isPreset);
  // Mes que se ve en el calendario: el de la fecha elegida, o el actual.
  const [month, setMonth] = useState(() => {
    const d = fromKey(value ?? maxKey ?? minKey ?? toKey(new Date()));
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const monthStart = (key: DateKey) => {
    const d = fromKey(key);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };
  const canGoBack = !minKey || month > monthStart(minKey);
  const canGoForward = !maxKey || month < monthStart(maxKey);

  const weeks = useMemo(() => {
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const rows: Date[][] = [];
    for (let w = startOfWeek(month); w <= last; w = addDays(w, 7)) rows.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
    return rows;
  }, [month]);

  const title = month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.gap}>
      <View style={styles.wrap}>
        {allowNone && (
          <Chip
            label="Sin fecha"
            color={color}
            selected={value == null}
            onPress={() => {
              setShowCalendar(false);
              onChange(null);
            }}
          />
        )}
        {presets.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            color={color}
            selected={!showCalendar && value === p.key}
            onPress={() => {
              setShowCalendar(false);
              onChange(p.key);
            }}
          />
        ))}
        <Chip
          label="Elegir día"
          icon="calendar-outline"
          color={color}
          selected={showCalendar}
          onPress={() => setShowCalendar(true)}
        />
      </View>

      {showCalendar && (
        <View style={[styles.calendar, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Pressable
              onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              disabled={!canGoBack}
              hitSlop={10}
              accessibilityLabel="Mes anterior"
            >
              <Ionicons name="chevron-back" size={20} color={canGoBack ? theme.text : theme.border} />
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>{title.charAt(0).toUpperCase() + title.slice(1)}</Text>
            <Pressable
              onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              disabled={!canGoForward}
              hitSlop={10}
              accessibilityLabel="Mes siguiente"
            >
              <Ionicons name="chevron-forward" size={20} color={canGoForward ? theme.text : theme.border} />
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
                if (d.getMonth() !== month.getMonth()) return <View key={key} style={styles.cell} />;
                const outside = (minKey != null && key < minKey) || (maxKey != null && key > maxKey);
                const selected = key === value;
                return (
                  <Pressable
                    key={key}
                    disabled={outside}
                    onPress={() => onChange(key)}
                    accessibilityLabel={`Elegir ${key}`}
                    accessibilityState={{ selected, disabled: outside }}
                    style={styles.cell}
                  >
                    <View style={[styles.day, selected && { backgroundColor: color }]}>
                      <Text style={[styles.dayText, { color: selected ? '#FFFFFF' : outside ? theme.border : theme.text }]}>
                        {d.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  calendar: { borderRadius: 16, padding: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  cell: { flex: 1, height: 36, padding: 2 },
  day: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '600' },
});
