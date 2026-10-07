import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TransactionRow } from '@/components/finance/TransactionRow';
import { Card, Chip } from '@/components/ui';
import { DateKey, formatDayTitle, formatShortDate } from '@/lib/dates';
import { byNewest, inRange, pendingShifts, Range, Transaction, TxKind, weekdayDate } from '@/lib/finance';
import { formatMoney } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { useTheme } from '@/theme';

const openTransaction = (t: Transaction) => router.push({ pathname: '/finance/entry', params: { id: t.id } });

/** Movimientos del periodo agrupados por día, con filtro por tipo. */
export function MovementsView({ range }: { range: Range }) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const transactions = useFinance((s) => s.transactions);
  const categories = useFinance((s) => s.categories);
  const payouts = useFinance((s) => s.payouts);
  const [filter, setFilter] = useState<TxKind | null>(null);
  const pending = useMemo(
    () => new Map(pendingShifts(transactions, payouts, today).map((p) => [p.transaction.id, `Por cobrar: llega el ${weekdayDate(p.date)}`])),
    [transactions, payouts, today],
  );

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const days = useMemo(() => {
    const groups = new Map<DateKey, Transaction[]>();
    const visible = transactions.filter((t) => inRange(t.date, range) && (!filter || t.kind === filter)).sort(byNewest);
    for (const t of visible) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);
    return [...groups.entries()].map(([date, items]) => ({
      date,
      items,
      net: items.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0),
    }));
  }, [transactions, range, filter]);

  // Salvo hoy y ayer, día de la semana con su fecha: "Viernes 2 oct".
  const dayLabel = (date: DateKey) => {
    const title = formatDayTitle(date, today);
    return /\d$/.test(title) ? `${title.replace(/ \d+$/, '')} ${formatShortDate(date, today)}` : title;
  };

  return (
    <View style={styles.gap}>
      <View style={styles.filters}>
        <Chip label="Todos" selected={filter == null} onPress={() => setFilter(null)} />
        <Chip label="Ingresos" icon="arrow-down" selected={filter === 'income'} onPress={() => setFilter('income')} />
        <Chip label="Gastos" icon="arrow-up" selected={filter === 'expense'} onPress={() => setFilter('expense')} />
      </View>

      {days.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={40} color={theme.muted} />
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            {filter === 'income' ? 'Sin ingresos' : filter === 'expense' ? 'Sin gastos' : 'Sin movimientos'} en este periodo.
          </Text>
        </View>
      ) : (
        days.map((day) => (
          <Card key={day.date} style={styles.day}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayTitle, { color: theme.muted }]}>{dayLabel(day.date)}</Text>
              <Text style={[styles.dayTitle, { color: day.net < 0 ? theme.danger : theme.primary }]}>
                {formatMoney(day.net, currency, { sign: true })}
              </Text>
            </View>
            {day.items.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                category={categoryMap.get(t.categoryId)}
                currency={currency}
                pending={pending.get(t.id)}
                onPress={openTransaction}
              />
            ))}
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  filters: { flexDirection: 'row', gap: 8 },
  day: { paddingHorizontal: 8, paddingVertical: 10, gap: 2 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 2 },
  dayTitle: { fontSize: 12.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
