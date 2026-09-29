import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmAction } from '@/lib/platform';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

export default function ArchivedScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const allHabits = useHabits((s) => s.habits);
  const setArchived = useHabits((s) => s.setArchived);
  const deleteHabit = useHabits((s) => s.deleteHabit);
  const archived = useMemo(() => allHabits.filter((h) => h.archived), [allHabits]);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <Text style={[styles.intro, { color: theme.muted }]}>
        Los hábitos archivados no aparecen en Hoy ni te envían recordatorios, pero conservan todo su historial.
      </Text>
      {archived.length === 0 && (
        <Text style={[styles.intro, { color: theme.muted }]}>No tienes hábitos archivados.</Text>
      )}
      {archived.map((h) => (
        <View key={h.id} style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.icon, { backgroundColor: h.color + theme.emptyAlpha }]}>
            <Ionicons name={h.icon} size={20} color={h.color} />
          </View>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{h.name}</Text>
          <Pressable onPress={() => setArchived(h.id, false)} hitSlop={8} accessibilityLabel={`Restaurar ${h.name}`}>
            <Ionicons name="arrow-undo-outline" size={22} color={theme.primary} />
          </Pressable>
          <Pressable
            hitSlop={8}
            accessibilityLabel={`Eliminar ${h.name}`}
            onPress={async () => {
              if (await confirmAction('Eliminar hábito', `Se borrará "${h.name}" y todo su historial.`, 'Eliminar')) {
                deleteHabit(h.id);
              }
            }}
          >
            <Ionicons name="trash-outline" size={22} color={theme.danger} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
});
