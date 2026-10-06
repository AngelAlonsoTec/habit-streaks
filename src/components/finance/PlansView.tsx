import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DepositSheet } from '@/components/finance/DepositSheet';
import { GoalSheet } from '@/components/finance/GoalSheet';
import { RecurringSheet } from '@/components/finance/RecurringSheet';
import { IconBadge, ProgressBar, TextButton } from '@/components/finance/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { Card, SectionTitle } from '@/components/ui';
import { formatShortDate } from '@/lib/dates';
import {
  budgetLevel, describeFrequencyShort, monthlyEquivalent, monthSpent, nextOccurrence, Recurring, savedAmount, SavingsGoal,
  savingsPace,
} from '@/lib/finance';
import { formatMoney, formatMoneyRounded } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { CHART_OTHER, chartColor, inkOn, useTheme } from '@/theme';

/** Metas de ahorro, pagos y cobros fijos, y presupuestos. */
export function PlansView({ onBudget }: { onBudget: (categoryId: string | 'new') => void }) {
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
  const [editingRecurring, setEditingRecurring] = useState<Recurring | 'new' | null>(null);

  const fixedExpenses = recurring.filter((r) => r.kind === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const fixedIncome = recurring.filter((r) => r.kind === 'income').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const budgetEntries = Object.entries(budgets);
  const budgetTotal = budgetEntries.reduce((s, [, b]) => s + b, 0);
  // Las metas logradas, al final.
  const sortedGoals = [...goals].sort((a, b) => Number(a.achievedOn != null) - Number(b.achievedOn != null));

  return (
    <View>
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

      <SectionTitle right={<TextButton label="Nuevo fijo" icon="add" onPress={() => setEditingRecurring('new')} />}>
        Pagos y cobros fijos
      </SectionTitle>
      {recurring.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>
          Renta, internet, suscripciones, tu sueldo o tu mesada: se apuntan solos el día que tocan.
        </Text>
      ) : (
        <Card style={styles.listCard}>
          {recurring.map((r) => {
            const category = categories.find((c) => c.id === r.categoryId);
            return (
              <Pressable
                key={r.id}
                onPress={() => setEditingRecurring(r)}
                accessibilityLabel={`Fijo ${r.name}`}
                style={({ pressed }) => [styles.row, styles.listRow, pressed && { backgroundColor: theme.surface }]}
              >
                <IconBadge icon={category?.icon ?? 'repeat'} color={chartColor(category?.color ?? CHART_OTHER, theme)} size={34} />
                <View style={styles.flex}>
                  <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{r.name}</Text>
                  <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
                    {describeFrequencyShort(r)} · próximo {formatShortDate(nextOccurrence(r, today), today)}
                  </Text>
                </View>
                <Text style={[styles.amount, { color: r.kind === 'income' ? theme.primary : theme.text }]}>
                  {formatMoney(r.kind === 'income' ? r.amount : -r.amount, currency, { sign: true })}
                </Text>
              </Pressable>
            );
          })}
          <Text style={[styles.footnote, { color: theme.muted }]}>
            {[
              fixedExpenses > 0 ? `Pagos: unos ${formatMoneyRounded(fixedExpenses, currency)} al mes` : null,
              fixedIncome > 0 ? `cobros: unos ${formatMoneyRounded(fixedIncome, currency)} al mes` : null,
            ].filter(Boolean).join(' · ').replace(/^c/, 'C')}
          </Text>
        </Card>
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
            const category = categories.find((c) => c.id === id);
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
      <RecurringSheet recurring={editingRecurring} onClose={() => setEditingRecurring(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  budget: { gap: 8 },
  footnote: { fontSize: 12, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 2 },
  empty: { fontSize: 13.5, lineHeight: 19 },
});
