import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconBadge, ProgressBar } from '@/components/finance/ui';
import { Card } from '@/components/ui';
import {
  budgetLevel, BudgetLevel, driverStats, FinanceCategory, FinancePeriod, formatHours, fuelEfficiency, fuelStats, FUEL_CATEGORY, Range,
  totalsByCategory,
} from '@/lib/finance';
import { CurrencyCode, formatMoney, formatNumber } from '@/lib/money';
import { useFinance } from '@/store/finance';
import { IconName, Theme, useTheme } from '@/theme';

type Props = {
  range: Range;
  period: FinancePeriod;
  /** Abre el presupuesto de una categoría. */
  onBudget: (categoryId: string) => void;
};

const levelColor = (level: BudgetLevel, theme: Theme, fallback: string) =>
  level === 'over' ? theme.danger : level === 'near' ? '#D97706' : fallback;

export function SummaryView({ range, period, onBudget }: Props) {
  const theme = useTheme();
  const currency = useFinance((s) => s.currency);
  const transactions = useFinance((s) => s.transactions);
  const categories = useFinance((s) => s.categories);
  const budgets = useFinance((s) => s.budgets);
  const profiles = useFinance((s) => s.profiles);
  const isDriver = profiles.includes('driver');
  const monthly = period === 'month';

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const expenses = useMemo(() => totalsByCategory(transactions, 'expense', range), [transactions, range]);
  const incomes = useMemo(() => totalsByCategory(transactions, 'income', range), [transactions, range]);
  const driver = useMemo(() => (isDriver ? driverStats(transactions, range) : null), [isDriver, transactions, range]);
  const fuel = useMemo(() => fuelStats(transactions, range), [transactions, range]);
  const efficiency = useMemo(() => fuelEfficiency(transactions, range.end), [transactions, range.end]);
  const hasFuelCategory = categories.some((c) => c.id === FUEL_CATEGORY);
  const showFuel = hasFuelCategory && (isDriver || transactions.some((t) => t.fuel));

  // En el mes, las categorías con presupuesto salen aunque aún no tengan gastos.
  const expenseRows = useMemo(() => {
    const rows = expenses.map((e) => ({ categoryId: e.categoryId, amount: e.amount }));
    if (monthly) {
      for (const id of Object.keys(budgets)) if (!rows.some((r) => r.categoryId === id)) rows.push({ categoryId: id, amount: 0 });
    }
    return rows;
  }, [expenses, budgets, monthly]);
  const maxExpense = Math.max(1, ...expenseRows.map((r) => r.amount));
  const maxIncome = Math.max(1, ...incomes.map((r) => r.amount));

  const alerts = monthly
    ? expenseRows
        .filter((r) => budgets[r.categoryId] != null && budgetLevel(r.amount, budgets[r.categoryId]) !== 'ok')
        .map((r) => ({ ...r, budget: budgets[r.categoryId], level: budgetLevel(r.amount, budgets[r.categoryId]) }))
    : [];

  const empty = !expenses.length && !incomes.length;

  return (
    <View style={styles.gap}>
      {alerts.map((a) => {
        const name = categoryMap.get(a.categoryId)?.name ?? 'Categoría';
        const color = levelColor(a.level, theme, theme.primary);
        return (
          <Pressable
            key={a.categoryId}
            onPress={() => onBudget(a.categoryId)}
            style={[styles.alert, { borderColor: color, backgroundColor: color + theme.emptyAlpha }]}
          >
            <Ionicons name={a.level === 'over' ? 'alert-circle' : 'warning'} size={18} color={color} />
            <Text style={[styles.alertText, { color: theme.text }]}>
              {a.level === 'over'
                ? `${name}: te pasaste ${formatMoney(a.amount - a.budget, currency)} del presupuesto`
                : `${name}: llevas el ${Math.round((a.amount / a.budget) * 100)} % del presupuesto`}
            </Text>
          </Pressable>
        );
      })}

      {driver && (
        <Card style={styles.card}>
          <CardTitle icon="car" title="Manejando" />
          {driver.platforms.length === 0 ? (
            <Text style={[styles.muted, { color: theme.muted }]}>
              Registra tus jornadas con el botón «Jornada»: verás cuánto te deja cada plataforma por hora y por viaje.
            </Text>
          ) : (
            <>
              {driver.platforms.map((p) => (
                <View key={p.platform} style={styles.platform}>
                  <View style={styles.flex}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>{p.platform}</Text>
                    <Text style={[styles.small, { color: theme.muted }]}>
                      {[
                        p.hours ? formatHours(p.hours) : null,
                        p.trips ? `${p.trips} ${p.trips === 1 ? 'viaje' : 'viajes'}` : null,
                        p.perHour != null ? `${formatMoney(p.perHour, currency)}/h` : null,
                        p.perTrip != null ? `${formatMoney(p.perTrip, currency)}/viaje` : null,
                      ].filter(Boolean).join(' · ') || `${p.shifts} ${p.shifts === 1 ? 'jornada' : 'jornadas'}`}
                    </Text>
                  </View>
                  <Text style={[styles.amount, { color: theme.text }]}>{formatMoney(p.income, currency)}</Text>
                </View>
              ))}
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Line label="Ganado en viajes" value={formatMoney(driver.income, currency)} />
              <Line label="Gastos del auto" value={formatMoney(-driver.vehicleCosts, currency)} />
              <Line label="Te dejó" value={formatMoney(driver.net, currency)} strong color={driver.net < 0 ? theme.danger : theme.primary} />
              <View style={styles.stats}>
                {driver.netPerHour != null && <Stat label="Neto por hora" value={formatMoney(driver.netPerHour, currency)} />}
                {driver.perHour != null && <Stat label="Bruto por hora" value={formatMoney(driver.perHour, currency)} />}
                {driver.perTrip != null && <Stat label="Por viaje" value={formatMoney(driver.perTrip, currency)} />}
              </View>
            </>
          )}
        </Card>
      )}

      {expenseRows.length > 0 && (
        <Card style={styles.card}>
          <CardTitle icon="arrow-up-circle-outline" title="Gastos por categoría" />
          {expenseRows.map((r) => (
            <CategoryRow
              key={r.categoryId}
              category={categoryMap.get(r.categoryId)}
              amount={r.amount}
              max={maxExpense}
              budget={monthly ? budgets[r.categoryId] : undefined}
              currency={currency}
              onPress={() => onBudget(r.categoryId)}
            />
          ))}
          <Text style={[styles.hint, { color: theme.muted }]}>
            {monthly ? 'Toca una categoría para ponerle un presupuesto mensual.' : 'Los presupuestos se ven en la vista por mes.'}
          </Text>
        </Card>
      )}

      {incomes.length > 0 && (
        <Card style={styles.card}>
          <CardTitle icon="arrow-down-circle-outline" title="Ingresos por categoría" />
          {incomes.map((r) => (
            <CategoryRow key={r.categoryId} category={categoryMap.get(r.categoryId)} amount={r.amount} max={maxIncome} currency={currency} />
          ))}
        </Card>
      )}

      {showFuel && (
        <Card style={styles.card}>
          <CardTitle icon="speedometer" title="Gasolina" />
          {fuel.fills > 0 ? (
            <View style={styles.stats}>
              <Stat label="Gastado" value={formatMoney(fuel.spent, currency)} />
              {fuel.liters > 0 && <Stat label="Litros" value={`${formatNumber(fuel.liters, currency, 1)} l`} />}
              {fuel.pricePerLiter != null && <Stat label="Precio medio" value={`${formatMoney(fuel.pricePerLiter, currency)}/l`} />}
            </View>
          ) : (
            <Text style={[styles.muted, { color: theme.muted }]}>Sin cargas en este periodo.</Text>
          )}
          {efficiency ? (
            <View style={styles.stats}>
              <Stat
                label={efficiency.estimated ? 'Rendimiento aprox.' : 'Rendimiento'}
                value={`${efficiency.estimated ? '≈ ' : ''}${formatNumber(efficiency.kmPerLiter, currency, 1)} km/l`}
              />
              <Stat label="Costo por km" value={formatMoney(efficiency.costPerKm, currency)} />
            </View>
          ) : null}
          <Text style={[styles.hint, { color: theme.muted }]}>
            {efficiency
              ? efficiency.estimated
                ? `Aproximado con tus últimas ${efficiency.intervals + 1} cargas (${formatNumber(efficiency.km, currency, 0)} km). Con dos cargas de tanque lleno seguidas sale exacto.`
                : `Calculado con ${formatNumber(efficiency.km, currency, 0)} km de tus últimas cargas con tanque lleno.`
              : 'Apunta el kilometraje al cargar: con tres cargas (o dos seguidas con tanque lleno) se calcula el rendimiento.'}
          </Text>
        </Card>
      )}

      {empty && !driver && (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={40} color={theme.muted} />
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            Aún no hay movimientos en este periodo. Usa los botones de arriba para apuntar el primero.
          </Text>
        </View>
      )}
    </View>
  );
}

function CardTitle({ icon, title }: { icon: IconName; title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.cardTitle}>
      <Ionicons name={icon} size={17} color={theme.muted} />
      <Text style={[styles.cardTitleText, { color: theme.text }]}>{title}</Text>
    </View>
  );
}

function Line({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[strong ? styles.lineStrong : styles.lineLabel, { color: strong ? theme.text : theme.muted }]}>{label}</Text>
      <Text style={[strong ? styles.lineStrong : styles.lineValue, { color: color ?? theme.text }]}>{value}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function CategoryRow({ category, amount, max, budget, currency, onPress }: {
  category: FinanceCategory | undefined;
  amount: number;
  max: number;
  budget?: number;
  currency: CurrencyCode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const color = category?.color ?? theme.muted;
  const level = budget != null ? budgetLevel(amount, budget) : null;
  const barColor = level ? levelColor(level, theme, color) : color;
  const name = category?.name ?? 'Sin categoría';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}: ${formatMoney(amount, currency)}${budget != null ? ` de ${formatMoney(budget, currency)}` : ''}`}
      style={({ pressed }) => [styles.categoryRow, pressed && { opacity: 0.7 }]}
    >
      <IconBadge icon={category?.icon ?? 'help'} color={color} size={30} />
      <View style={styles.flex}>
        <View style={styles.categoryHeader}>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.amount, { color: theme.text }]}>
            {formatMoney(amount, currency)}
            {budget != null && <Text style={[styles.small, { color: theme.muted }]}> / {formatMoney(budget, currency)}</Text>}
          </Text>
        </View>
        <ProgressBar
          progress={budget != null ? amount / budget : amount / max}
          color={barColor}
          track={color + theme.emptyAlpha}
          style={styles.bar}
        />
        {budget != null && level !== 'ok' && (
          <Text style={[styles.small, { color: barColor }]}>
            {level === 'over'
              ? `Te pasaste ${formatMoney(amount - budget, currency)}`
              : `Quedan ${formatMoney(budget - amount, currency)}`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  flex: { flex: 1 },
  card: { gap: 10 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitleText: { fontSize: 15, fontWeight: '800' },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  alertText: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  platform: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  small: { fontSize: 12.5, fontWeight: '500' },
  amount: { fontSize: 14.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  lineLabel: { fontSize: 14 },
  lineValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  lineStrong: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  bar: { marginTop: 5, height: 6 },
  hint: { fontSize: 12, lineHeight: 17 },
  muted: { fontSize: 13.5, lineHeight: 19 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 20 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
