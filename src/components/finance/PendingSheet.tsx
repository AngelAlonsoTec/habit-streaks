import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SheetHeader, SheetModal, TextButton } from '@/components/finance/ui';
import { formatDayTitle } from '@/lib/dates';
import { describeArrival, pendingShifts } from '@/lib/finance';
import { formatMoney } from '@/lib/money';
import { releaseFocus } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { useTheme } from '@/theme';

/** Las jornadas cuyo dinero aún no llega, para marcarlas como cobradas antes de su día. */
export function PendingSheet({ open, onClose: close }: { open: boolean; onClose: () => void }) {
  const onClose = () => {
    releaseFocus();
    close();
  };
  return (
    <SheetModal open={open} onClose={onClose}>
      {open && <Body onClose={onClose} />}
    </SheetModal>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const transactions = useFinance((s) => s.transactions);
  const payouts = useFinance((s) => s.payouts);
  const markShiftPaid = useFinance((s) => s.markShiftPaid);
  const pending = pendingShifts(transactions, payouts, today);
  const total = pending.reduce((s, p) => s + p.amount, 0);

  const payAll = () => {
    for (const p of pending) markShiftPaid(p.transaction.id, today);
    onClose();
  };

  const openSettings = () => {
    onClose();
    router.push('/finance/settings');
  };

  return (
    <>
      <SheetHeader
        icon="time"
        color={theme.primary}
        title="Por cobrar"
        subtitle={pending.length ? `${formatMoney(total, currency)} de tus jornadas` : 'Nada pendiente'}
        onClose={onClose}
      />
      <Text style={[styles.note, { color: theme.muted }]}>
        Lo de las apps que pagan por semana (Uber, los lunes) no cuenta en el balance hasta que llega. Si ya te lo pagaron,
        márcalo y se suma.
      </Text>
      <ScrollView style={styles.body}>
        {pending.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle" size={36} color={theme.primary} />
            <Text style={[styles.note, { color: theme.muted }]}>Ya te pagaron todo.</Text>
          </View>
        )}
        {pending.map((p) => (
          <View key={p.transaction.id} style={[styles.row, { borderBottomColor: theme.border }]}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: theme.text }]}>
                {formatDayTitle(p.transaction.date, today)} · {p.platforms.join(' + ')}
              </Text>
              <Text style={[styles.small, { color: theme.muted }]}>{describeArrival(p.parts)}</Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.amount, { color: theme.text }]}>{formatMoney(p.amount, currency)}</Text>
              <TextButton
                label="Ya me pagaron"
                accessibilityLabel={`Ya me pagaron: ${formatDayTitle(p.transaction.date, today)}`}
                color={theme.primary}
                onPress={() => markShiftPaid(p.transaction.id, today)}
              />
            </View>
          </View>
        ))}
      </ScrollView>
      {pending.length > 1 && <PrimaryButton label="Ya me pagaron todo" color={theme.primaryFill} onPress={payAll} />}
      <View style={styles.center}>
        <TextButton label="Qué día paga cada app" icon="settings-outline" onPress={openSettings} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 0 },
  flex: { flex: 1, gap: 2 },
  note: { fontSize: 13, lineHeight: 18 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  right: { alignItems: 'flex-end', gap: 6 },
  title: { fontSize: 15, fontWeight: '700' },
  small: { fontSize: 12.5 },
  amount: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  center: { alignItems: 'center' },
});
