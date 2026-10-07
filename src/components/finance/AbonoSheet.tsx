import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DatePicker } from '@/components/DatePicker';
import { AmountInput, PrimaryButton, SheetHeader, SheetModal, TextButton } from '@/components/finance/ui';
import { SectionTitle } from '@/components/ui';
import { addDays, DateKey, formatShortDate, fromKey, toKey } from '@/lib/dates';
import { abonoState, Recurring } from '@/lib/finance';
import { formatMoney, moneyInputText, parseMoney } from '@/lib/money';
import { releaseFocus } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { chartColor, CHART_OTHER, useTheme } from '@/theme';

/** Apuntar un abono: cuánto se pagó esta vez (cada vez puede ser distinto) y lo que queda. */
export function AbonoSheet({ recurring, onClose: close }: { recurring: Recurring | null; onClose: () => void }) {
  const onClose = () => {
    releaseFocus();
    close();
  };
  return (
    <SheetModal open={recurring != null} onClose={onClose}>
      {recurring != null && <Body recurring={recurring} onClose={onClose} />}
    </SheetModal>
  );
}

function Body({ recurring: r, onClose }: { recurring: Recurring; onClose: () => void }) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const transactions = useFinance((s) => s.transactions);
  const category = useFinance((s) => s.categories.find((c) => c.id === r.categoryId));
  const addAbono = useFinance((s) => s.addAbono);
  const skipAbono = useFinance((s) => s.skipAbono);

  const state = abonoState(r, transactions, today);
  const [amountText, setAmountText] = useState(state.suggested ? moneyInputText(state.suggested, currency) : '');
  const [date, setDate] = useState<DateKey>(today);
  const amount = parseMoney(amountText, currency);
  const color = chartColor(category?.color ?? CHART_OTHER, theme);
  const after = state.owed != null && amount != null ? Math.max(0, state.owed - amount) : null;

  const save = () => {
    if (amount == null) return;
    addAbono(r.id, amount, date);
    onClose();
  };

  const skip = () => {
    skipAbono(r.id, today);
    onClose();
  };

  return (
    <>
      <SheetHeader
        icon="cash"
        color={color}
        title={`Abonar a ${r.name}`}
        subtitle={state.overdue.length
          ? `Tocaba el ${formatShortDate(state.overdue[0], today)}`
          : state.next ? `El próximo toca el ${formatShortDate(state.next, today)}` : undefined}
        onClose={onClose}
      />
      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {state.owed != null && (
          <View style={[styles.summary, { backgroundColor: theme.surface }]}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>Debes {formatMoney(state.owed, currency)}</Text>
            <Text style={[styles.note, { color: theme.muted }]}>
              Llevas {formatMoney(state.paid, currency)} abonado de {formatMoney(r.total!, currency)}.
            </Text>
          </View>
        )}

        <SectionTitle>¿Cuánto abonaste?</SectionTitle>
        <AmountInput currency={currency} large value={amountText} onChangeText={setAmountText} autoFocus accessibilityLabel="Importe del abono" />
        {amountText.trim() !== '' && amount == null && (
          <Text style={[styles.note, { color: theme.danger }]}>Escribe un importe válido, por ejemplo 500 o 1,250.50.</Text>
        )}
        {after != null && (
          <Text style={[styles.note, { color: after === 0 ? theme.primary : theme.text }]}>
            {after === 0 ? '¡Con este abono lo liquidas!' : `Después de este abono debes ${formatMoney(after, currency)}.`}
          </Text>
        )}

        <SectionTitle>Fecha</SectionTitle>
        <DatePicker
          value={date}
          onChange={(d) => d && setDate(d)}
          maxKey={today}
          presets={[{ label: 'Hoy', key: today }, { label: 'Ayer', key: toKey(addDays(fromKey(today), -1)) }]}
          allowNone={false}
          color={color}
        />
      </ScrollView>

      <PrimaryButton label="Guardar abono" color={color} onPress={save} disabled={amount == null} />
      {state.overdue.length > 0 && (
        <View style={styles.center}>
          <TextButton label="Esta vez no abono" icon="play-skip-forward" onPress={skip} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 0 },
  summary: { borderRadius: 14, padding: 12, marginTop: 4 },
  summaryTitle: { fontSize: 17, fontWeight: '800' },
  note: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  center: { alignItems: 'center' },
});
