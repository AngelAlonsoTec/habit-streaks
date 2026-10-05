import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ObjectiveSheet } from '@/components/ObjectiveSheet';
import { Card } from '@/components/ui';
import type { Habit } from '@/lib/habit';
import { describeObjective, nextObjective, Objective } from '@/lib/objectives';
import { successFeedback, tapFeedback } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

/** Objetivos del hábito como una ruta de hitos: se marcan al lograrlos y se tocan para editarlos. */
export function ObjectivesCard({ habit }: { habit: Habit }) {
  const theme = useTheme();
  const today = useToday();
  const setObjectiveAchieved = useHabits((s) => s.setObjectiveAchieved);
  const [editing, setEditing] = useState<Objective | 'new' | null>(null);

  const { objectives } = habit;
  const achieved = objectives.filter((o) => o.achievedOn).length;
  const next = nextObjective(objectives);

  const toggle = (o: Objective) => {
    if (o.achievedOn) {
      tapFeedback();
      setObjectiveAchieved(habit.id, o.id, null);
    } else {
      successFeedback();
      setObjectiveAchieved(habit.id, o.id, today);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Objetivos</Text>
        {objectives.length > 0 && (
          <Text style={[styles.count, { color: theme.muted }]}>
            {achieved} de {objectives.length} {objectives.length === 1 ? 'logrado' : 'logrados'}
          </Text>
        )}
        <Pressable
          onPress={() => setEditing('new')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Añadir objetivo"
          style={[styles.add, { backgroundColor: habit.color + theme.emptyAlpha }]}
        >
          <Ionicons name="add" size={20} color={habit.color} />
        </Pressable>
      </View>

      {objectives.length === 0 ? (
        <Pressable onPress={() => setEditing('new')} style={[styles.empty, { borderColor: theme.border }]}>
          <Ionicons name="flag-outline" size={22} color={habit.color} />
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            Opcional: márcate hitos para este hábito, como «Alcanzar el A1», y señálalos cuando los logres.
          </Text>
        </Pressable>
      ) : (
        <>
          <View style={[styles.track, { backgroundColor: habit.color + theme.emptyAlpha }]}>
            <View style={[styles.fill, { width: `${(achieved / objectives.length) * 100}%`, backgroundColor: habit.color }]} />
          </View>
          <View>
            {objectives.map((o, i) => {
              const done = o.achievedOn != null;
              const isNext = o === next;
              const status = describeObjective(o, today);
              const statusColor =
                status.tone === 'overdue' ? theme.danger : status.tone === 'soon' || status.tone === 'done' ? habit.color : theme.muted;
              const last = i === objectives.length - 1;
              return (
                <View key={o.id} style={styles.row}>
                  {/* Columna de la ruta: el hito y la línea hasta el siguiente. */}
                  <View style={styles.rail}>
                    <Pressable
                      onPress={() => toggle(o)}
                      hitSlop={8}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      accessibilityLabel={`${done ? 'Marcar pendiente' : 'Marcar logrado'}: ${o.title}`}
                      style={[
                        styles.check,
                        done
                          ? { backgroundColor: habit.color, borderColor: habit.color }
                          : { borderColor: isNext ? habit.color : theme.border },
                      ]}
                    >
                      {done && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </Pressable>
                    {!last && <View style={[styles.line, { backgroundColor: done ? habit.color : theme.border }]} />}
                  </View>
                  <Pressable
                    onPress={() => setEditing(o)}
                    accessibilityLabel={`Editar objetivo ${o.title}`}
                    style={[styles.body, !last && styles.bodySpacing]}
                  >
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, { color: done ? theme.muted : theme.text }, isNext && styles.bold]}>{o.title}</Text>
                      {isNext && (
                        <Text style={[styles.badge, { color: habit.color, backgroundColor: habit.color + theme.emptyAlpha }]}>
                          Próximo
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.status, { color: statusColor }]}>{status.text}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          {next == null && (
            <Text style={[styles.allDone, { color: habit.color }]}>¡Todos logrados! Añade el siguiente cuando quieras.</Text>
          )}
        </>
      )}

      <ObjectiveSheet habit={habit} objective={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  count: { fontSize: 13, fontWeight: '600' },
  add: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
  emptyText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 26 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, marginVertical: 3, borderRadius: 1 },
  body: { flex: 1, gap: 2, paddingTop: 2 },
  bodySpacing: { paddingBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  bold: { fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  status: { fontSize: 12.5, fontWeight: '500' },
  allDone: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
