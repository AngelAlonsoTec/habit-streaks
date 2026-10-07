import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { creditColor, CreditTarget } from '@/components/finance/CreditSheets';
import { DepositSheet } from '@/components/finance/DepositSheet';
import { GoalSheet } from '@/components/finance/GoalSheet';
import { RecurringTarget } from '@/components/finance/RecurringSheet';
import { IconBadge, PaymentBadge, ProgressBar, TextButton } from '@/components/finance/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { Card, SectionTitle } from '@/components/ui';
import { formatShortDate } from '@/lib/dates';
import {
  abonoState, budgetLevel, byNextCharge, chargeOn, Credit, creditSummary, describeFrequencyShort, describeWhen, FinanceCategory,
  fixedSummary, isEnded, monthlyEquivalent, monthSpent, nextOccurrence, paidTo, planProgress, Recurring, savedAmount, SavingsGoal,
  savingsPace, Transaction,
} from '@/lib/finance';
import { CurrencyCode, formatMoney, formatMoneyRounded } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { CHART_OTHER, chartColor, inkOn, useTheme } from '@/theme';

type Props = {
  onBudget: (categoryId: string | 'new') => void;
  onRecurring: (target: RecurringTarget) => void;
  onCredit: (target: CreditTarget) => void;
  /** Abre una compra de un crédito, o una nueva (null). */
  onPurchase: (creditId: string, purchase: Recurring | null) => void;
  /** Abre el panel para apuntar un abono. */
  onAbono: (recurring: Recurring) => void;
};

/** Gastos e ingresos fijos, metas de ahorro y presupuestos. */
export function PlansView({ onBudget, onRecurring, onCredit, onPurchase, onAbono }: Props) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const goals = useFinance((s) => s.goals);
  const recurring = useFinance((s) => s.recurring);
  const budgets = useFinance((s) => s.budgets);
  const categories = useFinance((s) => s.categories);
  const transactions = useFinance((s) => s.transactions);
  const credits = useFinance((s) => s.credits);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | 'new' | null>(null);
  const [depositGoal, setDepositGoal] = useState<string | null>(null);

  // Las compras a meses van con su crédito, no en la lista de fijos; los que ya terminaron, aparte.
  const own = recurring.filter((r) => !r.creditId);
  const active = own.filter((r) => !isEnded(r, today));
  // Los abonos atrasados primero; luego, por el próximo cobro.
  const dueOf = (r: Recurring) => (r.variable ? abonoState(r, transactions, today).overdue[0] : undefined) ?? nextOccurrence(r, today) ?? r.startDate;
  const byDue = (list: Recurring[]) =>
    list.map((r) => ({ recurring: r, date: dueOf(r) })).sort((a, b) => a.date.localeCompare(b.date) || a.recurring.name.localeCompare(b.recurring.name));
  const fixedExpenses = byDue(active.filter((r) => r.kind === 'expense'));
  const fixedIncomes = byNextCharge(active.filter((r) => r.kind === 'income'), today);
  const finished = own.filter((r) => isEnded(r, today));
  const summary = fixedSummary(recurring, today, transactions);
  const fromCredits = fixedSummary(recurring.filter((r) => r.creditId), today).perMonth;
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
      {fixedExpenses.length === 0 && summary.perMonth === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>
          Netflix, la renta, el internet o el gimnasio: agrégalos una vez y se apuntan solos el día que se cobran. También los
          que duran un tiempo (4 meses, 2 quincenas).
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
          {(summary.subscriptions > 0 || fromCredits > 0) && (
            <Text style={[styles.footnote, { color: theme.muted }]}>
              {[
                summary.subscriptions > 0 ? `En suscripciones: ${formatMoneyRounded(summary.subscriptions, currency)} al mes.` : null,
                fromCredits > 0 ? `Incluye ${formatMoneyRounded(fromCredits, currency)} de tus créditos.` : null,
              ].filter(Boolean).join(' ')}
            </Text>
          )}
          {fixedExpenses.map(({ recurring: r, date }) => (
            <FixedRow
              key={r.id}
              recurring={r}
              date={date}
              category={categoryOf(r.categoryId)}
              currency={currency}
              onPress={() => onRecurring(r)}
              onAbono={() => onAbono(r)}
            />
          ))}
        </Card>
      )}

      <SectionTitle right={<TextButton label="Nuevo" icon="add" accessibilityLabel="Nuevo crédito" onPress={() => onCredit('new')} />}>
        Créditos y compras a meses
      </SectionTitle>
      {credits.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>
          ¿Pagas algo a meses o con tarjeta? Agrega el crédito y lo que compraste con él: verás cuánto te toca pagar cada mes
          (aunque cambie), cuánto debes y cuándo terminas.
        </Text>
      ) : (
        <View style={styles.list}>
          {credits.map((c) => (
            <CreditCard key={c.id} credit={c} currency={currency} onEdit={() => onCredit(c)} onPurchase={(p) => onPurchase(c.id, p)} />
          ))}
        </View>
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

      {finished.length > 0 && (
        <>
          <SectionTitle>Terminados</SectionTitle>
          <Card style={styles.listCard}>
            {finished.map((r) => {
              const paid = paidTo(r, transactions);
              const end = r.endedOn ?? planProgress(r, today)?.lastDate ?? paid.last;
              const why = r.endKind === 'cancelled' ? 'Lo dejaste de pagar' : r.endKind === 'settled' ? 'Liquidado' : 'Terminó';
              return (
                <Pressable
                  key={r.id}
                  onPress={() => onRecurring(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`Terminado ${r.name}`}
                  style={({ pressed }) => [styles.row, styles.listRow, pressed && { backgroundColor: theme.surface }]}
                >
                  <Ionicons
                    name={r.endKind === 'cancelled' ? 'stop-circle' : 'checkmark-circle'}
                    size={24}
                    color={r.endKind === 'cancelled' ? theme.muted : theme.primary}
                  />
                  <View style={styles.flex}>
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[styles.small, { color: theme.muted }]} numberOfLines={2}>
                      {why}{end ? ` el ${formatShortDate(end, today)}` : ''}
                      {paid.count > 0 ? ` · pagaste ${formatMoney(paid.amount, currency)} en ${paid.count} ${paid.count === 1 ? 'pago' : 'pagos'}` : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </>
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
export function FixedRow({ recurring: r, date, category, currency, onPress, onAbono }: {
  recurring: Recurring;
  /** Próxima fecha en que se registra (en abonos, la más vieja sin abonar). */
  date: string;
  category: FinanceCategory | undefined;
  currency: CurrencyCode;
  onPress: () => void;
  onAbono?: () => void;
}) {
  const theme = useTheme();
  const today = useToday();
  const transactions = useFinance((s) => s.transactions);
  if (r.variable) return <AbonoRow recurring={r} category={category} currency={currency} transactions={transactions} onPress={onPress} onAbono={onAbono} />;
  const income = r.kind === 'income';
  const charge = chargeOn(r, date);
  const amount = formatMoney(income ? charge : -charge, currency, { sign: true });
  const when = describeWhen(date, today);
  const progress = planProgress(r, today);
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
          {progress
            ? `Pago ${progress.paid + 1} de ${progress.count} · ${income ? 'llega' : 'se cobra'} ${when}`
            : `${describeFrequencyShort(r)} · ${income ? 'llega' : 'se cobra'} ${when}`}
        </Text>
        {progress && (
          <ProgressBar progress={progress.paid / progress.count} color={chartColor(category?.color ?? CHART_OTHER, theme)} track={theme.surface} style={styles.planBar} />
        )}
      </View>
      <Text style={[styles.amount, { color: income ? theme.primary : theme.text }]}>{amount}</Text>
    </Pressable>
  );
}

/** Unos abonos: si toca abonar, cuánto se debe y un botón para apuntar el abono. */
function AbonoRow({ recurring: r, category, currency, transactions, onPress, onAbono }: {
  recurring: Recurring;
  category: FinanceCategory | undefined;
  currency: CurrencyCode;
  transactions: Transaction[];
  onPress: () => void;
  onAbono?: () => void;
}) {
  const theme = useTheme();
  const today = useToday();
  const state = abonoState(r, transactions, today);
  const due = state.overdue.length > 0;
  const status = due
    ? `Toca abonar · ${state.overdue[0] === today ? 'hoy' : `desde el ${formatShortDate(state.overdue[0], today)}`}`
    : state.next ? `Abonos · el próximo ${describeWhen(state.next, today)}` : 'Abonos';
  // La fila y el botón van uno al lado del otro (un botón dentro de otro no vale en web).
  return (
    <View style={[styles.row, styles.listRow]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Abonos ${r.name}: ${status}${state.owed != null ? `, debes ${formatMoney(state.owed, currency)}` : ''}`}
        style={({ pressed }) => [styles.row, styles.flex, pressed && { opacity: 0.7 }]}
      >
        <PaymentBadge name={r.name} category={category} size={36} />
        <View style={styles.flex}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{r.name}</Text>
          <Text style={[styles.small, { color: due ? theme.warning : theme.muted }, due && styles.bold]} numberOfLines={1}>{status}</Text>
          {state.owed != null && r.total != null && (
            <>
              <ProgressBar progress={state.paid / r.total} color={chartColor(category?.color ?? CHART_OTHER, theme)} track={theme.surface} style={styles.planBar} />
              <Text style={[styles.small, { color: theme.muted }]}>Debes {formatMoney(state.owed, currency)} de {formatMoney(r.total, currency)}</Text>
            </>
          )}
        </View>
      </Pressable>
      {onAbono && (
        <Pressable
          onPress={onAbono}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Abonar a ${r.name}`}
          style={({ pressed }) => [styles.abonar, { backgroundColor: due ? theme.primaryFill : theme.surface, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[styles.abonarText, { color: due ? inkOn(theme.primaryFill) : theme.text }]}>Abonar</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Un crédito: su próximo pago (la suma de lo que toca de cada compra), lo que se debe y sus compras. */
function CreditCard({ credit, currency, onEdit, onPurchase }: {
  credit: Credit;
  currency: CurrencyCode;
  onEdit: () => void;
  onPurchase: (purchase: Recurring | null) => void;
}) {
  const theme = useTheme();
  const today = useToday();
  const recurring = useFinance((s) => s.recurring);
  const categories = useFinance((s) => s.categories);
  const summary = creditSummary(credit.id, recurring, today);
  const color = creditColor(theme);
  return (
    <Card style={styles.creditCard}>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Crédito ${credit.name}`}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <IconBadge icon="card" color={color} size={36} />
        <View style={styles.flex}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{credit.name}</Text>
          <Text style={[styles.small, { color: theme.muted }]}>Se paga el día {credit.day}</Text>
        </View>
        <Ionicons name="create-outline" size={20} color={theme.muted} />
      </Pressable>

      {summary.next ? (
        <View style={[styles.fixedTotals, { backgroundColor: theme.surface }]}>
          <View style={styles.flex} accessible accessibilityLabel={`Próximo pago de ${credit.name}: ${formatMoney(summary.nextAmount, currency)}, ${describeWhen(summary.next, today)}`}>
            <Text style={[styles.small, { color: theme.muted }]}>Próximo pago · {describeWhen(summary.next, today)}</Text>
            <Text style={[styles.bigAmount, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(summary.nextAmount, currency)}</Text>
          </View>
          <View style={styles.alignEnd} accessible accessibilityLabel={`Debes ${formatMoney(summary.owed, currency)}`}>
            <Text style={[styles.small, { color: theme.muted }]}>Debes</Text>
            <Text style={[styles.yearAmount, { color: theme.text }]} numberOfLines={1}>{formatMoney(summary.owed, currency)}</Text>
            {summary.lastDate && <Text style={[styles.small, { color: theme.muted }]}>terminas el {formatShortDate(summary.lastDate, today)}</Text>}
          </View>
        </View>
      ) : (
        <Text style={[styles.small, { color: theme.muted }]}>Sin compras por pagar.</Text>
      )}

      {summary.active.map((r) => {
        const progress = planProgress(r, today)!;
        const category = categories.find((c) => c.id === r.categoryId);
        return (
          <Pressable
            key={r.id}
            onPress={() => onPurchase(r)}
            accessibilityRole="button"
            accessibilityLabel={`Compra ${r.name}: ${progress.paid} de ${progress.count}, faltan ${formatMoney(progress.owed, currency)}`}
            style={({ pressed }) => [styles.row, styles.purchase, pressed && { opacity: 0.7 }]}
          >
            <PaymentBadge name={r.name} category={category} size={32} />
            <View style={styles.flex}>
              <View style={styles.purchaseHeader}>
                <Text style={[styles.title, styles.flex, { color: theme.text }]} numberOfLines={1}>{r.name}</Text>
                <Text style={[styles.small, { color: theme.text }]}>{formatMoney(r.amount, currency)}/mes</Text>
              </View>
              <ProgressBar progress={progress.paid / progress.count} color={color} track={theme.surface} style={styles.planBar} />
              <Text style={[styles.small, { color: theme.muted }]}>
                {progress.paid} de {progress.count} · faltan {formatMoney(progress.owed, currency)}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {summary.finished.length > 0 && (
        <Text style={[styles.small, { color: theme.muted }]}>
          Liquidadas: {summary.finished.map((r) => r.name).join(', ')}.
        </Text>
      )}
      <TextButton label="Agregar compra" icon="add" accessibilityLabel={`Agregar compra a ${credit.name}`} onPress={() => onPurchase(null)} />
    </Card>
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
  planBar: { height: 4, marginTop: 5, marginBottom: 1 },
  bold: { fontWeight: '700' },
  abonar: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  abonarText: { fontSize: 13, fontWeight: '800' },
  subheader: { fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 8, paddingTop: 10 },
  creditCard: { gap: 12 },
  purchase: { alignItems: 'flex-start' },
  purchaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footnote: { fontSize: 12, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 2 },
  empty: { fontSize: 13.5, lineHeight: 19 },
});
