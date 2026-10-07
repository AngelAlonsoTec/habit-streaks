import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconBadge, PaymentBadge } from '@/components/finance/ui';
import { FinanceCategory, formatHours, shiftTrips, Transaction } from '@/lib/finance';
import { CurrencyCode, formatMoney, formatNumber } from '@/lib/money';
import { chartColor, useTheme } from '@/theme';

const UNKNOWN: FinanceCategory = { id: '', name: 'Sin categoría', icon: 'help', color: '#64748B', kind: 'expense' };

/** Detalle bajo el título: categoría, datos de la jornada o de la carga. */
export function transactionDetails(t: Transaction, category: FinanceCategory, currency: CurrencyCode): string {
  const parts: string[] = [];
  if (t.note) parts.push(category.name);
  if (t.shift) {
    parts.push(t.shift.platforms.map((p) => p.platform).join(' + '));
    if (t.shift.hours) parts.push(formatHours(t.shift.hours));
    const trips = shiftTrips(t.shift);
    if (trips) parts.push(`${trips} ${trips === 1 ? 'viaje' : 'viajes'}`);
  }
  if (t.fuel) {
    if (t.fuel.liters) parts.push(`${formatNumber(t.fuel.liters, currency)} l`);
    if (t.fuel.odometer) parts.push(`${formatNumber(t.fuel.odometer, currency, 0)} km`);
  }
  return parts.join(' · ');
}

type Props = {
  transaction: Transaction;
  category: FinanceCategory | undefined;
  currency: CurrencyCode;
  /** "Por cobrar: llega el lunes 12" si es una jornada que aún no se paga. */
  pending?: string;
  onPress: (t: Transaction) => void;
};

export function TransactionRow({ transaction: t, category = UNKNOWN, currency, pending, onPress }: Props) {
  const theme = useTheme();
  const income = t.kind === 'income';
  const title = t.note || category.name;
  const details = transactionDetails(t, category, currency);
  const amount = formatMoney(income ? t.amount : -t.amount, currency, { sign: true });
  return (
    <Pressable
      onPress={() => onPress(t)}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${amount}${pending ? `, ${pending}` : ''}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surface }]}
    >
      {/* Un gasto de Netflix o Spotify, con la insignia del servicio. */}
      {income ? (
        <IconBadge icon={category.icon} color={chartColor(category.color, theme)} size={36} />
      ) : (
        <PaymentBadge name={t.note} category={category} size={36} />
      )}
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        {(details || t.recurringId) ? (
          <View style={styles.detailsRow}>
            {t.recurringId && <Ionicons name="repeat" size={12} color={theme.muted} accessibilityLabel="Fijo" />}
            <Text style={[styles.details, { color: theme.muted }]} numberOfLines={1}>{details || 'Fijo'}</Text>
          </View>
        ) : null}
      </View>
      {/* En Movimientos, lo que sale en rojo y lo que entra en verde: se ve de un vistazo. */}
      <View style={styles.right}>
        <Text style={[styles.amount, { color: income ? theme.primary : theme.danger }]}>{amount}</Text>
        {pending && <Text style={[styles.pending, { color: theme.warning }]}>{pending}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 12 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700' },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  details: { fontSize: 12.5, flexShrink: 1 },
  amount: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  right: { alignItems: 'flex-end', gap: 2 },
  pending: { fontSize: 11.5, fontWeight: '700' },
});
