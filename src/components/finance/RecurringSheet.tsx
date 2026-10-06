import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FitGrid } from '@/components/FitGrid';
import { AmountInput, PrimaryButton, SheetHeader, SheetModal, TextButton } from '@/components/finance/ui';
import { Chip, SectionTitle, Segmented } from '@/components/ui';
import { DateKey, formatShortDate, fromKey, toKey, WEEKDAY_LABELS, weekdayIndex } from '@/lib/dates';
import {
  describeFrequency, Frequency, FREQUENCIES, MAX_NOTE_LENGTH, nextOccurrence, occursOn, Recurring, TxKind,
} from '@/lib/finance';
import { moneyInputText, parseMoney } from '@/lib/money';
import { confirmAction } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { chartColor, inkOn, useTheme } from '@/theme';

type Suggestion = { name: string; categoryId: string; frequency: Frequency };

const SUGGESTIONS: Record<TxKind, Suggestion[]> = {
  expense: [
    { name: 'Renta', categoryId: 'renta', frequency: 'monthly' },
    { name: 'Luz', categoryId: 'servicios', frequency: 'bimonthly' },
    { name: 'Agua', categoryId: 'servicios', frequency: 'bimonthly' },
    { name: 'Internet', categoryId: 'servicios', frequency: 'monthly' },
    { name: 'Plan del celular', categoryId: 'celular', frequency: 'monthly' },
    { name: 'Netflix', categoryId: 'suscripciones', frequency: 'monthly' },
    { name: 'Spotify', categoryId: 'suscripciones', frequency: 'monthly' },
    { name: 'Renta del auto', categoryId: 'renta-auto', frequency: 'weekly' },
    { name: 'Seguro del auto', categoryId: 'seguro-auto', frequency: 'monthly' },
    { name: 'Colegiatura', categoryId: 'escuela', frequency: 'monthly' },
  ],
  income: [
    { name: 'Sueldo', categoryId: 'sueldo', frequency: 'biweekly' },
    { name: 'Mesada', categoryId: 'mesada', frequency: 'weekly' },
    { name: 'Beca', categoryId: 'beca', frequency: 'monthly' },
    { name: 'Beca Benito Juárez', categoryId: 'beca', frequency: 'bimonthly' },
  ],
};

const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type Props = {
  /** Fijo a editar, 'new' para crear uno, o null = cerrado. */
  recurring: Recurring | 'new' | null;
  onClose: () => void;
};

/** Pagos o cobros que se repiten: se registran solos el día que tocan. */
export function RecurringSheet({ recurring, onClose }: Props) {
  return (
    <SheetModal open={recurring != null} onClose={onClose}>
      {recurring != null && <Body recurring={recurring === 'new' ? null : recurring} onClose={onClose} />}
    </SheetModal>
  );
}

function Body({ recurring, onClose }: { recurring: Recurring | null; onClose: () => void }) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const categories = useFinance((s) => s.categories);
  const addRecurring = useFinance((s) => s.addRecurring);
  const updateRecurring = useFinance((s) => s.updateRecurring);
  const deleteRecurring = useFinance((s) => s.deleteRecurring);
  const applyRecurring = useFinance((s) => s.applyRecurring);

  const t = fromKey(today);
  const [kind, setKind] = useState<TxKind>(recurring?.kind ?? 'expense');
  const [name, setName] = useState(recurring?.name ?? '');
  const [amountText, setAmountText] = useState(recurring ? moneyInputText(recurring.amount, currency) : '');
  const [categoryId, setCategoryId] = useState<string | null>(recurring?.categoryId ?? null);
  const [frequency, setFrequency] = useState<Frequency>(recurring?.frequency ?? 'monthly');
  const [weekday, setWeekday] = useState(recurring?.frequency === 'weekly' ? recurring.day : weekdayIndex(t));
  const [monthDay, setMonthDay] = useState(
    recurring?.frequency === 'monthly' || recurring?.frequency === 'bimonthly' ? recurring.day : t.getDate(),
  );
  // Bimestral: si el próximo toca este mes o el que viene (la luz llega un mes sí y otro no).
  const [nextMonth, setNextMonth] = useState(() => {
    if (!recurring) return false;
    const start = fromKey(recurring.startDate);
    return ((t.getFullYear() - start.getFullYear()) * 12 + t.getMonth() - start.getMonth()) % 2 !== 0;
  });

  const amount = parseMoney(amountText, currency);
  const kindCategories = categories.filter((c) => c.kind === kind);
  const category = kindCategories.find((c) => c.id === categoryId);
  const color = category ? chartColor(category.color, theme) : kind === 'income' ? theme.primary : theme.danger;
  const monthName = (offset: number) =>
    new Date(t.getFullYear(), t.getMonth() + offset, 1).toLocaleDateString('es-ES', { month: 'long' });
  const byMonthDay = frequency === 'monthly' || frequency === 'bimonthly';
  const day = frequency === 'weekly' ? weekday : byMonthDay ? monthDay : 0;
  // Desde cuándo cuenta: hoy, o el mes que viene si el bimestral no toca este.
  const startDate: DateKey = frequency === 'bimonthly' && nextMonth
    ? toKey(new Date(t.getFullYear(), t.getMonth() + 1, 1))
    : recurring && frequency === 'bimonthly' ? `${today.slice(0, 7)}-01` : today;
  const valid = name.trim().length > 0 && amount != null && category != null;
  const suggestions = !recurring && !name.trim()
    ? SUGGESTIONS[kind].filter((s) => kindCategories.some((c) => c.id === s.categoryId))
    : [];

  // Un fijo nuevo empieza hoy: si hoy toca, se registra en cuanto se guarda.
  const preview = recurring
    ? `Próximo registro: ${formatShortDate(nextOccurrence({ frequency, day, startDate }, today), today)}`
    : occursOn({ frequency, day, startDate }, t)
      ? 'Hoy toca: se registrará en cuanto lo guardes.'
      : `Primer registro: ${formatShortDate(nextOccurrence({ frequency, day, startDate }, today), today)}`;

  const changeKind = (k: TxKind) => {
    setKind(k);
    setCategoryId(null);
  };

  const applySuggestion = (s: Suggestion) => {
    setName(s.name);
    setCategoryId(s.categoryId);
    setFrequency(s.frequency);
  };

  const save = () => {
    if (!valid) return;
    const input = { kind, name, amount, categoryId: category.id, frequency, day };
    if (recurring) updateRecurring(recurring.id, frequency === 'bimonthly' ? { ...input, startDate } : input);
    else addRecurring(input, today, startDate);
    applyRecurring(today);
    onClose();
  };

  const remove = async () => {
    if (!recurring) return;
    if (await confirmAction('Eliminar fijo', `"${recurring.name}" dejará de registrarse. Lo ya registrado se queda.`, 'Eliminar')) {
      deleteRecurring(recurring.id);
      onClose();
    }
  };

  return (
    <>
      <SheetHeader
        icon="repeat"
        color={color}
        title={recurring ? 'Editar fijo' : 'Nuevo pago o cobro fijo'}
        subtitle={describeFrequency({ frequency, day })}
        onClose={onClose}
      />
      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        <Segmented
          value={kind}
          onChange={changeKind}
          options={[
            { value: 'expense', label: 'Gasto', icon: 'arrow-up-circle-outline' },
            { value: 'income', label: 'Ingreso', icon: 'arrow-down-circle-outline' },
          ]}
        />

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={kind === 'expense' ? 'Ej.: Renta' : 'Ej.: Sueldo'}
          placeholderTextColor={theme.muted}
          maxLength={MAX_NOTE_LENGTH}
          accessibilityLabel="Nombre del fijo"
          style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
        />
        {suggestions.length > 0 && (
          <View style={[styles.wrap, styles.spaced]}>
            {suggestions.map((s) => (
              <Chip key={s.name} label={s.name} onPress={() => applySuggestion(s)} />
            ))}
          </View>
        )}

        <SectionTitle>Importe</SectionTitle>
        <AmountInput currency={currency} value={amountText} onChangeText={setAmountText} accessibilityLabel="Importe del fijo" />

        <SectionTitle>Categoría</SectionTitle>
        <View style={styles.wrap}>
          {kindCategories.map((c) => (
            <Chip key={c.id} label={c.name} icon={c.icon} color={chartColor(c.color, theme)} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>

        <SectionTitle>Cada cuándo</SectionTitle>
        <Segmented value={frequency} onChange={setFrequency} options={FREQUENCIES} color={color} />

        {frequency === 'weekly' && (
          <View style={[styles.days, styles.spaced]}>
            {WEEKDAY_LABELS.map((label, i) => (
              <Pressable
                key={i}
                onPress={() => setWeekday(i)}
                accessibilityLabel={WEEKDAY_NAMES[i]}
                accessibilityState={{ selected: weekday === i }}
                style={[styles.day, { backgroundColor: weekday === i ? color : theme.surface }]}
              >
                <Text style={[styles.dayText, { color: weekday === i ? inkOn(color) : theme.text }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {byMonthDay && (
          <View style={styles.spaced}>
            <FitGrid
              items={MONTH_DAYS}
              columns={7}
              minItemSize={34}
              gap={6}
              keyOf={String}
              renderItem={(d) => (
                <Pressable
                  onPress={() => setMonthDay(d)}
                  accessibilityLabel={`Día ${d}`}
                  accessibilityState={{ selected: monthDay === d }}
                  style={[styles.monthDay, { backgroundColor: monthDay === d ? color : theme.surface }]}
                >
                  <Text style={[styles.dayText, { color: monthDay === d ? inkOn(color) : theme.text }]}>{d}</Text>
                </Pressable>
              )}
            />
          </View>
        )}
        {byMonthDay && monthDay > 28 && (
          <Text style={[styles.note, { color: theme.muted }]}>En los meses más cortos se registra el último día.</Text>
        )}
        {frequency === 'bimonthly' && (
          <>
            <Text style={[styles.note, { color: theme.muted }]}>¿Cuándo toca el próximo?</Text>
            <Segmented
              value={nextMonth ? 'next' : 'this'}
              onChange={(v) => setNextMonth(v === 'next')}
              options={[
                { value: 'this', label: `En ${monthName(0)}` },
                { value: 'next', label: `En ${monthName(1)}` },
              ]}
              color={color}
              style={styles.spaced}
            />
          </>
        )}
        {frequency === 'biweekly' && (
          <Text style={[styles.note, { color: theme.muted }]}>Se registra el día 15 y el último día de cada mes.</Text>
        )}

        <Text style={[styles.preview, { color: theme.text }]}>{preview}</Text>
      </ScrollView>

      <PrimaryButton label={recurring ? 'Guardar' : 'Crear fijo'} color={color} onPress={save} disabled={!valid} />
      {recurring && (
        <View style={styles.center}>
          <TextButton label="Eliminar fijo" icon="trash-outline" color={theme.danger} onPress={remove} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 0 },
  input: {
    fontSize: 17, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, marginTop: 12,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spaced: { marginTop: 10 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '700' },
  monthDay: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 13, marginTop: 8 },
  preview: { fontSize: 14, fontWeight: '600', marginTop: 14, marginBottom: 4 },
  center: { alignItems: 'center' },
});
