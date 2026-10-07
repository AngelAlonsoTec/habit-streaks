import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { IconBadge, TextButton } from '@/components/finance/ui';
import { FinanceCategory, MAX_CATEGORY_LENGTH } from '@/lib/finance';
import { chartColor, useTheme } from '@/theme';

type Props = {
  /** Ya en el orden en que se quieren ver (las más usadas primero). */
  categories: FinanceCategory[];
  value: string | null;
  onChange: (id: string) => void;
  /** Si se da, la lista ofrece "Nueva categoría" (se escribe ahí mismo). */
  onCreate?: (name: string) => void;
};

/** Parte una lista en filas de dos. */
const pairs = <T,>(items: T[]): T[][] => Array.from({ length: Math.ceil(items.length / 2) }, (_, i) => items.slice(i * 2, i * 2 + 2));

/**
 * Elegir categoría como un campo de opciones: la elegida en una sola línea y, al tocarla, la lista
 * completa en dos columnas parejas. Mientras no hay ninguna elegida, la lista ya está abierta (es lo
 * siguiente que hay que hacer).
 */
export function CategoryPicker({ categories, value, onChange, onCreate }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState<string | null>(null);
  const selected = categories.find((c) => c.id === value);
  const expanded = open || !selected;

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const create = () => {
    if (newName?.trim() && onCreate) onCreate(newName);
    setNewName(null);
    setOpen(false);
  };

  return (
    <View style={styles.gap}>
      {selected && (
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`Categoría: ${selected.name}. Cambiar`}
          style={({ pressed }) => [styles.field, { backgroundColor: theme.surface, opacity: pressed ? 0.8 : 1 }]}
        >
          <IconBadge icon={selected.icon} color={chartColor(selected.color, theme)} size={32} />
          <Text style={[styles.fieldText, { color: theme.text }]} numberOfLines={1}>{selected.name}</Text>
          <Text style={[styles.change, { color: theme.muted }]}>{expanded ? 'Cerrar' : 'Cambiar'}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.muted} />
        </Pressable>
      )}

      {expanded && (
        <View style={[styles.list, { backgroundColor: theme.surface }]}>
          {pairs(categories).map((row) => (
            <View key={row[0].id} style={styles.row}>
              {row.map((c) => {
                const isSelected = c.id === value;
                const color = chartColor(c.color, theme);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => choose(c.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={c.name}
                    style={({ pressed }) => [
                      styles.option,
                      { backgroundColor: isSelected ? color + theme.emptyAlpha : theme.card, opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <IconBadge icon={c.icon} color={color} size={28} />
                    <Text style={[styles.optionText, { color: theme.text }, isSelected && styles.bold]} numberOfLines={2}>{c.name}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={color} />}
                  </Pressable>
                );
              })}
              {row.length === 1 && <View style={styles.flex} />}
            </View>
          ))}

          {onCreate && (newName == null ? (
            <Pressable
              onPress={() => setNewName('')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.option, styles.newOption, { borderColor: theme.border, opacity: pressed ? 0.75 : 1 }]}
            >
              <Ionicons name="add-circle-outline" size={22} color={theme.muted} />
              <Text style={[styles.optionText, { color: theme.muted }]}>Nueva categoría</Text>
            </Pressable>
          ) : (
            <View style={styles.newRow}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Nombre de la categoría"
                placeholderTextColor={theme.muted}
                maxLength={MAX_CATEGORY_LENGTH}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={create}
                style={[styles.input, { color: theme.text, backgroundColor: theme.card }]}
              />
              <TextButton label="Añadir" onPress={create} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 8 },
  flex: { flex: 1 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  fieldText: { flex: 1, fontSize: 16, fontWeight: '700' },
  change: { fontSize: 13, fontWeight: '600' },
  list: { borderRadius: 16, padding: 6, gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12, minHeight: 48 },
  optionText: { flex: 1, fontSize: 14, fontWeight: '600' },
  bold: { fontWeight: '800' },
  newOption: { borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, fontSize: 15, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
});
