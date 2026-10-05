import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Heatmap, HeatmapLegend, monthStart, WeekdayLabels } from '@/components/Heatmap';
import { MonthCalendar } from '@/components/MonthCalendar';
import { ObjectivesCard } from '@/components/ObjectivesCard';
import { RecordSheet } from '@/components/RecordSheet';
import { Card, Chip } from '@/components/ui';
import { WeekdayChart } from '@/components/WeekdayChart';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import { DateKey, fromKey } from '@/lib/dates';
import {
  dailyTarget, describeGoal, formatAmount, isQuantity, isQuit, isScheduledOn, quitLevel, TIME_OF_DAY,
} from '@/lib/habit';
import { confirmAction, goBack, tapFeedback } from '@/lib/platform';
import { computeStats, streakLabel } from '@/lib/stats';
import { useToday } from '@/lib/useToday';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const habit = useHabits((s) => s.habits.find((h) => h.id === id));
  const counts = useHabits((s) => s.completions[id]);
  const customCategories = useHabits((s) => s.customCategories);
  const cycleCompletion = useHabits((s) => s.cycleCompletion);
  const setCompletion = useHabits((s) => s.setCompletion);
  const setArchived = useHabits((s) => s.setArchived);
  const deleteHabit = useHabits((s) => s.deleteHabit);
  const heatmapScroll = useRef<ScrollView>(null);
  const [recordDay, setRecordDay] = useState<DateKey | null>(null);

  const today = useToday();
  const stats = useMemo(() => (habit ? computeStats(habit, counts, fromKey(today)) : null), [counts, habit, today]);
  const isScheduled = useCallback((d: Date) => (habit ? isScheduledOn(habit, d) : true), [habit]);
  const level = useMemo(() => (habit ? quitLevel(habit, counts) : undefined), [habit, counts]);

  if (!habit || !stats) return null;

  const target = dailyTarget(habit);
  const quantity = isQuantity(habit);
  const quit = isQuit(habit);
  const weekly = habit.goal.period === 'week';
  const categories = [...DEFAULT_CATEGORIES, ...customCategories].filter((c) => habit.categories.includes(c.id));

  const onPressDay = (day: DateKey) => {
    tapFeedback();
    if (quantity || quit) setRecordDay(day);
    else cycleCompletion(habit.id, day);
  };
  const onLongPressDay = (day: DateKey) => {
    tapFeedback();
    setCompletion(habit.id, day, 0);
  };

  const onEdit = () => router.push({ pathname: '/habit/[id]/edit', params: { id: habit.id } });

  const onArchive = () => {
    setArchived(habit.id, !habit.archived);
    goBack();
  };

  const onDelete = async () => {
    const ok = await confirmAction('Eliminar hábito', `Se borrará "${habit.name}" y todo su historial.`, 'Eliminar');
    if (!ok) return;
    goBack();
    deleteHabit(habit.id);
  };

  const statItems = [
    { label: 'Racha actual', value: streakLabel(stats.currentStreak, stats.streakUnit), icon: 'flame' as const },
    { label: 'Mejor racha', value: streakLabel(stats.bestStreak, stats.streakUnit), icon: 'trophy' as const },
    { label: quit ? 'Éxito 30 días' : 'Cumplimiento 30 días', value: `${stats.rate30}%`, icon: 'stats-chart' as const },
    quit
      ? {
        label: `${weekly ? 'Semanas' : 'Días'} ${habit.goal.count === 0 ? 'con recaída' : 'sobre el límite'}`,
        value: String(stats.overLimit),
        icon: 'alert-circle' as const,
      }
      : quantity
        ? { label: 'Total registrado', value: `${formatAmount(stats.total)} ${habit.unit}`, icon: 'checkmark-done' as const }
        : { label: 'Veces completado', value: String(stats.total), icon: 'checkmark-done' as const },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              onPress={onEdit}
              hitSlop={10}
              accessibilityLabel="Editar hábito"
            >
              <Ionicons name="create-outline" size={24} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: habit.color }]}>
            <Ionicons name={habit.icon} size={30} color="#FFFFFF" />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroName, { color: theme.text }]}>{habit.name}</Text>
            <Text style={[styles.heroMeta, { color: theme.muted }]}>
              {describeGoal(habit)}
              {quit ? '' : ` · ${TIME_OF_DAY[habit.timeOfDay].label}`}
            </Text>
            {habit.reminders.length > 0 && (
              <View style={styles.inline}>
                <Ionicons name="alarm-outline" size={14} color={theme.muted} />
                <Text style={[styles.heroMeta, { color: theme.muted }]}>{habit.reminders.join(' · ')}</Text>
              </View>
            )}
          </View>
        </View>

        {categories.length > 0 && (
          <View style={styles.wrap}>
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} icon={c.icon} />
            ))}
          </View>
        )}

        <View style={styles.stats}>
          {statItems.map((s) => (
            <View key={s.label} style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name={s.icon} size={18} color={habit.color} />
              <Text style={[styles.statValue, { color: theme.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: theme.muted }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <ObjectivesCard habit={habit} />

        <Card style={styles.cardGap}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Últimos 12 meses</Text>
          {/* Las letras de los días quedan fijas; solo se desplazan los meses. */}
          <View style={styles.heatmapRow}>
            <WeekdayLabels cellSize={13} withMonthLabels />
            <ScrollView
              ref={heatmapScroll}
              horizontal
              showsHorizontalScrollIndicator={false}
              onContentSizeChange={() => heatmapScroll.current?.scrollToEnd({ animated: false })}
            >
              <Heatmap
                counts={counts}
                color={habit.color}
                target={target}
                isScheduled={isScheduled}
                level={level}
                startKey={monthStart(today, 11)}
                cellSize={13}
                showMonthLabels
              />
            </ScrollView>
          </View>
          {quit ? (
            <HeatmapLegend color={habit.color} limit={habit.goal.count} />
          ) : (
            (target > 1 || quantity) && <HeatmapLegend color={habit.color} />
          )}
        </Card>

        <Card style={styles.cardGap}>
          <MonthCalendar
            counts={counts}
            color={habit.color}
            target={target}
            unit={habit.unit}
            level={level}
            isScheduled={isScheduled}
            onPressDay={onPressDay}
            onLongPressDay={onLongPressDay}
          />
          <Text style={[styles.hint, { color: theme.muted }]}>
            {quit
              ? 'Toca un día para registrar o corregir. Mantén pulsado para borrarlo.'
              : quantity
              ? 'Toca un día para registrar una cantidad. Mantén pulsado para borrarlo.'
              : target > 1
              ? 'Toca un día para sumar una vez. Mantén pulsado para reiniciarlo.'
              : 'Toca un día para marcarlo o desmarcarlo.'}
          </Text>
        </Card>

        <Card style={styles.cardGap}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{quit ? 'Días con más registros' : 'Tus mejores días'}</Text>
          <WeekdayChart counts={stats.weekdayCounts} color={quit ? theme.danger : habit.color} />
        </Card>

        <View style={styles.actions}>
          <Pressable onPress={onEdit} style={[styles.action, { backgroundColor: theme.surface }]}>
            <Ionicons name="create-outline" size={18} color={theme.text} />
            <Text style={[styles.actionText, { color: theme.text }]}>Editar</Text>
          </Pressable>
          <Pressable onPress={onArchive} style={[styles.action, { backgroundColor: theme.surface }]}>
            <Ionicons name={habit.archived ? 'arrow-undo-outline' : 'archive-outline'} size={18} color={theme.text} />
            <Text style={[styles.actionText, { color: theme.text }]}>{habit.archived ? 'Restaurar' : 'Archivar'}</Text>
          </Pressable>
          <Pressable onPress={onDelete} style={[styles.action, { backgroundColor: theme.surface }]}>
            <Ionicons name="trash-outline" size={18} color={theme.danger} />
            <Text style={[styles.actionText, { color: theme.danger }]}>Eliminar</Text>
          </Pressable>
        </View>
      </ScrollView>
      <RecordSheet target={recordDay ? { habit, day: recordDay } : null} onClose={() => setRecordDay(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, gap: 3 },
  heroName: { fontSize: 24, fontWeight: '800' },
  heroMeta: { fontSize: 14 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '45%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12 },
  cardGap: { gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  heatmapRow: { flexDirection: 'row' },
  hint: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  action: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  actionText: { fontSize: 15, fontWeight: '700' },
});
