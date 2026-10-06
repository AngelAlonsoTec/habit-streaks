import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FitGrid } from '@/components/FitGrid';
import { AmountInput, PaymentBadge, PrimaryButton, SheetHeader, SheetModal, TextButton } from '@/components/finance/ui';
import { Chip, SectionTitle, Segmented } from '@/components/ui';
import { DateKey, formatShortDate, fromKey, toKey, WEEKDAY_LABELS, weekdayIndex } from '@/lib/dates';
import {
  describeFrequency, Frequency, FREQUENCIES, KNOWN_SERVICES, knownService, MAX_NOTE_LENGTH, nextOccurrence, occursOn, Recurring,
  TxKind, withCatalogCategory,
} from '@/lib/finance';
import { moneyInputText, parseMoney } from '@/lib/money';
import { confirmAction } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { chartColor, inkOn, useTheme } from '@/theme';

type Suggestion = { name: string; categoryId: string; frequency: Frequency };

/** Las suscripciones conocidas, para elegirlas de un toque (se cobran cada mes). */
const SERVICE_SUGGESTIONS: Suggestion[] = KNOWN_SERVICES.map((s) => ({ name: s.name, categoryId: s.categoryId, frequency: 'monthly' }));

/** Estas categorías sirven a cualquiera: si faltan, se añaden al guardar. Las demás (auto, escuela), solo si las tiene. */
const COMMON_CATEGORIES = ['renta', 'servicios', 'celular', 'suscripciones', 'salud'];

const SUGGESTIONS: Record<TxKind, Suggestion[]> = {
  expense: [
    { name: 'Renta', categoryId: 'renta', frequency: 'monthly' },
    { name: 'Luz', categoryId: 'servicios', frequency: 'bimonthly' },
    { name: 'Agua', categoryId: 'servicios', frequency: 'bimonthly' },
    { name: 'Internet', categoryId: 'servicios', frequency: 'monthly' },
    { name: 'Plan del celular', categoryId: 'celular', frequency: 'monthly' },
    { name: 'Gimnasio', categoryId: 'salud', frequency: 'monthly' },
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

/** Un fijo a editar, o el tipo de uno nuevo ('expense' = gasto fijo, 'income' = ingreso fijo). */
export type RecurringTarget = Recurring | TxKind;

type Props = {
  /** null = cerrado. */
  target: RecurringTarget | null;
  onClose: () => void;
};

/** Pagos o cobros que se repiten: se registran solos el día que tocan. */
export function RecurringSheet({ target, onClose }: Props) {
  return (
    <SheetModal open={target != null} onClose={onClose}>
      {target != null && (
        <Body
          recurring={typeof target === 'string' ? null : target}
          initialKind={typeof target === 'string' ? target : target.kind}
          onClose={onClose}
        />
      )}
    </SheetModal>
  );
}

function Body({ recurring, initialKind, onClose }: { recurring: Recurring | null; initialKind: TxKind; onClose: () => void }) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const categories = useFinance((s) => s.categories);
  const addRecurring = useFinance((s) => s.addRecurring);
  const updateRecurring = useFinance((s) => s.updateRecurring);
  const deleteRecurring = useFinance((s) => s.deleteRecurring);
  const applyRecurring = useFinance((s) => s.applyRecurring);

  const t = fromKey(today);
  const [kind, setKind] = useState<TxKind>(initialKind);
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
  // Si eligió Netflix y no tenía "Suscripciones", la categoría sale ya (y se añade al guardar).
  const kindCategories = withCatalogCategory(categories, categoryId ?? '').filter((c) => c.kind === kind);
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
  const suggesting = !recurring && !name.trim();
  const suggestions = suggesting
    ? SUGGESTIONS[kind].filter((s) => COMMON_CATEGORIES.includes(s.categoryId) || kindCategories.some((c) => c.id === s.categoryId))
    : [];
  const services = suggesting && kind === 'expense' ? SERVICE_SUGGESTIONS : [];

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

  // Al escribir "netflix" a mano, se elige sola su categoría (si aún no eligió otra).
  const changeName = (text: string) => {
    setName(text);
    const service = kind === 'expense' && !categoryId ? knownService(text) : null;
    if (service) setCategoryId(service.categoryId);
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
        title={`${recurring ? 'Editar' : 'Nuevo'} ${kind === 'expense' ? 'gasto' : 'ingreso'} fijo`}
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
          onChangeText={changeName}
          placeholder={kind === 'expense' ? 'Ej.: Netflix, renta, internet' : 'Ej.: Sueldo'}
          placeholderTextColor={theme.muted}
          maxLength={MAX_NOTE_LENGTH}
          accessibilityLabel="Nombre del fijo"
          style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
        />
        {services.length > 0 && (
          <>
            <Text style={[styles.groupLabel, { color: theme.muted }]}>Suscripciones</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.services}
              contentContainerStyle={styles.servicesContent}
            >
              {services.map((s) => (
                <Pressable
                  key={s.name}
                  onPress={() => applySuggestion(s)}
                  accessibilityRole="button"
                  accessibilityLabel={s.name}
                  style={({ pressed }) => [styles.service, pressed && styles.pressed]}
                >
                  <PaymentBadge name={s.name} category={undefined} size={46} />
                  <Text style={[styles.serviceName, { color: theme.text }]} numberOfLines={2}>{s.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[styles.groupLabel, { color: theme.muted }]}>Casa y otros</Text>
          </>
        )}
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
  groupLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14 },
  services: { marginTop: 8, flexGrow: 0 },
  servicesContent: { gap: 4 },
  service: { width: 70, alignItems: 'center', gap: 6, paddingVertical: 4 },
  serviceName: { fontSize: 11.5, fontWeight: '600', textAlign: 'center', lineHeight: 14 },
  pressed: { opacity: 0.6 },
  spaced: { marginTop: 10 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '700' },
  monthDay: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 13, marginTop: 8 },
  preview: { fontSize: 14, fontWeight: '600', marginTop: 14, marginBottom: 4 },
  center: { alignItems: 'center' },
});
