import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HabitActionsSheet } from '@/components/HabitActionsSheet';
import { GradientCard, ON_GRADIENT } from '@/components/GradientCard';
import { HabitCard } from '@/components/HabitCard';
import { ProgressRing } from '@/components/ProgressRing';
import { RecordSheet } from '@/components/RecordSheet';
import { Chip, HeaderButton } from '@/components/ui';
import { WeekStrip } from '@/components/WeekStrip';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import { DateKey, formatDayTitle, fromKey } from '@/lib/dates';
import { Habit, isDoneFor, isQuit, isScheduledOn, TIME_OF_DAY, TIME_OF_DAY_ORDER } from '@/lib/habit';
import { useToday } from '@/lib/useToday';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

const openNewHabit = () => router.push('/habit/new');

/** Espacio bajo la lista para que el botón flotante no tape la última tarjeta. */
const FAB_SPACE = 104;
/** A partir de cuántos hábitos se sugiere la vista compacta (una sola vez). */
const COMPACT_TIP_MIN_HABITS = 4;

/** "Viernes, 2 de octubre". */
function fullDate(key: DateKey): string {
  const text = fromKey(key).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function TodayScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const habits = useHabits((s) => s.habits);
  const completions = useHabits((s) => s.completions);
  const customCategories = useHabits((s) => s.customCategories);
  const showHeatmaps = useHabits((s) => s.settings.showHeatmaps);
  const compactTipSeen = useHabits((s) => s.settings.compactTipSeen);
  const updateSettings = useHabits((s) => s.updateSettings);

  const today = useToday();
  // null = "hoy", que sigue al día nuevo si pasa la medianoche con la app abierta.
  const [pickedDay, setPickedDay] = useState<DateKey | null>(null);
  const selectedDay = pickedDay ?? today;
  const setSelectedDay = (day: DateKey) => setPickedDay(day === today ? null : day);
  const [category, setCategory] = useState<string | null>(null);
  const [menuHabit, setMenuHabit] = useState<Habit | null>(null);
  const [recordTarget, setRecordTarget] = useState<{ habit: Habit; day: DateKey } | null>(null);
  const openRecord = useCallback((habit: Habit, day: DateKey) => setRecordTarget({ habit, day }), []);


  const usedCategories = useMemo(() => {
    const used = new Set(habits.flatMap((h) => h.categories));
    return [...DEFAULT_CATEGORIES, ...customCategories].filter((c) => used.has(c.id));
  }, [habits, customCategories]);
  const activeCategory = category && usedCategories.some((c) => c.id === category) ? category : null;

  const { sections, quitting, cleanCount, resting, doneCount, scheduledCount } = useMemo(() => {
    const date = fromKey(selectedDay);
    const done = (h: Habit) => isDoneFor(h, completions[h.id], date);
    const visible = habits.filter((h) => !activeCategory || h.categories.includes(activeCategory));
    const scheduled = visible.filter((h) => isScheduledOn(h, date));
    // Los hábitos para dejar no son tareas del día: van aparte y no cuentan en el progreso.
    const toDo = scheduled.filter((h) => !isQuit(h));
    const toAvoid = scheduled.filter(isQuit);
    return {
      // Pendientes primero, completados al final de cada sección.
      sections: TIME_OF_DAY_ORDER.map((tod) => ({
        tod,
        habits: toDo.filter((h) => h.timeOfDay === tod).sort((a, b) => Number(done(a)) - Number(done(b))),
      })).filter((s) => s.habits.length > 0),
      quitting: toAvoid,
      cleanCount: toAvoid.filter(done).length,
      resting: visible.filter((h) => !isScheduledOn(h, date)),
      doneCount: toDo.filter(done).length,
      scheduledCount: toDo.length,
    };
  }, [habits, activeCategory, completions, selectedDay]);

  const progressFor = (d: Date) => {
    const scheduled = habits.filter((h) => !isQuit(h) && isScheduledOn(h, d));
    if (!scheduled.length) return null;
    return scheduled.filter((h) => isDoneFor(h, completions[h.id], d)).length / scheduled.length;
  };

  const progress = scheduledCount ? doneCount / scheduledCount : 0;
  const isToday = selectedDay === today;
  const pending = scheduledCount - doneCount;
  const dayOff = scheduledCount === 0;
  const dayDone = !dayOff && pending === 0;
  const message = dayOff
    ? quitting.length
      ? `${isToday ? 'Hoy solo toca' : 'Ese día solo tocaba'} evitar lo que estás dejando`
      : 'Nada programado para este día'
    : dayDone
      ? isToday ? '¡Lo hiciste todo hoy!' : 'Cumpliste todo lo de este día'
      : `Te ${pending === 1 ? 'falta' : 'faltan'} ${pending} para completar el día`;

  return (
    <>
      {/* Encabezado propio (no el nativo): en Android los botones del header nativo dejan de
          responder mientras la barra anima el cambio de icono. */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {formatDayTitle(selectedDay, today)}
        </Text>
        <View style={styles.headerButtons}>
          {habits.length > 0 && (
            <HeaderButton icon="stats-chart-outline" label="Resumen" onPress={() => router.push('/summary')} />
          )}
          {habits.length > 0 && (
            <HeaderButton
              icon={showHeatmaps ? 'list-outline' : 'grid-outline'}
              label={showHeatmaps ? 'Vista compacta' : 'Mostrar gráficas'}
              onPress={() => updateSettings({ showHeatmaps: !showHeatmaps, compactTipSeen: true })}
            />
          )}
        </View>
      </View>
      {/* La barra de pestañas ya deja el margen inferior del sistema. */}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: FAB_SPACE }]}>
        {habits.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="grid" size={56} color={theme.primary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Empieza tu primer hábito</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              Elige una sugerencia o crea el tuyo. Cada día que lo cumplas se pintará un cuadrito.
            </Text>
            <Pressable onPress={openNewHabit} style={[styles.emptyButton, { backgroundColor: theme.primary }]}>
              <Text style={styles.emptyButtonText}>Crear hábito</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <GradientCard colors={theme.heroHabits} style={styles.summary}>
              <ProgressRing size={76} strokeWidth={8} progress={progress} color="#FFFFFF" trackColor={ON_GRADIENT.faint}>
                {dayOff ? (
                  <Ionicons name="cafe-outline" size={28} color={ON_GRADIENT.text} />
                ) : dayDone ? (
                  <Ionicons name="trophy" size={30} color={ON_GRADIENT.text} accessibilityLabel="Día completado" />
                ) : (
                  <Text style={[styles.percent, { color: ON_GRADIENT.text }]}>{Math.round(progress * 100)}%</Text>
                )}
              </ProgressRing>
              <View style={styles.summaryText}>
                <Text style={[styles.date, { color: ON_GRADIENT.muted }]}>{fullDate(selectedDay)}</Text>
                <Text style={[styles.progressText, { color: ON_GRADIENT.text }]}>
                  {dayOff
                    ? quitting.length ? 'Nada por hacer' : 'Día libre'
                    : dayDone ? 'Día completado' : `${doneCount} de ${scheduledCount} completados`}
                </Text>
                <Text style={[styles.message, { color: ON_GRADIENT.muted }]}>{message}</Text>
                {quitting.length > 0 && (
                  <View style={[styles.quitLine, { backgroundColor: ON_GRADIENT.faint }]}>
                    <Ionicons
                      name={cleanCount === quitting.length ? 'shield-checkmark' : 'alert-circle'}
                      size={13}
                      color={ON_GRADIENT.text}
                    />
                    <Text style={[styles.quitText, { color: ON_GRADIENT.text }]}>
                      {cleanCount} de {quitting.length} dentro del límite
                    </Text>
                  </View>
                )}
              </View>
            </GradientCard>

            <WeekStrip selected={selectedDay} onSelect={setSelectedDay} progressFor={progressFor} />

            {!isToday && (
              <Pressable
                onPress={() => setSelectedDay(today)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.backToday, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="return-down-back" size={15} color={theme.text} />
                <Text style={[styles.backTodayText, { color: theme.text }]}>Volver a hoy</Text>
              </Pressable>
            )}

            {showHeatmaps && !compactTipSeen && habits.length >= COMPACT_TIP_MIN_HABITS && (
              <View style={[styles.tip, { backgroundColor: theme.primary + theme.emptyAlpha, borderColor: theme.primary }]}>
                <View style={styles.tipHeader}>
                  <Ionicons name="bulb-outline" size={18} color={theme.primary} />
                  <Text style={[styles.tipTitle, { color: theme.text }]}>¿Se te hace larga la lista?</Text>
                </View>
                <Text style={[styles.tipText, { color: theme.text }]}>
                  Toca <Ionicons name="list-outline" size={14} color={theme.text} /> arriba para la vista compacta, sin
                  gráficas. Además, los hábitos que completas pliegan su gráfica solos.
                </Text>
                <View style={styles.tipActions}>
                  <Pressable onPress={() => updateSettings({ compactTipSeen: true })} hitSlop={6}>
                    <Text style={[styles.tipDismiss, { color: theme.muted }]}>Entendido</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateSettings({ showHeatmaps: false, compactTipSeen: true })}
                    style={({ pressed }) => [styles.tipTry, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text style={styles.tipTryText}>Probar la vista compacta</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {usedCategories.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="Todos" selected={!activeCategory} onPress={() => setCategory(null)} />
                {usedCategories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    icon={c.icon}
                    selected={activeCategory === c.id}
                    onPress={() => setCategory(activeCategory === c.id ? null : c.id)}
                  />
                ))}
              </ScrollView>
            )}

            {sections.map((section) => (
              <View key={section.tod} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name={TIME_OF_DAY[section.tod].icon} size={16} color={theme.muted} />
                  <Text style={[styles.sectionTitle, { color: theme.muted }]}>{TIME_OF_DAY[section.tod].label}</Text>
                </View>
                {section.habits.map((h) => (
                  <HabitCard key={h.id} habit={h} day={selectedDay} showHeatmap={showHeatmaps} onLongPress={setMenuHabit} onRecord={openRecord} />
                ))}
              </View>
            ))}

            {quitting.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={theme.muted} />
                  <Text style={[styles.sectionTitle, { color: theme.muted }]}>Dejar</Text>
                </View>
                {quitting.map((h) => (
                  <HabitCard key={h.id} habit={h} day={selectedDay} showHeatmap={showHeatmaps} onLongPress={setMenuHabit} onRecord={openRecord} />
                ))}
              </View>
            )}

            {resting.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="cafe-outline" size={16} color={theme.muted} />
                  <Text style={[styles.sectionTitle, { color: theme.muted }]}>Descanso este día</Text>
                </View>
                {resting.map((h) => (
                  <HabitCard key={h.id} habit={h} day={selectedDay} showHeatmap={false} dimmed onLongPress={setMenuHabit} onRecord={openRecord} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {habits.length > 0 && (
        <Pressable
          onPress={openNewHabit}
          accessibilityRole="button"
          accessibilityLabel="Nuevo hábito"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: theme.primary, bottom: 20, transform: [{ scale: pressed ? 0.94 : 1 }], boxShadow: `0px 8px 20px ${theme.primary}55` },
          ]}
        >
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </Pressable>
      )}

      <HabitActionsSheet habit={menuHabit} onClose={() => setMenuHabit(null)} />
      <RecordSheet target={recordTarget} onClose={() => setRecordTarget(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 4 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  summaryText: { flex: 1, gap: 3 },
  percent: { fontSize: 18, fontWeight: '800' },
  date: { fontSize: 13, fontWeight: '600' },
  progressText: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  message: { fontSize: 13 },
  quitLine: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  quitText: { fontSize: 12.5, fontWeight: '700' },
  tip: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipTitle: { fontSize: 15, fontWeight: '800' },
  tipText: { fontSize: 13.5, lineHeight: 19 },
  tipActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16, marginTop: 2 },
  tipDismiss: { fontSize: 14, fontWeight: '700' },
  tipTry: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  tipTryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  backToday: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
  },
  backTodayText: { fontSize: 13, fontWeight: '600' },
  chips: { gap: 8, paddingVertical: 2 },
  section: { gap: 10, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 24, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  emptyButton: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  fab: {
    position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
});
