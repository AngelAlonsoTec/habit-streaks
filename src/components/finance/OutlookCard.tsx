import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StackedBars } from '@/components/charts/StackedBars';
import { creditColor } from '@/components/finance/CreditSheets';
import { Card } from '@/components/ui';
import { DateKey, formatShortDate, fromKey } from '@/lib/dates';
import { isEnded, Outlook, planProgress, Recurring } from '@/lib/finance';
import { CurrencyCode, formatMoney, formatMoneyRounded } from '@/lib/money';
import { CHART_LIGHT, chartColor, useTheme } from '@/theme';

/** "diciembre" o "marzo de 2027" (si es de otro año). */
const monthName = (date: DateKey, today: DateKey) => {
  const d = fromKey(date);
  const name = d.toLocaleDateString('es-ES', { month: 'long' });
  return d.getFullYear() === fromKey(today).getFullYear() ? name : `${name} de ${d.getFullYear()}`;
};

/**
 * Lo que viene: cómo cierra el mes si todo sigue igual (con lo que falta por entrar y salir y lo que
 * se gasta al día), lo que se debe, cuánto piden los fijos y las deudas los próximos meses y cuándo
 * se termina de pagar cada cosa.
 */
export function OutlookCard({ outlook: o, recurring, today, currency, format, formatTick }: {
  outlook: Outlook;
  recurring: Recurring[];
  today: DateKey;
  currency: CurrencyCode;
  format: (n: number) => string;
  formatTick: (n: number) => string;
}) {
  const theme = useTheme();
  const [month, setMonth] = useState<string | null>(null);
  const money = (n: number) => formatMoney(n, currency);
  const fixedColor = chartColor(CHART_LIGHT[0], theme);
  const debtColor = creditColor(theme);
  const thisMonth = monthName(o.monthEnd, today);

  // Lo que se termina de pagar en los próximos meses (lo más próximo primero).
  const endings = recurring
    .filter((r) => r.kind === 'expense' && r.count != null && !isEnded(r, today))
    .map((r) => ({ r, last: planProgress(r, today)?.lastDate }))
    .filter((x): x is { r: Recurring; last: DateKey } => x.last != null && x.last <= `${o.months.at(-1)!.key}-31`)
    .sort((a, b) => a.last.localeCompare(b.last))
    .slice(0, 3);

  const share = o.avgIncome ? Math.round((o.committed / o.avgIncome) * 100) : null;
  const selected = month ? o.months.find((m) => m.key === month) : undefined;
  const hasCommitments = o.months.some((m) => m.fixed + m.debts > 0);

  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <View style={[styles.icon, { backgroundColor: theme.surface }]}>
          <Ionicons name="telescope" size={15} color={theme.text} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: theme.text }]}>Lo que viene</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>Con tus fijos, deudas y lo que gastas al día</Text>
        </View>
      </View>

      <View style={[styles.projection, { backgroundColor: theme.surface }]} accessible accessibilityLabel={`Así cierras ${thisMonth}: ${money(o.projected)}`}>
        <Text style={[styles.small, { color: theme.muted }]}>Si todo sigue igual, cierras {thisMonth} con</Text>
        <Text style={[styles.projected, { color: o.projected < 0 ? theme.danger : theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {money(o.projected)}
        </Text>
      </View>
      <View style={styles.lines}>
        <Row label="Balance de hoy" value={money(o.balance)} />
        {o.incoming > 0 && <Row label="Lo que aún te entra" value={`+${money(o.incoming)}`} color={theme.primary} />}
        {o.outgoing > 0 && <Row label="Fijos, mensualidades y abonos" value={money(-o.outgoing)} />}
        {o.dailySpend > 0 && o.daysLeft > 0 && (
          <Row label={`Día a día (unos ${formatMoneyRounded(o.dailySpend, currency)} × ${o.daysLeft} ${o.daysLeft === 1 ? 'día' : 'días'})`} value={money(-o.dailySpend * o.daysLeft)} />
        )}
      </View>

      {o.debt > 0 && (
        <Text style={[styles.text, { color: theme.text }]}>
          Debes <Text style={styles.bold}>{money(o.debt)}</Text> entre mensualidades, compras a meses y abonos
          {o.debtEnds ? `; lo que tiene fecha lo terminas el ${formatShortDate(o.debtEnds, today)}` : ''}.
        </Text>
      )}

      {hasCommitments && (
        <>
          <Text style={[styles.small, { color: theme.muted }]}>Lo que piden tus fijos y deudas cada mes</Text>
          <StackedBars
            days={o.months.map((m) => ({
              key: m.key,
              label: m.label,
              name: m.label,
              parts: [
                { key: 'fijos', amount: m.fixed, color: fixedColor },
                { key: 'deudas', amount: m.debts, color: debtColor },
              ],
            }))}
            selected={month}
            onSelect={setMonth}
            format={format}
            formatTick={formatTick}
            height={110}
          />
          <View style={styles.legend}>
            <Legend color={fixedColor} label="Fijos" />
            <Legend color={debtColor} label="Deudas y compras a meses" />
          </View>
          <Text style={[styles.small, { color: theme.text }]}>
            {selected
              ? `${selected.label}: fijos ${money(selected.fixed)} · deudas ${money(selected.debts)} · en total ${money(selected.fixed + selected.debts)}`
              : endings.length
                ? `Va bajando: ${endings.map((e) => `en ${monthName(e.last, today)} terminas ${e.r.name}`).join('; ')}.`
                : 'Toca un mes para ver el detalle.'}
          </Text>
        </>
      )}

      {share != null && o.committed > 0 && (
        <Text style={[styles.text, { color: share >= 50 ? theme.warning : theme.muted }]}>
          Tus fijos y deudas se llevan {formatMoneyRounded(o.committed, currency)} al mes: el {share} % de lo que te entra
          (unos {formatMoneyRounded(o.avgIncome!, currency)} al mes).{share >= 50 ? ' Es más de la mitad: ojo con meterte a otra deuda.' : ''}
        </Text>
      )}
    </Card>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.rowLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: color ?? theme.text }]}>{value}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 12.5, marginTop: 1 },
  projection: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  projected: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  lines: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rowLabel: { fontSize: 13.5, flexShrink: 1 },
  rowValue: { fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  small: { fontSize: 12.5, lineHeight: 17 },
  text: { fontSize: 13.5, lineHeight: 19 },
  bold: { fontWeight: '800' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12.5, fontWeight: '600' },
});
