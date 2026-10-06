import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AmountInput, ProgressBar, SheetHeader, SheetModal } from '@/components/finance/ui';
import { Chip } from '@/components/ui';
import { formatShortDate } from '@/lib/dates';
import { savedAmount, savingsPace } from '@/lib/finance';
import { formatMoney, moneyInputText, parseMoney } from '@/lib/money';
import { successFeedback, tapFeedback } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { inkOn, useTheme } from '@/theme';

type Props = {
  /** Meta a la que se abona; null = cerrado. */
  goalId: string | null;
  onClose: () => void;
};

/** Abonar o retirar dinero de una meta de ahorro. */
export function DepositSheet({ goalId, onClose }: Props) {
  return (
    <SheetModal open={goalId != null} onClose={onClose}>
      {goalId != null && <Body goalId={goalId} onClose={onClose} />}
    </SheetModal>
  );
}

function Body({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const goal = useFinance((s) => s.goals.find((g) => g.id === goalId));
  const addDeposit = useFinance((s) => s.addDeposit);
  const [text, setText] = useState('');

  if (!goal) return null;
  const saved = savedAmount(goal);
  const pace = savingsPace(goal, today);
  const amount = parseMoney(text, currency);
  const suggested = pace.perMonth ?? pace.perWeek;

  const apply = (sign: 1 | -1) => {
    if (amount == null) return;
    tapFeedback();
    addDeposit(goal.id, sign * amount, today);
    if (sign > 0 && saved < goal.target && saved + amount >= goal.target) successFeedback();
    onClose();
  };

  return (
    <>
      <SheetHeader
        icon={goal.icon}
        color={goal.color}
        title={goal.name}
        subtitle={`Llevas ${formatMoney(saved, currency)} de ${formatMoney(goal.target, currency)}`}
        onClose={onClose}
      />
      <ProgressBar progress={saved / goal.target} color={goal.color} track={goal.color + theme.emptyAlpha} />

      <AmountInput
        currency={currency}
        large
        value={text}
        onChangeText={setText}
        autoFocus
        onSubmitEditing={() => apply(1)}
        accessibilityLabel="Cantidad a abonar"
      />

      {(suggested != null || pace.remaining > 0) && (
        <View style={styles.wrap}>
          {suggested != null && (
            <Chip
              label={`${pace.perMonth != null ? 'Lo del mes' : 'Lo de la semana'}: ${formatMoney(suggested, currency)}`}
              onPress={() => setText(moneyInputText(suggested, currency))}
            />
          )}
          {pace.remaining > 0 && (
            <Chip label={`Lo que falta: ${formatMoney(pace.remaining, currency)}`} onPress={() => setText(moneyInputText(pace.remaining, currency))} />
          )}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => apply(-1)}
          disabled={amount == null || saved === 0}
          style={[styles.button, { backgroundColor: theme.surface, opacity: amount == null || saved === 0 ? 0.4 : 1 }]}
        >
          <Ionicons name="remove" size={18} color={theme.text} />
          <Text style={[styles.buttonText, { color: theme.text }]}>Retirar</Text>
        </Pressable>
        <Pressable
          onPress={() => apply(1)}
          disabled={amount == null}
          style={[styles.button, styles.primary, { backgroundColor: goal.color, opacity: amount == null ? 0.4 : 1 }]}
        >
          <Ionicons name="add" size={18} color={inkOn(goal.color)} />
          <Text style={[styles.buttonText, { color: inkOn(goal.color) }]}>Abonar</Text>
        </Pressable>
      </View>

      {goal.deposits.length > 0 && (
        <View style={styles.history}>
          {goal.deposits.slice(-4).reverse().map((d) => (
            <View key={d.id} style={styles.historyRow}>
              <Text style={[styles.historyDate, { color: theme.muted }]}>{formatShortDate(d.date, today)}</Text>
              <Text style={[styles.historyAmount, { color: d.amount < 0 ? theme.danger : theme.text }]}>
                {formatMoney(d.amount, currency, { sign: true })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 2 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  history: { gap: 6 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  historyDate: { fontSize: 13 },
  historyAmount: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
