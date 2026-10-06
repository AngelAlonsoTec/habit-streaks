import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BudgetSheet } from '@/components/finance/BudgetSheet';
import { MovementsView } from '@/components/finance/MovementsView';
import { FinanceOnboarding } from '@/components/finance/Onboarding';
import { PlansView } from '@/components/finance/PlansView';
import { SummaryView } from '@/components/finance/SummaryView';
import { HeaderButton, Segmented } from '@/components/ui';
import {
  describePeriod, FinancePeriod, FUEL_CATEGORY, periodRange, periodTotals, PREVIOUS_PERIOD,
} from '@/lib/finance';
import { CurrencyCode, formatMoney } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { IconName, useTheme } from '@/theme';

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

  const changePeriod = (p: FinancePeriod) => {
    setPeriod(p);
    setOffset(0);
  };

  const comparison = compareExpenses(totals.expense, previous.expense, period, offset === 0, currency);
  const showFuelAction = hasFuel && (isDriver || transactions.some((t) => t.fuel));
  const actions: { label: string; icon: IconName; color: string; href: Href }[] = [
    { label: 'Gasto', icon: 'remove', color: theme.danger, href: { pathname: '/finance/entry', params: { kind: 'expense' } } },
    { label: 'Ingreso', icon: 'add', color: theme.primary, href: { pathname: '/finance/entry', params: { kind: 'income' } } },
    ...(isDriver
      ? [{ label: 'Jornada', icon: 'car' as const, color: '#2EC4B6', href: { pathname: '/finance/entry', params: { mode: 'shift' } } as Href }]
      : []),
    ...(showFuelAction
      ? [{ label: 'Gasolina', icon: 'speedometer' as const, color: '#EF4444', href: { pathname: '/finance/entry', params: { mode: 'fuel' } } as Href }]
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
          <View style={styles.nav}>
            <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={10} accessibilityLabel="Periodo anterior">
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </Pressable>
            <Text style={[styles.periodLabel, { color: theme.text }]} numberOfLines={1}>{describePeriod(period, offset, today)}</Text>
            <Pressable
              onPress={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset === 0}
              hitSlop={10}
              accessibilityLabel="Periodo siguiente"
            >
              <Ionicons name="chevron-forward" size={22} color={offset === 0 ? theme.border : theme.text} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.balance, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.balanceLabel, { color: theme.muted }]}>Balance</Text>
          <Text
            style={[styles.balanceValue, { color: totals.balance < 0 ? theme.danger : theme.text }]}
            accessibilityLabel={`Balance: ${formatMoney(totals.balance, currency)}`}
          >
            {formatMoney(totals.balance, currency)}
          </Text>
          <View style={styles.totals}>
            <Total icon="arrow-down" label="Ingresos" value={formatMoney(totals.income, currency)} color={theme.primary} />
            <Total icon="arrow-up" label="Gastos" value={formatMoney(totals.expense, currency)} color={theme.danger} />
            {totals.saved !== 0 && <Total icon="wallet" label="Ahorro" value={formatMoney(totals.saved, currency)} color="#3B82F6" />}
          </View>
          {comparison && <Text style={[styles.comparison, { color: theme.muted }]}>{comparison}</Text>}
        </View>

        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => router.push(a.href)}
              accessibilityRole="button"
              accessibilityLabel={`Registrar ${a.label.toLowerCase()}`}
              style={({ pressed }) => [styles.action, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color }]}>
                <Ionicons name={a.icon} size={20} color="#FFFFFF" />
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

function Total({ icon, label, value, color }: { icon: IconName; label: string; value: string; color: string }) {
  const theme = useTheme();
  return (
    <View style={styles.total}>
      <View style={styles.totalLabelRow}>
        <Ionicons name={icon} size={13} color={color} />
        <Text style={[styles.totalLabel, { color: theme.muted }]}>{label}</Text>
      </View>
      <Text style={[styles.totalValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4 },
  title: { fontSize: 30, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  periodToggle: { width: 150 },
  nav: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  periodLabel: { flexShrink: 1, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  balance: { padding: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  balanceLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  balanceValue: { fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  totals: { flexDirection: 'row', gap: 12, marginTop: 6 },
  total: { flex: 1, gap: 2 },
  totalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  totalLabel: { fontSize: 12.5, fontWeight: '600' },
  totalValue: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  comparison: { fontSize: 12.5, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  actionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 13, fontWeight: '700' },
});
