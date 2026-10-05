import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeGoal, Habit } from '@/lib/habit';
import { confirmAction } from '@/lib/platform';
import { computeStats, streakLabel } from '@/lib/stats';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

export default function ArchivedScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const allHabits = useHabits((s) => s.habits);
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
        <ArchivedRow key={h.id} habit={h} />
      ))}
    </ScrollView>
  );
}

function ArchivedRow({ habit }: { habit: Habit }) {
  const theme = useTheme();
  const counts = useHabits((s) => s.completions[habit.id]);
  const setArchived = useHabits((s) => s.setArchived);
  const deleteHabit = useHabits((s) => s.deleteHabit);
  const best = useMemo(() => computeStats(habit, counts).bestStreak, [habit, counts]);

  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {/* Tocar el hábito abre su detalle: el historial sigue ahí. */}
      <Pressable
        onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
        accessibilityLabel={`Ver ${habit.name}`}
        style={styles.main}
      >
        <View style={[styles.icon, { backgroundColor: habit.color + theme.emptyAlpha }]}>
          <Ionicons name={habit.icon} size={20} color={habit.color} />
        </View>
        <View style={styles.texts}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{habit.name}</Text>
          <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
            {describeGoal(habit)}
            {best > 0 ? ` · mejor racha: ${streakLabel(best, habit.goal.period === 'week' ? 'week' : 'day')}` : ''}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={() => setArchived(habit.id, false)} hitSlop={8} accessibilityLabel={`Restaurar ${habit.name}`}>
        <Ionicons name="arrow-undo-outline" size={22} color={theme.primary} />
      </Pressable>
      <Pressable
        hitSlop={8}
        accessibilityLabel={`Eliminar ${habit.name}`}
        onPress={async () => {
          if (await confirmAction('Eliminar hábito', `Se borrará "${habit.name}" y todo su historial.`, 'Eliminar')) {
            deleteHabit(habit.id);
          }
        }}
      >
        <Ionicons name="trash-outline" size={22} color={theme.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12.5 },
});
