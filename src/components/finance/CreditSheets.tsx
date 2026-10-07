import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FitGrid } from '@/components/FitGrid';
import { CategoryPicker } from '@/components/finance/CategoryPicker';
import { AmountInput, PrimaryButton, SheetHeader, SheetModal, Stepper, TextButton } from '@/components/finance/ui';
import { Chip, SectionTitle } from '@/components/ui';
import { DateKey, formatShortDate, fromKey } from '@/lib/dates';
import {
  chargeOn, Credit, creditDueDates, MAX_CREDIT_NAME_LENGTH, MAX_NOTE_LENGTH, MAX_PAYMENTS, nextOccurrence, planDates, planProgress,
  Recurring, sortByUse, startForPaid,
} from '@/lib/finance';
import { formatMoney, parseMoney, roundMoney } from '@/lib/money';
import { confirmAction, releaseFocus } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { CHART_LIGHT, chartColor, inkOn, useTheme } from '@/theme';

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const CREDIT_SUGGESTIONS = ['Tarjeta de crédito', 'Coppel', 'Mercado Pago', 'Liverpool', 'Elektra', 'Préstamo'];
/** Los plazos de siempre: un pago (lo de la tarjeta este mes) o meses sin intereses. */
const MONTH_OPTIONS = [1, 3, 6, 9, 12, 18, 24];

/** Color de los créditos (violeta de la paleta). */
export const creditColor = (theme: ReturnType<typeof useTheme>) => chartColor(CHART_LIGHT[6], theme);

// ---------- Crédito ----------

/** Un crédito a editar, o 'new' para uno nuevo. */
export type CreditTarget = Credit | 'new';

export function CreditSheet({ target, onClose: close }: { target: CreditTarget | null; onClose: () => void }) {
  const onClose = () => {
    releaseFocus();
    close();
  };
  return (
    <SheetModal open={target != null} onClose={onClose}>
      {target != null && <CreditBody credit={target === 'new' ? null : target} onClose={onClose} />}
    </SheetModal>
  );
}

function CreditBody({ credit, onClose }: { credit: Credit | null; onClose: () => void }) {
  const theme = useTheme();
  const today = useToday();
  const addCredit = useFinance((s) => s.addCredit);
  const updateCredit = useFinance((s) => s.updateCredit);
  const deleteCredit = useFinance((s) => s.deleteCredit);
  const [name, setName] = useState(credit?.name ?? '');
  const [day, setDay] = useState(credit?.day ?? fromKey(today).getDate());
  const color = creditColor(theme);
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    if (credit) updateCredit(credit.id, { name, day });
    else addCredit(name, day);
    onClose();
  };

  const remove = async () => {
    if (!credit) return;
    if (await confirmAction('Eliminar crédito', `Se quitan "${credit.name}" y sus compras. Lo que ya pagaste se queda en tus movimientos.`, 'Eliminar')) {
      deleteCredit(credit.id);
      onClose();
    }
  };

  return (
    <>
      <SheetHeader icon="card" color={color} title={credit ? 'Editar crédito' : 'Nuevo crédito'} subtitle={`Se paga el día ${day}`} onClose={onClose} />
      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ej.: Tarjeta Nu, Coppel"
          placeholderTextColor={theme.muted}
          maxLength={MAX_CREDIT_NAME_LENGTH}
          accessibilityLabel="Nombre del crédito"
          style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
        />
        {!credit && !name.trim() && (
          <View style={[styles.wrap, styles.spaced]}>
            {CREDIT_SUGGESTIONS.map((s) => <Chip key={s} label={s} onPress={() => setName(s)} />)}
          </View>
        )}

        <SectionTitle>Día de pago</SectionTitle>
        <FitGrid
          items={MONTH_DAYS}
          columns={7}
          minItemSize={34}
          gap={6}
          keyOf={String}
          renderItem={(d) => (
            <Pressable
              onPress={() => setDay(d)}
              accessibilityLabel={`Día ${d}`}
              accessibilityState={{ selected: day === d }}
              style={[styles.monthDay, { backgroundColor: day === d ? color : theme.surface }]}
            >
              <Text style={[styles.dayText, { color: day === d ? inkOn(color) : theme.text }]}>{d}</Text>
            </Pressable>
          )}
        />
        <Text style={[styles.note, { color: theme.muted }]}>
          Cada mes, ese día se apunta lo que toca de sus compras a meses.{day > 28 ? ' En los meses más cortos, el último día.' : ''}
        </Text>
      </ScrollView>

      <PrimaryButton label={credit ? 'Guardar' : 'Crear crédito'} color={color} onPress={save} disabled={!valid} />
      {credit && (
        <View style={styles.actions}>
          <TextButton label="Eliminar crédito" icon="trash-outline" color={theme.danger} onPress={remove} />
        </View>
      )}
    </>
  );
}

// ---------- Compra a meses ----------

/** Una compra de un crédito: la que se edita, o null para una nueva. */
export type PurchaseTarget = { creditId: string; purchase: Recurring | null };

export function PurchaseSheet({ target, onClose: close }: { target: PurchaseTarget | null; onClose: () => void }) {
  const onClose = () => {
    releaseFocus();
    close();
  };
  const credit = useFinance((s) => (target ? s.credits.find((c) => c.id === target.creditId) : undefined));
  const open = target != null && credit != null;
  return (
    <SheetModal open={open} onClose={onClose}>
      {open && <PurchaseBody credit={credit} purchase={target.purchase} onClose={onClose} />}
    </SheetModal>
  );
}

function PurchaseBody({ credit, purchase, onClose }: { credit: Credit; purchase: Recurring | null; onClose: () => void }) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const categories = useFinance((s) => s.categories);
  const transactions = useFinance((s) => s.transactions);
  const addRecurring = useFinance((s) => s.addRecurring);
  const updateRecurring = useFinance((s) => s.updateRecurring);
  const deleteRecurring = useFinance((s) => s.deleteRecurring);
  const applyRecurring = useFinance((s) => s.applyRecurring);
  const settleRecurring = useFinance((s) => s.settleRecurring);

  const [name, setName] = useState(purchase?.name ?? '');
  const [totalText, setTotalText] = useState('');
  const [months, setMonths] = useState(6);
  const [categoryId, setCategoryId] = useState<string | null>(purchase?.categoryId ?? null);
  // Primer pago: el próximo día de pago, el siguiente, o ya se llevan algunos pagados.
  const dueDates = creditDueDates(credit.day, today);
  const [start, setStart] = useState<DateKey | 'paid'>(dueDates[0]);
  const [alreadyPaid, setAlreadyPaid] = useState(1);

  const color = creditColor(theme);
  const expenseCategories = sortByUse(categories.filter((c) => c.kind === 'expense'), transactions, today);
  const total = parseMoney(totalText, currency);
  const paid = start === 'paid' ? Math.min(alreadyPaid, months - 1) : 0;
  const startDate = start === 'paid' ? startForPaid(credit.day, today, paid) : start;
  const perPayment = total != null ? roundMoney(total / months) : null;
  const schedule = { frequency: 'monthly' as const, day: credit.day, startDate, count: months };
  const dates = planDates(schedule);
  const last = total != null && perPayment != null ? roundMoney(total - perPayment * (months - 1)) : null;
  const progress = purchase ? planProgress(purchase, today) : null;
  const valid = name.trim().length > 0 && categoryId != null && (purchase != null || (total != null && perPayment! > 0));

  const save = () => {
    if (!valid) return;
    if (purchase) {
      updateRecurring(purchase.id, { name, categoryId });
    } else {
      addRecurring(
        { kind: 'expense', name, amount: perPayment!, categoryId, frequency: 'monthly', day: credit.day, count: months, total, creditId: credit.id },
        today,
        startDate,
      );
      applyRecurring(today);
    }
    onClose();
  };

  const settle = async () => {
    if (!purchase || !progress) return;
    if (await confirmAction('Liquidar compra', `Se apunta hoy un pago de ${formatMoney(progress.owed, currency)} y "${purchase.name}" queda liquidada.`, 'Liquidar')) {
      settleRecurring(purchase.id, today);
      onClose();
    }
  };

  const remove = async () => {
    if (!purchase) return;
    if (await confirmAction('Eliminar compra', `"${purchase.name}" deja de apuntarse. Lo que ya pagaste se queda.`, 'Eliminar')) {
      deleteRecurring(purchase.id);
      onClose();
    }
  };

  const nextCharge = purchase ? nextOccurrence(purchase, today) : null;

  return (
    <>
      <SheetHeader
        icon="bag-handle"
        color={color}
        title={purchase ? 'Editar compra' : `Compra con ${credit.name}`}
        subtitle={`${credit.name} · se paga el día ${credit.day}`}
        onClose={onClose}
      />
      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="¿Qué compraste? Ej.: celular, refri, tenis"
          placeholderTextColor={theme.muted}
          maxLength={MAX_NOTE_LENGTH}
          accessibilityLabel="Qué compraste"
          style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
        />

        {purchase && progress ? (
          <View style={[styles.summary, { backgroundColor: theme.surface }]}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>
              {progress.finished ? `Liquidada (${progress.count} de ${progress.count})` : `Llevas ${progress.paid} de ${progress.count} pagos`}
            </Text>
            {!progress.finished && (
              <Text style={[styles.note, { color: theme.muted }]}>
                Faltan {formatMoney(progress.owed, currency)}
                {nextCharge ? ` · el próximo, ${formatShortDate(nextCharge, today)} (${formatMoney(chargeOn(purchase, nextCharge), currency)})` : ''}
                {` · el último, ${formatShortDate(progress.lastDate, today)}`}.
              </Text>
            )}
          </View>
        ) : (
          <>
            <SectionTitle>Monto de la compra</SectionTitle>
            <AmountInput currency={currency} value={totalText} onChangeText={setTotalText} accessibilityLabel="Monto de la compra" />

            <SectionTitle>¿A cuántos meses?</SectionTitle>
            <View style={styles.wrap}>
              {MONTH_OPTIONS.map((m) => (
                <Chip key={m} label={m === 1 ? 'Un pago' : `${m} meses`} color={color} selected={months === m} onPress={() => setMonths(m)} />
              ))}
            </View>
            <View style={styles.spaced}>
              <Stepper value={months} min={1} max={MAX_PAYMENTS} onChange={setMonths} label={months === 1 ? '1 pago' : `${months} meses`} accessibilityLabel="Meses" />
            </View>

            <SectionTitle>Primer pago</SectionTitle>
            <View style={styles.wrap}>
              {dueDates.map((d) => (
                <Chip key={d} label={formatShortDate(d, today)} color={color} selected={start === d} onPress={() => setStart(d)} />
              ))}
              {months > 1 && <Chip label="Ya llevo pagos" color={color} selected={start === 'paid'} onPress={() => setStart('paid')} />}
            </View>
            {start === 'paid' && months > 1 && (
              <View style={styles.spaced}>
                <Stepper
                  value={paid}
                  min={1}
                  max={months - 1}
                  onChange={setAlreadyPaid}
                  label={`Llevo ${paid} de ${months}`}
                  accessibilityLabel="Pagos hechos"
                />
              </View>
            )}
          </>
        )}

        <SectionTitle>Categoría</SectionTitle>
        <CategoryPicker categories={expenseCategories} value={categoryId} onChange={setCategoryId} />

        {!purchase && perPayment != null && dates.length > 0 && (
          <Text style={[styles.preview, { color: theme.text }]}>
            {months === 1
              ? `Un pago de ${formatMoney(total!, currency)} el ${formatShortDate(dates[0], today)}.`
              : `${months} pagos de ${formatMoney(perPayment, currency)}${last !== perPayment ? ` (el último de ${formatMoney(last!, currency)})` : ''} · terminas el ${formatShortDate(dates.at(-1)!, today)}.`}
            {paid > 0 ? ` Ya pagaste ${paid}: faltan ${formatMoney(roundMoney(total! - perPayment * paid), currency)}.` : ''}
          </Text>
        )}
      </ScrollView>

      <PrimaryButton label={purchase ? 'Guardar' : 'Agregar compra'} color={color} onPress={save} disabled={!valid} />
      {purchase && (
        <View style={styles.actions}>
          {progress && !progress.finished && progress.owed > 0 && (
            <TextButton label={`Liquidar (${formatMoney(progress.owed, currency)})`} icon="checkmark-done" onPress={settle} />
          )}
          <TextButton label="Eliminar compra" icon="trash-outline" color={theme.danger} onPress={remove} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 0 },
  input: {
    fontSize: 17, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, marginTop: 4,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spaced: { marginTop: 10 },
  monthDay: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  preview: { fontSize: 14, fontWeight: '600', marginTop: 14, marginBottom: 4, lineHeight: 20 },
  summary: { borderRadius: 14, padding: 12, marginTop: 12 },
  summaryTitle: { fontSize: 15, fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 10 },
});
