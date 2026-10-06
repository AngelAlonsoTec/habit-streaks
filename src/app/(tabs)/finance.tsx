import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sparkline } from '@/components/charts/Sparkline';
import { BudgetSheet } from '@/components/finance/BudgetSheet';
import { MovementsView } from '@/components/finance/MovementsView';
import { FinanceOnboarding } from '@/components/finance/Onboarding';
import { PlansView } from '@/components/finance/PlansView';
import { SummaryView } from '@/components/finance/SummaryView';
import { GradientCard, ON_GRADIENT } from '@/components/GradientCard';
import { HeaderButton, Segmented } from '@/components/ui';
import {
  balanceSeries, describePeriod, FinancePeriod, FUEL_CATEGORY, periodRange, periodTotals, PREVIOUS_PERIOD, rangeDays,
} from '@/lib/finance';
import { CurrencyCode, formatMoney } from '@/lib/money';
import { formatShortDate } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { cardStyle, CHART_LIGHT, chartColor, IconName, inkOn, useTheme } from '@/theme';

type FinanceView = 'summary' | 'movements' | 'plans';

export default function FinanceScreen() {
  const configured = useFinance((s) => s.profiles.length > 0);
  return configured ? <FinanceHome /> : <FinanceOnboarding />;
}

function FinanceHome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const profiles = useFinance((s) => s.profiles);
  const currency = useFinance((s) => s.currency);
  const transactions = useFinance((s) => s.transactions);
  const goals = useFinance((s) => s.goals);
  const hasFuel = useFinance((s) => s.categories.some((c) => c.id === FUEL_CATEGORY));
  const applyRecurring = useFinance((s) => s.applyRecurring);

  const isDriver = profiles.includes('driver');
  // A quien solo maneja le pagan por semana: empieza viendo la semana.
  const [period, setPeriod] = useState<FinancePeriod>(isDriver && profiles.length === 1 ? 'week' : 'month');
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<FinanceView>('summary');
  const [budgetTarget, setBudgetTarget] = useState<string | 'new' | null>(null);

  // Los fijos se apuntan solos al abrir Finanzas (y al cambiar de día con la app abierta).
  useEffect(() => {
    applyRecurring(today);
  }, [applyRecurring, today]);

  const range = useMemo(() => periodRange(period, offset, today), [period, offset, today]);
  const totals = useMemo(() => periodTotals(transactions, goals, range), [transactions, goals, range]);
  const previous = useMemo(
    () => periodTotals(transactions, goals, periodRange(period, offset - 1, today)),
    [transactions, goals, period, offset, today],
  );
  const trend = useMemo(() => balanceSeries(transactions, goals, range, today), [transactions, goals, range, today]);
  const slots = useMemo(() => rangeDays(range).length, [range]);

  const changePeriod = (p: FinancePeriod) => {
    setPeriod(p);
    setOffset(0);
  };

  const periodLabel = describePeriod(period, offset, today);
  const comparison = compareExpenses(totals.expense, previous.expense, period, offset === 0, currency);
  const showFuelAction = hasFuel && (isDriver || transactions.some((t) => t.fuel));
  const actions: { label: string; icon: IconName; color: string; href: Href }[] = [
    { label: 'Gasto', icon: 'arrow-up', color: theme.danger, href: { pathname: '/finance/entry', params: { kind: 'expense' } } },
    { label: 'Ingreso', icon: 'arrow-down', color: theme.primary, href: { pathname: '/finance/entry', params: { kind: 'income' } } },
    ...(isDriver
      ? [{ label: 'Jornada', icon: 'car' as const, color: chartColor(CHART_LIGHT[2], theme), href: { pathname: '/finance/entry', params: { mode: 'shift' } } as Href }]
      : []),
    ...(showFuelAction
      ? [{ label: 'Gasolina', icon: 'speedometer' as const, color: chartColor(CHART_LIGHT[7], theme), href: { pathname: '/finance/entry', params: { mode: 'fuel' } } as Href }]
      : []),
  ];

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Finanzas</Text>
        <HeaderButton icon="settings-outline" label="Ajustes de Finanzas" onPress={() => router.push('/finance/settings')} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.periodRow}>
          <Segmented
            value={period}
            onChange={changePeriod}
            options={[{ value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' }]}
            style={styles.periodToggle}
          />
          <View style={[styles.nav, cardStyle(theme)]}>
            <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={10} accessibilityLabel="Periodo anterior" style={styles.navButton}>
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </Pressable>
            <Text style={[styles.periodLabel, { color: theme.text }]} numberOfLines={1}>{periodLabel}</Text>
            <Pressable
              onPress={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset === 0}
              hitSlop={10}
              accessibilityLabel="Periodo siguiente"
              style={styles.navButton}
            >
              <Ionicons name="chevron-forward" size={20} color={offset === 0 ? theme.border : theme.text} />
            </Pressable>
          </View>
        </View>

        <GradientCard colors={theme.heroFinance}>
          <Text style={[styles.heroLabel, { color: ON_GRADIENT.muted }]}>Balance · {periodLabel.toLowerCase()}</Text>
          <Text
            style={[styles.heroValue, { color: ON_GRADIENT.text }]}
            accessibilityLabel={`Balance: ${formatMoney(totals.balance, currency)}`}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatMoney(totals.balance, currency)}
          </Text>
          {trend.length > 0 && (
            <View style={styles.spark}>
              <Sparkline
                values={trend}
                slots={slots}
                color="#FFFFFF"
                ringColor={theme.heroFinance[1]}
                zeroColor={ON_GRADIENT.faint}
                accessibilityLabel={`Cómo va el balance: ${formatMoney(trend[trend.length - 1], currency)} al ${trend.length === slots ? 'cierre' : 'día de hoy'}`}
              />
              <View style={styles.sparkDates}>
                <Text style={[styles.sparkDate, { color: ON_GRADIENT.muted }]}>{formatShortDate(range.start, today)}</Text>
                <Text style={[styles.sparkDate, { color: ON_GRADIENT.muted }]}>{formatShortDate(range.end, today)}</Text>
              </View>
            </View>
          )}
          <View style={styles.totals}>
            <Total icon="arrow-down" label="Ingresos" value={formatMoney(totals.income, currency)} />
            <Total icon="arrow-up" label="Gastos" value={formatMoney(totals.expense, currency)} />
            {totals.saved !== 0 && <Total icon="wallet" label="Ahorro" value={formatMoney(totals.saved, currency)} />}
          </View>
          {comparison && <Text style={[styles.comparison, { color: ON_GRADIENT.muted }]}>{comparison}</Text>}
        </GradientCard>

        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => router.push(a.href)}
              accessibilityRole="button"
              accessibilityLabel={`Registrar ${a.label.toLowerCase()}`}
              style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color, boxShadow: `0px 6px 14px ${a.color}40` }]}>
                <Ionicons name={a.icon} size={22} color={inkOn(a.color)} />
              </View>
              <Text style={[styles.actionText, { color: theme.text }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'summary', label: 'Resumen' },
            { value: 'movements', label: 'Movimientos' },
            { value: 'plans', label: 'Planes' },
          ]}
        />

        {view === 'summary' && <SummaryView range={range} period={period} onBudget={setBudgetTarget} />}
        {view === 'movements' && <MovementsView range={range} />}
        {view === 'plans' && <PlansView onBudget={setBudgetTarget} />}
      </ScrollView>

      <BudgetSheet target={budgetTarget} onClose={() => setBudgetTarget(null)} />
    </>
  );
}

/**
 * Compara el gasto con el periodo anterior. Con el periodo en curso no se compara en %
 * (medio mes contra un mes entero engaña): se da el total anterior como referencia.
 */
function compareExpenses(current: number, previous: number, period: FinancePeriod, ongoing: boolean, currency: CurrencyCode): string | null {
  if (previous <= 0) return null;
  const label = PREVIOUS_PERIOD[period];
  if (ongoing) return `En ${label} gastaste ${formatMoney(previous, currency)} en total.`;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return `Gastaste lo mismo que en ${label}.`;
  return `Gastaste un ${Math.abs(change)} % ${change < 0 ? 'menos' : 'más'} que en ${label}.`;
}

/** Ingresos, gastos o ahorro en una pastilla translúcida sobre el degradado. */
function Total({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={[styles.total, { backgroundColor: ON_GRADIENT.faint }]}>
      <View style={styles.totalLabelRow}>
        <Ionicons name={icon} size={12} color={ON_GRADIENT.muted} />
        <Text style={[styles.totalLabel, { color: ON_GRADIENT.muted }]}>{label}</Text>
      </View>
      <Text style={[styles.totalValue, { color: ON_GRADIENT.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 4 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  periodToggle: { width: 148 },
  nav: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingVertical: 6 },
  navButton: { paddingHorizontal: 8, paddingVertical: 4 },
  periodLabel: { flexShrink: 1, fontSize: 14.5, fontWeight: '800', textAlign: 'center' },
  heroLabel: { fontSize: 13, fontWeight: '700' },
  heroValue: { fontSize: 40, fontWeight: '800', letterSpacing: -1, marginTop: 2 },
  spark: { marginHorizontal: -6, marginTop: 4 },
  sparkDates: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  sparkDate: { fontSize: 11, fontWeight: '600' },
  totals: { flexDirection: 'row', gap: 8, marginTop: 12 },
  total: { flex: 1, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 10, gap: 2 },
  totalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  totalLabel: { fontSize: 12, fontWeight: '700' },
  totalValue: { fontSize: 16, fontWeight: '800' },
  comparison: { fontSize: 12.5, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 4 },
  action: { alignItems: 'center', gap: 6, minWidth: 64 },
  actionIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 12.5, fontWeight: '700' },
});
