import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DepositSheet } from '@/components/finance/DepositSheet';
import { GoalSheet } from '@/components/finance/GoalSheet';
import { RecurringTarget } from '@/components/finance/RecurringSheet';
import { IconBadge, PaymentBadge, ProgressBar, TextButton } from '@/components/finance/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { Card, SectionTitle } from '@/components/ui';
import { formatShortDate } from '@/lib/dates';
import {
  budgetLevel, byNextCharge, describeFrequencyShort, describeWhen, FinanceCategory, fixedSummary, monthlyEquivalent, monthSpent,
  Recurring, savedAmount, SavingsGoal, savingsPace,
} from '@/lib/finance';
import { CurrencyCode, formatMoney, formatMoneyRounded } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { CHART_OTHER, chartColor, inkOn, useTheme } from '@/theme';

type Props = {
  onBudget: (categoryId: string | 'new') => void;
  onRecurring: (target: RecurringTarget) => void;
};

/** Gastos e ingresos fijos, metas de ahorro y presupuestos. */
export function PlansView({ onBudget, onRecurring }: Props) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const goals = useFinance((s) => s.goals);
  const recurring = useFinance((s) => s.recurring);
  const budgets = useFinance((s) => s.budgets);
  const categories = useFinance((s) => s.categories);
  const transactions = useFinance((s) => s.transactions);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | 'new' | null>(null);
  const [depositGoal, setDepositGoal] = useState<string | null>(null);

  const fixedExpenses = byNextCharge(recurring.filter((r) => r.kind === 'expense'), today);
  const fixedIncomes = byNextCharge(recurring.filter((r) => r.kind === 'income'), today);
  const summary = fixedSummary(recurring, today);
  const incomePerMonth = fixedIncomes.reduce((s, f) => s + monthlyEquivalent(f.recurring), 0);
  const budgetEntries = Object.entries(budgets);
  const budgetTotal = budgetEntries.reduce((s, [, b]) => s + b, 0);
  // Las metas logradas, al final.
  const sortedGoals = [...goals].sort((a, b) => Number(a.achievedOn != null) - Number(b.achievedOn != null));
  const categoryOf = (id: string) => categories.find((c) => c.id === id);

  return (
    <View>
      <SectionTitle
        right={<TextButton label="Nuevo" icon="add" accessibilityLabel="Nuevo gasto fijo" onPress={() => onRecurring('expense')} />}
      >
        Gastos fijos
      </SectionTitle>
      {fixedExpenses.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>
          Netflix, la renta, el internet o el gimnasio: agrégalos una vez y se apuntan solos el día que se cobran.
        </Text>
      ) : (
        <Card style={styles.listCard}>
          <View style={[styles.fixedTotals, { backgroundColor: theme.surface }]}>
            <View style={styles.flex}>
              <Text style={[styles.small, { color: theme.muted }]}>Al mes</Text>
              <Text style={[styles.bigAmount, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoneyRounded(summary.perMonth, currency)}
              </Text>
            </View>
            <View style={styles.alignEnd}>
              <Text style={[styles.small, { color: theme.muted }]}>Al año</Text>
              <Text style={[styles.yearAmount, { color: theme.text }]} numberOfLines={1}>{formatMoneyRounded(summary.perYear, currency)}</Text>
            </View>
          </View>
          {summary.subscriptions > 0 && (
            <Text style={[styles.footnote, { color: theme.muted }]}>
              En suscripciones: {formatMoneyRounded(summary.subscriptions, currency)} al mes.
            </Text>
          )}
          {fixedExpenses.map(({ recurring: r, date }) => (
            <FixedRow key={r.id} recurring={r} date={date} category={categoryOf(r.categoryId)} currency={currency} onPress={() => onRecurring(r)} />
          ))}
        </Card>
      )}

      <SectionTitle
        right={<TextButton label="Nuevo" icon="add" accessibilityLabel="Nuevo ingreso fijo" onPress={() => onRecurring('income')} />}
      >
        Ingresos fijos
      </SectionTitle>
      {fixedIncomes.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>
          Tu sueldo, la mesada o la beca: se apuntan solos el día que llegan.
        </Text>
      ) : (
        <Card style={styles.listCard}>
          {fixedIncomes.map(({ recurring: r, date }) => (
            <FixedRow key={r.id} recurring={r} date={date} category={categoryOf(r.categoryId)} currency={currency} onPress={() => onRecurring(r)} />
          ))}
          <Text style={[styles.footnote, { color: theme.muted }]}>
            Unos {formatMoneyRounded(incomePerMonth, currency)} al mes.
          </Text>
        </Card>
      )}

      <SectionTitle right={<TextButton label="Nueva meta" icon="add" onPress={() => setEditingGoal('new')} />}>
        Metas de ahorro
      </SectionTitle>
      {goals.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>
          Junta para algo concreto (un viaje, un fondo de emergencia, un celular) y ve cuánto te falta.
        </Text>
      ) : (
        <View style={styles.list}>
          {sortedGoals.map((g) => {
            const saved = savedAmount(g);
            const pace = savingsPace(g, today);
            const done = g.achievedOn != null;
            const paceText = done
              ? `¡Lograda el ${formatShortDate(g.achievedOn!, today)}!`
              : pace.overdue
                ? `La fecha pasó: faltan ${formatMoney(pace.remaining, currency)}`
                : pace.daysLeft === 0
                  ? `Vence hoy: faltan ${formatMoney(pace.remaining, currency)}`
                  : pace.perMonth != null || pace.perWeek != null
                    ? `Aparta ${formatMoney(pace.perMonth ?? pace.perWeek!, currency)} ${pace.perMonth != null ? 'al mes' : 'a la semana'} hasta el ${formatShortDate(g.dueDate!, today)}`
                    : `Faltan ${formatMoney(pace.remaining, currency)}`;
            return (
              <Pressable key={g.id} onPress={() => setEditingGoal(g)} accessibilityLabel={`Meta ${g.name}`}>
                <Card style={styles.goal}>
                  <View style={styles.row}>
                    <ProgressRing size={54} strokeWidth={5} progress={saved / g.target} color={g.color} trackColor={theme.surface}>
                      <Ionicons name={done ? 'trophy' : g.icon} size={22} color={g.color} />
                    </ProgressRing>
                    <View style={styles.flex}>
                      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{g.name}</Text>
                      <Text style={[styles.goalAmount, { color: theme.text }]} numberOfLines={1}>
                        {formatMoney(saved, currency)}
                        <Text style={[styles.small, { color: theme.muted }]}> de {formatMoney(g.target, currency)}</Text>
                      </Text>
                    </View>
                    {!done && (
                      <Pressable
                        onPress={() => setDepositGoal(g.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Abonar a ${g.name}`}
                        style={({ pressed }) => [styles.deposit, { backgroundColor: g.color, opacity: pressed ? 0.8 : 1 }]}
                      >
                        <Ionicons name="add" size={16} color={inkOn(g.color)} />
                        <Text style={[styles.depositText, { color: inkOn(g.color) }]}>Abonar</Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={[styles.goalFooter, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.small, styles.flex, { color: pace.overdue ? theme.danger : done ? theme.primary : theme.muted }]}>
                      {paceText}
                    </Text>
                    <Text style={[styles.goalPct, { color: theme.text }]} accessibilityLabel={`${formatMoney(saved, currency)} de ${formatMoney(g.target, currency)} · ${Math.floor((saved / g.target) * 100)} %`}>
                      {Math.floor((saved / g.target) * 100)} %
                    </Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <SectionTitle right={<TextButton label="Nuevo" icon="add" accessibilityLabel="Nuevo presupuesto" onPress={() => onBudget('new')} />}>
        Presupuestos del mes
      </SectionTitle>
      {budgetEntries.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>
          Ponle un tope mensual a una categoría (comida, ocio…) y te avisamos al acercarte.
        </Text>
      ) : (
        <Card style={styles.listCard}>
          {budgetEntries.map(([id, budget]) => {
            const category = categoryOf(id);
            const spent = monthSpent(transactions, id, today);
            const level = budgetLevel(spent, budget);
            const color = level === 'over' ? theme.danger : level === 'near' ? theme.warning : chartColor(category?.color ?? CHART_OTHER, theme);
            return (
              <Pressable
                key={id}
                onPress={() => onBudget(id)}
                accessibilityLabel={`Presupuesto ${category?.name ?? ''}`}
                style={({ pressed }) => [styles.listRow, styles.budget, pressed && { backgroundColor: theme.surface }]}
              >
                <View style={styles.row}>
                  <IconBadge icon={category?.icon ?? 'help'} color={chartColor(category?.color ?? CHART_OTHER, theme)} size={30} />
                  <Text style={[styles.title, styles.flex, { color: theme.text }]} numberOfLines={1}>{category?.name ?? 'Categoría'}</Text>
                  <Text style={[styles.small, { color: theme.muted }]}>
                    {formatMoney(spent, currency)} / {formatMoney(budget, currency)}
                  </Text>
                </View>
                <ProgressBar progress={spent / budget} color={color} track={theme.surface} />
              </Pressable>
            );
          })}
          <Text style={[styles.footnote, { color: theme.muted }]}>En total, {formatMoney(budgetTotal, currency)} al mes.</Text>
        </Card>
      )}

      <GoalSheet goal={editingGoal} onClose={() => setEditingGoal(null)} />
      <DepositSheet goalId={depositGoal} onClose={() => setDepositGoal(null)} />
    </View>
  );
}

/** Un fijo en la lista: su insignia, cada cuándo y cuándo toca el próximo. */
export function FixedRow({ recurring: r, date, category, currency, onPress }: {
  recurring: Recurring;
  /** Próxima fecha en que se registra. */
  date: string;
  category: FinanceCategory | undefined;
  currency: CurrencyCode;
  onPress: () => void;
}) {
  const theme = useTheme();
  const today = useToday();
  const income = r.kind === 'income';
  const amount = formatMoney(income ? r.amount : -r.amount, currency, { sign: true });
  const when = describeWhen(date, today);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Fijo ${r.name}, ${amount}, ${when}`}
      style={({ pressed }) => [styles.row, styles.listRow, pressed && { backgroundColor: theme.surface }]}
    >
      <PaymentBadge name={r.name} category={category} size={36} />
      <View style={styles.flex}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{r.name}</Text>
        <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
          {describeFrequencyShort(r)} · {income ? 'llega' : 'se cobra'} {when}
        </Text>
      </View>
      <Text style={[styles.amount, { color: income ? theme.primary : theme.text }]}>{amount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goal: { gap: 12 },
  goalAmount: { fontSize: 17, fontWeight: '800', marginTop: 1 },
  goalFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  goalPct: { fontSize: 13, fontWeight: '800' },
  title: { fontSize: 15, fontWeight: '700' },
  small: { fontSize: 12.5 },
  amount: { fontSize: 14.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  deposit: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
  depositText: { fontSize: 13, fontWeight: '800' },
  listCard: { paddingHorizontal: 8, paddingVertical: 8, gap: 2 },
  listRow: { paddingVertical: 9, paddingHorizontal: 8, borderRadius: 12 },
  fixedTotals: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  bigAmount: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  yearAmount: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  budget: { gap: 8 },
  footnote: { fontSize: 12, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 2 },
  empty: { fontSize: 13.5, lineHeight: 19 },
});
