import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DayBars } from '@/components/charts/DayBars';
import { DonutChart } from '@/components/charts/DonutChart';
import { StackedBars } from '@/components/charts/StackedBars';
import { IconBadge, ProgressBar } from '@/components/finance/ui';
import { Card } from '@/components/ui';
import { DateKey, formatDayTitle, fromKey, WEEKDAY_LABELS, weekdayIndex } from '@/lib/dates';
import {
  budgetLevel, BudgetLevel, dailyFlow, driverStats, FinanceCategory, FinancePeriod, formatHours, fuelEfficiency, fuelStats,
  FUEL_CATEGORY, Range, shiftDays, topSlices, totalsByCategory,
} from '@/lib/finance';
import { CurrencyCode, currencyInfo, formatMoney, formatNumber } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { CHART_LIGHT, CHART_OTHER, chartColor, IconName, slotColor, Theme, useTheme } from '@/theme';

type Props = {
  range: Range;
  period: FinancePeriod;
  /** Abre el presupuesto de una categoría. */
  onBudget: (categoryId: string) => void;
};

const levelColor = (level: BudgetLevel, theme: Theme, fallback: string) =>
  level === 'over' ? theme.danger : level === 'near' ? theme.warning : fallback;

/** Etiqueta bajo cada columna: la inicial del día en la semana; en el mes, el 1 y cada 5. */
const dayLabel = (date: DateKey, period: FinancePeriod) => {
  const d = fromKey(date);
  if (period === 'week') return WEEKDAY_LABELS[weekdayIndex(d)];
  return d.getDate() === 1 || d.getDate() % 5 === 0 ? String(d.getDate()) : '';
};

/** "$2k", "$850": los topes del eje, cortos. */
const tickFormatter = (currency: CurrencyCode) => (n: number) => {
  if (n < 1000) return formatMoney(n, currency);
  const { symbol, symbolAfter } = currencyInfo(currency);
  const k = `${formatNumber(n / 1000, currency, 1)}k`;
  return symbolAfter ? `${k} ${symbol}` : `${symbol}${k}`;
};

export function SummaryView({ range, period, onBudget }: Props) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const transactions = useFinance((s) => s.transactions);
  const categories = useFinance((s) => s.categories);
  const platforms = useFinance((s) => s.platforms);
  const budgets = useFinance((s) => s.budgets);
  const profiles = useFinance((s) => s.profiles);
  const isDriver = profiles.includes('driver');
  const monthly = period === 'month';
  const [flowDay, setFlowDay] = useState<string | null>(null);
  const [shiftDay, setShiftDay] = useState<string | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const expenses = useMemo(() => totalsByCategory(transactions, 'expense', range), [transactions, range]);
  const incomes = useMemo(() => totalsByCategory(transactions, 'income', range), [transactions, range]);
  const flow = useMemo(() => dailyFlow(transactions, range), [transactions, range]);
  const driver = useMemo(() => (isDriver ? driverStats(transactions, range) : null), [isDriver, transactions, range]);
  const shifts = useMemo(() => (isDriver ? shiftDays(transactions, range) : []), [isDriver, transactions, range]);
  const fuel = useMemo(() => fuelStats(transactions, range), [transactions, range]);
  const efficiency = useMemo(() => fuelEfficiency(transactions, range.end), [transactions, range.end]);
  const hasFuelCategory = categories.some((c) => c.id === FUEL_CATEGORY);
  const showFuel = hasFuelCategory && (isDriver || transactions.some((t) => t.fuel));
  const formatTick = tickFormatter(currency);
  const money = (n: number) => formatMoney(n, currency);

  // En el mes, las categorías con presupuesto salen aunque aún no tengan gastos.
  const expenseRows = useMemo(() => {
    const rows = expenses.map((e) => ({ categoryId: e.categoryId, amount: e.amount }));
    if (monthly) {
      for (const id of Object.keys(budgets)) if (!rows.some((r) => r.categoryId === id)) rows.push({ categoryId: id, amount: 0 });
    }
    return rows;
  }, [expenses, budgets, monthly]);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = incomes.reduce((s, e) => s + e.amount, 0);

  // Dona: las 4 categorías con más gasto y "Otros". Cada una con su color de siempre y en el orden
  // de la paleta (así los vecinos son los que se distinguen bien entre sí).
  const colorOf = (c: FinanceCategory | undefined) => chartColor(c?.color ?? CHART_OTHER, theme);
  const slices = topSlices(expenses, 4)
    .map((s) => {
      const category = s.categoryId ? categoryMap.get(s.categoryId) : undefined;
      const order = s.categoryId ? CHART_LIGHT.indexOf((category?.color ?? '').toUpperCase()) : 99;
      return { ...s, name: category?.name ?? 'Otros', color: s.categoryId ? colorOf(category) : chartColor(CHART_OTHER, theme), order: order < 0 ? 98 : order };
    })
    .sort((a, b) => a.order - b.order);
  const folded = Math.max(0, expenses.length - 4);

  const alerts = monthly
    ? expenseRows
        .filter((r) => budgets[r.categoryId] != null && budgetLevel(r.amount, budgets[r.categoryId]) !== 'ok')
        .map((r) => ({ ...r, budget: budgets[r.categoryId], level: budgetLevel(r.amount, budgets[r.categoryId]) }))
    : [];

  // Ganancia por día del conductor: cada app con su color fijo (por su lugar en la lista de plataformas).
  const platformNames = driver ? driver.platforms.map((p) => p.platform) : [];
  const platformColor = (name: string) => {
    const i = platforms.indexOf(name);
    return slotColor(i >= 0 ? i : platforms.length + platformNames.filter((p) => !platforms.includes(p)).indexOf(name), theme);
  };
  const legendPlatforms = [...platformNames].sort((a, b) => {
    const ia = platforms.indexOf(a);
    const ib = platforms.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const stackedDays = shifts.map((d) => ({
    key: d.date,
    label: dayLabel(d.date, period),
    name: formatDayTitle(d.date, today),
    parts: legendPlatforms.map((p) => ({ key: p, amount: d.byPlatform[p] ?? 0, color: platformColor(p) })),
  }));
  const selectedShift = shiftDay ? shifts.find((d) => d.date === shiftDay) : undefined;

  const flowDays = flow.map((d) => ({ key: d.date, label: dayLabel(d.date, period), name: formatDayTitle(d.date, today), income: d.income, expense: d.expense }));
  const selectedFlow = flowDay ? flow.find((d) => d.date === flowDay) : undefined;
  const busiest = flow.reduce<(typeof flow)[number] | null>((best, d) => (d.expense > (best?.expense ?? 0) ? d : best), null);

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
            style={[styles.alert, { backgroundColor: color + theme.emptyAlpha }]}
          >
            <View style={[styles.alertIcon, { backgroundColor: color }]}>
              <Ionicons name={a.level === 'over' ? 'alert' : 'warning'} size={15} color="#FFFFFF" />
            </View>
            <Text style={[styles.alertText, { color: theme.text }]}>
              {a.level === 'over'
                ? `${name}: te pasaste ${money(a.amount - a.budget)} del presupuesto`
                : `${name}: llevas el ${Math.round((a.amount / a.budget) * 100)} % del presupuesto`}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </Pressable>
        );
      })}

      {driver && (
        <Card style={styles.card}>
          <CardTitle icon="car" title="Manejando" subtitle={driver.platforms.length ? 'Lo que dejó cada día' : undefined} />
          {driver.platforms.length === 0 ? (
            <Text style={[styles.muted, { color: theme.muted }]}>
              Registra tus jornadas con el botón «Jornada»: verás cuánto te deja cada plataforma por hora y por viaje.
            </Text>
          ) : (
            <>
              <StackedBars days={stackedDays} selected={shiftDay} onSelect={setShiftDay} format={money} formatTick={formatTick} />
              {legendPlatforms.length > 1 && (
                <View style={styles.legend}>
                  {legendPlatforms.map((p) => (
                    <View key={p} style={styles.legendItem}>
                      <View style={[styles.dot, { backgroundColor: platformColor(p) }]} />
                      <Text style={[styles.legendText, { color: theme.muted }]}>{p}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={[styles.detail, { color: theme.text }]}>
                {selectedShift
                  ? `${formatDayTitle(selectedShift.date, today)} · ${
                      Object.keys(selectedShift.byPlatform).length
                        ? legendPlatforms.filter((p) => selectedShift.byPlatform[p]).map((p) => `${p} ${money(selectedShift.byPlatform[p])}`).join(' · ')
                        : 'sin jornada'
                    }`
                  : 'Toca un día para ver lo de cada app.'}
              </Text>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Line label="Ganado en viajes" value={money(driver.income)} />
              <Line label="Gastos del auto" value={money(-driver.vehicleCosts)} />
              <Line label="Te dejó" value={money(driver.net)} strong color={driver.net < 0 ? theme.danger : theme.primary} />
              <View style={styles.stats}>
                {driver.netPerHour != null && <Stat label="Neto por hora" value={money(driver.netPerHour)} />}
                {driver.perHour != null && <Stat label="Bruto por hora" value={money(driver.perHour)} />}
                {driver.perTrip != null && <Stat label="Por viaje" value={money(driver.perTrip)} />}
              </View>

              {driver.platforms.map((p) => (
                <View key={p.platform} style={styles.platform}>
                  <View style={[styles.dot, { backgroundColor: platformColor(p.platform) }]} />
                  <View style={styles.flex}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>{p.platform}</Text>
                    <Text style={[styles.small, { color: theme.muted }]}>
                      {[
                        p.hours ? formatHours(p.hours) : null,
                        p.trips ? `${p.trips} ${p.trips === 1 ? 'viaje' : 'viajes'}` : null,
                        p.perHour != null ? `${money(p.perHour)}/h` : null,
                        p.perTrip != null ? `${money(p.perTrip)}/viaje` : null,
                      ].filter(Boolean).join(' · ') || `${p.shifts} ${p.shifts === 1 ? 'jornada' : 'jornadas'}`}
                    </Text>
                  </View>
                  <Text style={[styles.amount, { color: theme.text }]}>{money(p.income)}</Text>
                </View>
              ))}
            </>
          )}
        </Card>
      )}

      {expenseRows.length > 0 && (
        <Card style={styles.card}>
          <CardTitle icon="pie-chart" title="En qué se va tu dinero" />
          {totalExpense > 0 && (
            <View style={styles.donutRow}>
              <DonutChart
                segments={slices.map((s) => ({ key: s.categoryId ?? 'otros', value: s.amount, color: s.color }))}
                trackColor={theme.surface}
                accessibilityLabel={`Gastos por categoría: ${slices.map((s) => `${s.name} ${Math.round((s.amount / totalExpense) * 100)} %`).join(', ')}`}
              >
                <Text style={[styles.donutLabel, { color: theme.muted }]}>Gastos</Text>
                <Text style={[styles.donutValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {money(totalExpense)}
                </Text>
              </DonutChart>
              <View style={styles.donutLegend}>
                {slices.map((s) => (
                  <View key={s.categoryId ?? 'otros'} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: s.color }]} />
                    <Text style={[styles.legendName, { color: theme.text }]} numberOfLines={1}>
                      {s.categoryId ? s.name : `Otros (${folded})`}
                    </Text>
                    <Text style={[styles.legendPct, { color: theme.muted }]}>{Math.round((s.amount / totalExpense) * 100)} %</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={styles.list}>
            {expenseRows.map((r) => (
              <CategoryRow
                key={r.categoryId}
                category={categoryMap.get(r.categoryId)}
                color={colorOf(categoryMap.get(r.categoryId))}
                amount={r.amount}
                share={totalExpense ? r.amount / totalExpense : 0}
                budget={monthly ? budgets[r.categoryId] : undefined}
                currency={currency}
                onPress={() => onBudget(r.categoryId)}
              />
            ))}
          </View>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {monthly ? 'Toca una categoría para ponerle un presupuesto mensual.' : 'Los presupuestos se ven en la vista por mes.'}
          </Text>
        </Card>
      )}

      {!empty && (
        <Card style={styles.card}>
          <CardTitle icon="bar-chart" title="Día a día" subtitle="Ingresos arriba, gastos abajo" />
          <DayBars
            days={flowDays}
            incomeColor={chartColor(CHART_LIGHT[2], theme)}
            expenseColor={chartColor(CHART_LIGHT[7], theme)}
            selected={flowDay}
            onSelect={setFlowDay}
            format={money}
            formatTick={formatTick}
          />
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: chartColor(CHART_LIGHT[2], theme) }]} />
              <Text style={[styles.legendText, { color: theme.muted }]}>Ingresos</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: chartColor(CHART_LIGHT[7], theme) }]} />
              <Text style={[styles.legendText, { color: theme.muted }]}>Gastos</Text>
            </View>
          </View>
          <Text style={[styles.detail, { color: theme.text }]}>
            {selectedFlow
              ? `${formatDayTitle(selectedFlow.date, today)} · ingresos ${money(selectedFlow.income)} · gastos ${money(selectedFlow.expense)}`
              : busiest
                ? `Día de más gasto: ${formatDayTitle(busiest.date, today)} (${money(busiest.expense)}). Toca un día para ver el detalle.`
                : 'Toca un día para ver el detalle.'}
          </Text>
        </Card>
      )}

      {incomes.length > 0 && (
        <Card style={styles.card}>
          <CardTitle icon="arrow-down-circle" title="De dónde entra" />
          <View style={styles.list}>
            {incomes.map((r) => (
              <CategoryRow
                key={r.categoryId}
                category={categoryMap.get(r.categoryId)}
                color={colorOf(categoryMap.get(r.categoryId))}
                amount={r.amount}
                share={totalIncome ? r.amount / totalIncome : 0}
                currency={currency}
              />
            ))}
          </View>
        </Card>
      )}

      {showFuel && (
        <Card style={styles.card}>
          <CardTitle icon="speedometer" title="Gasolina" />
          {fuel.fills > 0 ? (
            <View style={styles.stats}>
              <Stat label="Gastado" value={money(fuel.spent)} />
              {fuel.liters > 0 && <Stat label="Litros" value={`${formatNumber(fuel.liters, currency, 1)} l`} />}
              {fuel.pricePerLiter != null && <Stat label="Precio medio" value={`${money(fuel.pricePerLiter)}/l`} />}
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
              <Stat label="Costo por km" value={money(efficiency.costPerKm)} />
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
          <View style={[styles.emptyIcon, { backgroundColor: theme.surface }]}>
            <Ionicons name="receipt-outline" size={30} color={theme.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nada por aquí todavía</Text>
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            Usa los botones de arriba para apuntar tu primer gasto o ingreso de este periodo.
          </Text>
        </View>
      )}
    </View>
  );
}

function CardTitle({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.cardTitle}>
      <View style={[styles.cardIcon, { backgroundColor: theme.surface }]}>
        <Ionicons name={icon} size={15} color={theme.text} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.cardTitleText, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.cardSubtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
      </View>
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

function CategoryRow({ category, color, amount, share, budget, currency, onPress }: {
  category: FinanceCategory | undefined;
  color: string;
  amount: number;
  /** Parte del total (0-1). */
  share: number;
  budget?: number;
  currency: CurrencyCode;
  onPress?: () => void;
}) {
  const theme = useTheme();
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
      <IconBadge icon={category?.icon ?? 'help'} color={color} size={34} />
      <View style={styles.flex}>
        <View style={styles.categoryHeader}>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.amount, { color: theme.text }]}>
            {formatMoney(amount, currency)}
            {budget != null && <Text style={[styles.small, { color: theme.muted }]}> / {formatMoney(budget, currency)}</Text>}
          </Text>
        </View>
        {budget != null ? (
          <ProgressBar progress={amount / budget} color={barColor} track={theme.surface} style={styles.bar} />
        ) : (
          <Text style={[styles.small, { color: theme.muted }]}>{Math.round(share * 100)} % del total</Text>
        )}
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
  gap: { gap: 14 },
  flex: { flex: 1 },
  card: { gap: 12 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitleText: { fontSize: 16, fontWeight: '800' },
  cardSubtitle: { fontSize: 12.5, marginTop: 1 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16 },
  alertIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  alertText: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12.5, fontWeight: '600' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  detail: { fontSize: 13, lineHeight: 18 },
  platform: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  small: { fontSize: 12.5, fontWeight: '500' },
  amount: { fontSize: 14.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  lineLabel: { fontSize: 14 },
  lineValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  lineStrong: { fontSize: 16, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutLabel: { fontSize: 12, fontWeight: '700' },
  donutValue: { fontSize: 17, fontWeight: '800', maxWidth: 100 },
  donutLegend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendName: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  legendPct: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  list: { gap: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
  bar: { marginTop: 3, height: 6 },
  hint: { fontSize: 12, lineHeight: 17 },
  muted: { fontSize: 13.5, lineHeight: 19 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 20 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
