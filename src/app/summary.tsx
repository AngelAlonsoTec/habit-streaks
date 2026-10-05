import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart } from '@/components/BarChart';
import { Heatmap, WeekdayLabels } from '@/components/Heatmap';
import { Card, Segmented } from '@/components/ui';
import { fromKey, toKey, WEEKDAY_LABELS } from '@/lib/dates';
import { Period, summarize } from '@/lib/summary';
import { useToday } from '@/lib/useToday';
import { useHabits } from '@/store/habits';
import { IconName, useTheme } from '@/theme';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
];

const PREVIOUS_LABEL: Record<Period, string> = {
  week: 'la semana anterior',
  month: 'el mes anterior',
  quarter: 'el trimestre anterior',
  year: 'el año anterior',
};

/** Preposición + periodo con su contracción ("a el" → "al", "de el" → "del"). */
const withPreposition = (prep: 'a' | 'de', period: Period) =>
  `${prep} ${PREVIOUS_LABEL[period]}`.replace(/^a el /, 'al ').replace(/^de el /, 'del ');

const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export default function SummaryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const allHabits = useHabits((s) => s.habits);
  const completions = useHabits((s) => s.completions);
  const [period, setPeriod] = useState<Period>('week');
  const [offset, setOffset] = useState(0);
  const heatmapScroll = useRef<ScrollView>(null);

  const habits = useMemo(() => allHabits.filter((h) => !h.archived), [allHabits]);
  const todayKey = useToday();
  const today = useMemo(() => fromKey(todayKey), [todayKey]);
  const summary = useMemo(
    () => summarize(habits, completions, period, offset, today),
    [habits, completions, period, offset, today],
  );
  const hasWeeklyGoals = habits.some((h) => h.goal.period === 'week');

  const delta = summary.rate != null && summary.previousRate != null ? summary.rate - summary.previousRate : null;

  // Mapa de constancia (trimestre y año): intensidad = % de hábitos diarios cumplidos ese día.
  const heatmapEnd = summary.range.end < today ? summary.range.end : today;
  const heatmapCell = period === 'quarter' ? 17 : 12;
  const heatmapCounts = useMemo(
    () => Object.fromEntries(Object.entries(summary.dailyRates).map(([k, r]) => [k, Math.round(r * 100)])),
    [summary.dailyRates],
  );

  const insights = buildInsights(summary);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    setOffset(0);
  };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <Segmented value={period} options={PERIODS} onChange={changePeriod} />

      <View style={styles.nav}>
        <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={10} accessibilityLabel="Periodo anterior" style={styles.navButton}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.navLabel, { color: theme.text }]}>{summary.range.label}</Text>
        <Pressable
          onPress={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset === 0}
          hitSlop={10}
          accessibilityLabel="Periodo siguiente"
          style={styles.navButton}
        >
          <Ionicons name="chevron-forward" size={22} color={offset === 0 ? theme.border : theme.text} />
        </Pressable>
      </View>

      {habits.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>Crea un hábito para ver tu resumen.</Text>
      ) : (
        <>
          <Card style={styles.hero}>
            <Text style={[styles.heroLabel, { color: theme.muted }]}>Cumplimiento</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>
              {summary.rate == null ? '—' : `${summary.rate} %`}
            </Text>
            {delta != null ? (
              <View style={[styles.delta, { backgroundColor: theme.surface }]}>
                <Ionicons
                  name={delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'remove'}
                  size={16}
                  color={delta > 0 ? theme.primary : delta < 0 ? theme.danger : theme.muted}
                />
                <Text style={[styles.deltaText, { color: theme.text }]}>
                  {delta === 0
                    ? `Igual que ${PREVIOUS_LABEL[period]}`
                    : `${delta > 0 ? '+' : ''}${delta} puntos respecto ${withPreposition('a', period)}`}
                </Text>
              </View>
            ) : (
              <Text style={[styles.hint, { color: theme.muted }]}>
                {summary.rate == null ? 'No había hábitos programados en este periodo.' : `Sin datos ${withPreposition('de', period)}.`}
              </Text>
            )}
          </Card>

          <View style={styles.kpis}>
            <Kpi icon="checkmark-done" label="Veces completado" value={String(summary.completions)} />
            <Kpi icon="star" label="Días perfectos" value={`${summary.perfectDays}/${summary.elapsedDays}`} />
            <Kpi icon="calendar" label="Días activos" value={`${summary.activeDays}/${summary.elapsedDays}`} />
          </View>

          <Card style={styles.cardGap}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Evolución</Text>
            <BarChart
              bars={summary.buckets.map((b) => ({ label: b.label, value: b.rate, current: b.current }))}
              color={theme.primary}
              labelEvery={period === 'month' ? 5 : 1}
            />
            {(period === 'week' || period === 'month') && hasWeeklyGoals && (
              <Text style={[styles.hint, { color: theme.muted }]}>
                Por día solo cuentan los hábitos diarios; las metas semanales se incluyen en el cumplimiento total.
              </Text>
            )}
          </Card>

          {(period === 'quarter' || period === 'year') && (
            <Card style={styles.cardGap}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Constancia</Text>
              <View style={styles.heatmapRow}>
                <WeekdayLabels cellSize={heatmapCell} withMonthLabels />
                <ScrollView
                  ref={heatmapScroll}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onContentSizeChange={() => heatmapScroll.current?.scrollToEnd({ animated: false })}
                >
                  <Heatmap
                    counts={heatmapCounts}
                    target={100}
                    color={theme.primary}
                    startKey={toKey(summary.range.start)}
                    endKey={toKey(heatmapEnd)}
                    cellSize={heatmapCell}
                    showMonthLabels
                  />
                </ScrollView>
              </View>
              <Text style={[styles.hint, { color: theme.muted }]}>Cada día, más intenso cuantos más hábitos cumpliste.</Text>
            </Card>
          )}

          {insights.length > 0 && (
            <Card style={styles.cardGap}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Observaciones</Text>
              {insights.map((i) => (
                <View key={i.text} style={styles.insight}>
                  <Ionicons name={i.icon} size={18} color={i.tone === 'bad' ? theme.danger : theme.primary} />
                  <Text style={[styles.insightText, { color: theme.text }]}>{i.text}</Text>
                </View>
              ))}
            </Card>
          )}

          <Card style={styles.cardGap}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Por hábito</Text>
            {summary.habits.map(({ habit, rate, scheduled, done }) => (
              <View key={habit.id} style={styles.habitRow}>
                <View style={[styles.habitIcon, { backgroundColor: habit.color + theme.emptyAlpha }]}>
                  <Ionicons name={habit.icon} size={18} color={habit.color} />
                </View>
                <View style={styles.habitBody}>
                  <View style={styles.habitHeader}>
                    <Text style={[styles.habitName, { color: theme.text }]} numberOfLines={1}>{habit.name}</Text>
                    <Text style={[styles.habitRate, { color: theme.text }]}>{rate == null ? '—' : `${rate} %`}</Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: habit.color + theme.emptyAlpha }]}>
                    <View style={[styles.progressFill, { width: `${rate ?? 0}%`, backgroundColor: habit.color }]} />
                  </View>
                  <Text style={[styles.habitMeta, { color: theme.muted }]}>
                    {scheduled === 0
                      ? 'No tocaba en este periodo'
                      : `${formatCount(done)} de ${scheduled} ${
                        habit.goal.period === 'week' ? (scheduled === 1 ? 'semana' : 'semanas') : scheduled === 1 ? 'día' : 'días'
                      }`}
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          <Card style={styles.cardGap}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Por día de la semana</Text>
            <BarChart
              bars={summary.weekdayRates.map((r, i) => ({ label: WEEKDAY_LABELS[i], value: r, current: isBest(summary.weekdayRates, i) }))}
              color={theme.primary}
              height={100}
            />
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Kpi({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Ionicons name={icon} size={17} color={theme.primary} />
      <Text style={[styles.kpiValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const formatCount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function isBest(rates: (number | null)[], i: number): boolean {
  const max = Math.max(...rates.map((r) => r ?? -1));
  return max > 0 && rates[i] === max;
}

type Insight = { icon: IconName; text: string; tone: 'good' | 'bad' };

function buildInsights(s: ReturnType<typeof summarize>): Insight[] {
  const out: Insight[] = [];
  const rated = s.habits.filter((h) => h.rate != null && h.scheduled >= 3);
  const best = rated[0];
  const worst = rated[rated.length - 1];
  if (best && best.rate != null && best.rate >= 50) {
    out.push({ icon: 'trophy-outline', text: `Tu hábito más constante: ${best.habit.name} (${best.rate} %).`, tone: 'good' });
  }
  if (worst && worst !== best && worst.rate != null && worst.rate < 60) {
    out.push({ icon: 'alert-circle-outline', text: `Necesita atención: ${worst.habit.name} (${worst.rate} %).`, tone: 'bad' });
  }
  const bestDay = s.weekdayRates.findIndex((_, i) => isBest(s.weekdayRates, i));
  if (bestDay >= 0) out.push({ icon: 'calendar-outline', text: `Tu mejor día es el ${WEEKDAY_NAMES[bestDay]}.`, tone: 'good' });
  if (s.perfectDays > 0) {
    out.push({
      icon: 'star-outline',
      text: `${s.perfectDays} ${s.perfectDays === 1 ? 'día perfecto' : 'días perfectos'}: cumpliste todo lo que tocaba.`,
      tone: 'good',
    });
  }
  return out;
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { padding: 4 },
  navLabel: { fontSize: 17, fontWeight: '700' },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 40 },
  hero: { alignItems: 'center', gap: 6 },
  heroLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroValue: { fontSize: 44, fontWeight: '800' },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  deltaText: { fontSize: 13, fontWeight: '600' },
  kpis: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 3 },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: { fontSize: 11.5 },
  cardGap: { gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  heatmapRow: { flexDirection: 'row' },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  insight: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  insightText: { flex: 1, fontSize: 14, lineHeight: 20 },
  habitRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  habitIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  habitBody: { flex: 1, gap: 5 },
  habitHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  habitName: { flex: 1, fontSize: 15, fontWeight: '600' },
  habitRate: { fontSize: 15, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  habitMeta: { fontSize: 12 },
});
