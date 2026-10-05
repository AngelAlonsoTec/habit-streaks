import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckButton, QuitButton } from '@/components/CheckButton';
import { Heatmap } from '@/components/Heatmap';
import { DateKey, fromKey } from '@/lib/dates';
import {
  dailyTarget, describeGoal, describeProgress, Habit, isQuantity, isQuit, isScheduledOn, quitLevel, weekCount,
} from '@/lib/habit';
import { tapFeedback } from '@/lib/platform';
import { describeDueShort, nextObjective } from '@/lib/objectives';
import { computeStats, streakLabel } from '@/lib/stats';
import { useToday } from '@/lib/useToday';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

type Props = {
  habit: Habit;
  /** Día que se está viendo/marcando. */
  day: DateKey;
  showHeatmap: boolean;
  dimmed?: boolean;
  onLongPress?: (habit: Habit) => void;
  /** Abre el panel de registro (cantidades y hábitos para dejar). */
  onRecord?: (habit: Habit, day: DateKey) => void;
};

export const HabitCard = memo(function HabitCard({ habit, day, showHeatmap, dimmed, onLongPress, onRecord }: Props) {
  const theme = useTheme();
  const counts = useHabits((s) => s.completions[habit.id]);
  const cycleCompletion = useHabits((s) => s.cycleCompletion);
  const setCompletion = useHabits((s) => s.setCompletion);

  const date = fromKey(day);
  const count = counts?.[day] ?? 0;
  const weekly = habit.goal.period === 'week';
  const quantity = isQuantity(habit);
  const quit = isQuit(habit);
  const target = dailyTarget(habit);
  const week = weekly ? weekCount(counts, date) : 0;
  const today = useToday();
  const stats = useMemo(() => computeStats(habit, counts, fromKey(today)), [habit, counts, today]);
  const isScheduled = useCallback((d: Date) => isScheduledOn(habit, d), [habit]);
  const level = useMemo(() => quitLevel(habit, counts), [habit, counts]);
  const when = day === today ? ' hoy' : '';
  const record = () => {
    tapFeedback();
    onRecord?.(habit, day);
  };

  const detail = weekly
    ? `${describeProgress(habit, week, habit.goal.count)} esta semana`
    : quit || quantity
      ? describeProgress(habit, count, quit ? habit.goal.count : target) + when
      : target > 1
        ? `${Math.min(count, target)}/${target}${when}`
        : describeGoal(habit);
  const reminder = habit.reminders[0];
  const next = nextObjective(habit.objectives);
  const due = next?.dueDate ? describeDueShort(next.dueDate, today) : null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
      onLongPress={onLongPress ? () => { tapFeedback(); onLongPress(habit); } : undefined}
      accessibilityHint="Mantén pulsado para editar, archivar o eliminar"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: dimmed ? 0.6 : pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: habit.color + theme.emptyAlpha }]}>
          <Ionicons name={habit.icon} size={22} color={habit.color} />
        </View>
        <View style={styles.titles}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {habit.name}
          </Text>
          <View style={styles.meta}>
            {stats.currentStreak > 0 && (
              <View style={styles.inline}>
                <Ionicons name="flame" size={13} color={habit.color} />
                <Text style={[styles.metaText, { color: theme.text }]}>
                  {streakLabel(stats.currentStreak, stats.streakUnit)}
                </Text>
              </View>
            )}
            <Text style={[styles.metaText, { color: theme.muted }]} numberOfLines={1}>
              {detail}
            </Text>
            {reminder && (
              <View style={styles.inline}>
                <Ionicons name="alarm-outline" size={12} color={theme.muted} />
                <Text style={[styles.metaText, { color: theme.muted }]}>
                  {reminder}
                  {habit.reminders.length > 1 ? ` +${habit.reminders.length - 1}` : ''}
                </Text>
              </View>
            )}
          </View>
          {next && (
            <View style={styles.inline}>
              <Ionicons name="flag" size={12} color={habit.color} />
              <Text style={[styles.metaText, styles.flex, { color: theme.muted }]} numberOfLines={1}>
                Próximo: <Text style={{ color: theme.text }}>{next.title}</Text>
                {due && <Text style={{ color: due.tone === 'overdue' ? theme.danger : theme.muted }}> · {due.text}</Text>}
              </Text>
            </View>
          )}
        </View>
        {quit ? (
          <QuitButton
            quantity={quantity}
            count={weekly ? week : count}
            limit={habit.goal.count}
            color={habit.color}
            accessibilityLabel={`Registrar ${habit.name}`}
            onPress={record}
          />
        ) : quantity ? (
          <CheckButton
            quantity
            count={weekly ? week : count}
            target={weekly ? habit.goal.count : target}
            color={habit.color}
            accessibilityLabel={`Registrar ${habit.name}`}
            onPress={record}
          />
        ) : (
          <CheckButton
            count={weekly ? Math.min(count, 1) : count}
            target={target}
            color={habit.color}
            accessibilityLabel={`Marcar ${habit.name}`}
            onPress={() => {
              tapFeedback();
              cycleCompletion(habit.id, day);
            }}
            onLongPress={() => {
              tapFeedback();
              setCompletion(habit.id, day, 0);
            }}
          />
        )}
      </View>

      {/* Siempre montado (salvo en días de descanso) y solo oculto: así alternar la vista compacta es instantáneo. */}
      {!dimmed && (
        <View style={!showHeatmap && styles.hidden}>
          <Heatmap counts={counts} color={habit.color} target={target} isScheduled={isScheduled} level={level} cellSize={10} showMonthLabels />
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2, alignItems: 'center' },
  metaText: { fontSize: 12.5, fontWeight: '500' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  flex: { flex: 1 },
  hidden: { display: 'none' },
});
