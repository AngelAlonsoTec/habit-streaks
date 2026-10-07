import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DatePicker } from '@/components/DatePicker';
import { CategoryPicker } from '@/components/finance/CategoryPicker';
import { AmountInput, PaymentBadge, PrimaryButton, SheetHeader, SheetModal, Stepper, TextButton } from '@/components/finance/ui';
import { Chip, SectionTitle, Segmented } from '@/components/ui';
import { addDays, addMonths, DateKey, formatShortDate, fromKey, toKey, weekdayIndex } from '@/lib/dates';
import {
  abonoState, describeFrequency, Frequency, FREQUENCIES, isEnded, KNOWN_SERVICES, knownService, MAX_NOTE_LENGTH, MAX_PAYMENTS,
  nextOccurrence, paidTo, planDates, planProgress, Recurring, TxKind, withCatalogCategory,
} from '@/lib/finance';
import { formatMoney, moneyInputText, parseMoney } from '@/lib/money';
import { confirmAction, releaseFocus } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { chartColor, useTheme } from '@/theme';

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

/** Cómo se llama cada pago según la frecuencia: "4 meses", "2 quincenas". */
const PAYMENT_UNITS: Record<Frequency, [string, string]> = {
  weekly: ['semana', 'semanas'],
  biweekly: ['quincena', 'quincenas'],
  monthly: ['mes', 'meses'],
  bimonthly: ['bimestre', 'bimestres'],
};
const paymentUnit = (frequency: Frequency, n: number) => `${n} ${PAYMENT_UNITS[frequency][n === 1 ? 0 : 1]}`;

/** Un fijo a editar, o el tipo de uno nuevo ('expense' = gasto fijo, 'income' = ingreso fijo). */
export type RecurringTarget = Recurring | TxKind;

type Props = {
  /** null = cerrado. */
  target: RecurringTarget | null;
  onClose: () => void;
};

/** Pagos o cobros que se repiten: se registran solos el día que tocan. */
export function RecurringSheet({ target, onClose: close }: Props) {
  const onClose = () => {
    releaseFocus();
    close();
  };
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
  const settleRecurring = useFinance((s) => s.settleRecurring);
  const endRecurring = useFinance((s) => s.endRecurring);
  const resumeRecurring = useFinance((s) => s.resumeRecurring);
  const transactions = useFinance((s) => s.transactions);

  const progress = recurring ? planProgress(recurring, today) : null;
  const abono = recurring?.variable ? abonoState(recurring, transactions, today) : null;
  const paid = recurring ? paidTo(recurring, transactions) : null;
  const ended = recurring ? isEnded(recurring, today) : false;
  // Al editar, la fecha que se ve es la del próximo cobro (cambiarla mueve los que siguen).
  const initialDate = recurring ? nextOccurrence(recurring, today) ?? recurring.startDate : today;
  const [kind, setKind] = useState<TxKind>(initialKind);
  const [name, setName] = useState(recurring?.name ?? '');
  const [amountText, setAmountText] = useState(recurring ? moneyInputText(recurring.amount, currency) : '');
  const [categoryId, setCategoryId] = useState<string | null>(recurring?.categoryId ?? null);
  const [frequency, setFrequency] = useState<Frequency>(recurring?.frequency ?? 'monthly');
  const [firstDate, setFirstDate] = useState<DateKey>(initialDate);
  // Abonos: mismas fechas, importe distinto cada vez (solo para gastos).
  const [variable, setVariable] = useState(recurring?.variable ?? false);
  // "Con fin": un número de pagos o, en abonos, hasta pagar un total.
  const [limited, setLimited] = useState(recurring?.count != null || (recurring?.variable === true && recurring.total != null));
  const [count, setCount] = useState(recurring?.count ?? 4);
  const [totalText, setTotalText] = useState(recurring?.variable && recurring.total != null ? moneyInputText(recurring.total, currency) : '');
  // Dejar de pagarlo: hasta qué día.
  const [ending, setEnding] = useState(false);
  const [endDate, setEndDate] = useState<DateKey>(paid?.last ?? today);

  const isAbono = kind === 'expense' && variable;
  const amount = parseMoney(amountText, currency);
  const total = parseMoney(totalText, currency);
  // Si eligió Netflix y no tenía "Suscripciones", la categoría sale ya (y se añade al guardar).
  const kindCategories = withCatalogCategory(categories, categoryId ?? '').filter((c) => c.kind === kind);
  const category = kindCategories.find((c) => c.id === categoryId);
  const color = category ? chartColor(category.color, theme) : kind === 'income' ? theme.primary : theme.danger;
  // El día sale de la fecha elegida: su día de la semana, o su día del mes (la quincena es 15 y fin de mes).
  const first = fromKey(firstDate);
  const day = frequency === 'weekly' ? weekdayIndex(first) : frequency === 'biweekly' ? 0 : first.getDate();
  // Un plan en marcha conserva su calendario (y uno sin fin, si no se tocó la fecha); si no, cuenta
  // desde la fecha elegida (al ponerle número de pagos a uno que ya existía, desde su próximo cobro).
  const keepSchedule = recurring != null && (recurring.count != null && !recurring.variable
    ? limited && !isAbono
    : (isAbono || !limited) && firstDate === initialDate && frequency === recurring.frequency);
  const startDate: DateKey = recurring && keepSchedule ? recurring.startDate : firstDate;
  const schedule = { frequency, day, startDate, count: limited && !isAbono ? count : null };
  const dates = limited && !isAbono ? planDates(schedule) : [];
  // El primer cobro desde la fecha elegida (en quincenal, el 15 o el fin de mes que siga).
  const firstCharge = planDates({ ...schedule, startDate: firstDate, count: 1 })[0];
  const valid = name.trim().length > 0 && category != null && (isAbono ? !limited || total != null : amount != null);
  const suggesting = !recurring && !name.trim();
  const suggestions = suggesting
    ? SUGGESTIONS[kind].filter((s) => COMMON_CATEGORIES.includes(s.categoryId) || kindCategories.some((c) => c.id === s.categoryId))
    : [];
  const services = suggesting && kind === 'expense' ? SERVICE_SUGGESTIONS : [];

  const next = recurring
    ? nextOccurrence({ ...schedule, endedOn: recurring.endedOn, variable: recurring.variable, lastApplied: recurring.lastApplied }, today)
    : null;
  const preview = isAbono
    ? recurring
      ? next ? `Próximo abono: ${formatShortDate(next, today)}` : ''
      : firstCharge === today
        ? 'Hoy toca abonar: en cuanto lo guardes te preguntamos cuánto.'
        : firstCharge > today
          ? `Primer abono: ${formatShortDate(firstCharge, today)}`
          : `Desde el ${formatShortDate(firstCharge, today)}: lo de antes no cuenta.`
    : recurring
      ? next ? `Próximo registro: ${formatShortDate(next, today)}` : 'Ya no le quedan pagos.'
      : firstCharge === today
        ? 'Hoy toca: se registrará en cuanto lo guardes.'
        : firstCharge > today
          ? `Primer registro: ${formatShortDate(firstCharge, today)}`
          : `Empezó el ${formatShortDate(firstCharge, today)}: lo de antes no se apunta (ya lo pagaste).`;
  // Con número de pagos: cuántos, de cuánto, cuándo termina y cuánto es en total.
  const planText = !isAbono && limited && amount != null && dates.length
    ? `${count} ${count === 1 ? 'pago' : 'pagos'} de ${formatMoney(amount, currency)} · el último, ${formatShortDate(dates.at(-1)!, today)} · en total ${formatMoney(amount * count, currency)}`
    : null;

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
    const input = {
      kind, name, amount: amount ?? 0, categoryId: category.id, frequency, day,
      variable: isAbono,
      count: !isAbono && limited ? count : null,
      // El total de una compra a meses se conserva; en abonos es lo que se debe.
      ...(isAbono ? { total: limited ? total : null } : {}),
    };
    if (recurring) updateRecurring(recurring.id, { ...input, startDate });
    else addRecurring(input, today, startDate);
    applyRecurring(today);
    onClose();
  };

  // Lo que falta: de un plan, sus pagos; de unos abonos, lo que se debe.
  const owed = progress && !progress.finished ? progress.owed : abono?.owed ?? 0;
  const settle = async () => {
    if (!recurring || !(owed > 0)) return;
    const message = `Se apunta hoy un pago de ${formatMoney(owed, currency)} y "${recurring.name}" queda liquidado.`;
    if (await confirmAction('Liquidar', message, 'Liquidar')) {
      settleRecurring(recurring.id, today);
      onClose();
    }
  };

  const remove = async () => {
    if (!recurring) return;
    const message = `"${recurring.name}" se quita de tu lista; lo ya pagado se queda en tus movimientos. Si solo ya no lo pagas, mejor usa «Ya no lo pago» (así lo sigues viendo).`;
    if (await confirmAction('Eliminar fijo', message, 'Eliminar')) {
      deleteRecurring(recurring.id);
      onClose();
    }
  };

  const resume = () => {
    if (!recurring) return;
    resumeRecurring(recurring.id, today);
    onClose();
  };

  if (recurring && ending) {
    // Lo que se queda y lo que se quita (lo que se apuntó solo después del último cobro no se pagó).
    const kept = transactions.filter((t) => t.recurringId === recurring.id && t.date <= endDate);
    const removed = recurring.variable ? [] : transactions.filter((t) => t.recurringId === recurring.id && t.date > endDate);
    const nextCharge = nextOccurrence(recurring, today);
    const presets = [
      ...(paid?.last ? [{ label: `${formatShortDate(paid.last, today)} (el último apuntado)`, key: paid.last }] : []),
      ...(nextCharge ? [{ label: `${formatShortDate(nextCharge, today)} (aún pago ese)`, key: nextCharge }] : []),
      ...(!paid?.last && !nextCharge ? [{ label: 'Hoy', key: today }] : []),
    ];
    const confirmEnd = () => {
      endRecurring(recurring.id, endDate);
      onClose();
    };
    return (
      <>
        <SheetHeader icon="stop-circle" color={theme.danger} title={`Dejar de pagar ${recurring.name}`} subtitle="Lo que ya pagaste se queda" onClose={onClose} />
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.note, { color: theme.muted }]}>
            ¿Cuál fue (o será) el último cobro? Después de ese día ya no se apunta nada, y lo sigues viendo en «Terminados».
          </Text>
          <SectionTitle>Último cobro</SectionTitle>
          <DatePicker
            value={endDate}
            onChange={(d) => d && setEndDate(d)}
            minKey={recurring.startDate < today ? recurring.startDate : today}
            maxKey={nextCharge ?? today}
            presets={presets}
            allowNone={false}
            color={theme.danger}
          />
          <Text style={[styles.preview, { color: theme.text }]}>
            {kept.length
              ? `Se queda lo que pagaste: ${formatMoney(kept.reduce((s, t) => s + t.amount, 0), currency)} en ${kept.length} ${kept.length === 1 ? 'cobro' : 'cobros'}.`
              : 'No se había apuntado ningún cobro.'}
            {removed.length
              ? ` Se quitan ${removed.length} ${removed.length === 1 ? 'cobro que ya no hiciste' : 'cobros que ya no hiciste'} (${removed.map((t) => formatShortDate(t.date, today)).join(', ')}).`
              : ''}
          </Text>
        </ScrollView>
        <PrimaryButton label="Dejar de pagarlo" color={theme.danger} onPress={confirmEnd} />
        <View style={styles.actions}>
          <TextButton label="Volver" icon="arrow-back" onPress={() => setEnding(false)} />
        </View>
      </>
    );
  }

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
        {recurring && (ended || (paid?.count ?? 0) > 0) && (
          // Cómo va: lo pagado y, si ya terminó, cuándo y por qué.
          <View style={[styles.status, { backgroundColor: theme.surface }]}>
            {ended && (
              <Text style={[styles.statusTitle, { color: theme.text }]}>
                {recurring.endKind === 'cancelled'
                  ? `Lo dejaste de pagar: el último cobro fue el ${formatShortDate(recurring.endedOn!, today)}.`
                  : recurring.endKind === 'settled'
                    ? `Liquidado el ${formatShortDate(recurring.endedOn!, today)}.`
                    : 'Ya se pagó todo.'}
              </Text>
            )}
            {paid && paid.count > 0 && (
              <Text style={[styles.note, styles.tight, { color: theme.muted }]}>
                Llevas pagado {formatMoney(paid.amount, currency)} en {paid.count} {paid.count === 1 ? 'pago' : 'pagos'}.
              </Text>
            )}
          </View>
        )}
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

        {kind === 'expense' && (
          <>
            <SectionTitle>¿Cuánto pagas?</SectionTitle>
            <Segmented
              value={variable ? 'variable' : 'fixed'}
              onChange={(v) => setVariable(v === 'variable')}
              options={[
                { value: 'fixed', label: 'Siempre lo mismo' },
                { value: 'variable', label: 'Varía (abonos)' },
              ]}
              color={color}
            />
            {isAbono && (
              <Text style={[styles.note, { color: theme.muted }]}>
                No se apunta solo: en cada fecha te recordamos abonar y tú apuntas cuánto (puede ser distinto cada vez).
              </Text>
            )}
          </>
        )}

        <SectionTitle>{isAbono ? 'Abono sugerido (opcional)' : 'Importe'}</SectionTitle>
        <AmountInput currency={currency} value={amountText} onChangeText={setAmountText} accessibilityLabel={isAbono ? 'Abono sugerido' : 'Importe del fijo'} />

        <SectionTitle>Categoría</SectionTitle>
        <CategoryPicker categories={kindCategories} value={categoryId} onChange={setCategoryId} />

        <SectionTitle>Cada cuándo</SectionTitle>
        <Segmented value={frequency} onChange={setFrequency} options={FREQUENCIES} color={color} />

        {progress ? (
          // Un plan en marcha: cómo va (su calendario no se mueve).
          <Text style={[styles.note, { color: theme.text }]}>
            {progress.finished
              ? `Liquidado: ${progress.count} de ${progress.count}.`
              : `Llevas ${progress.paid} de ${progress.count}: faltan ${formatMoney(progress.owed, currency)} (el último, ${formatShortDate(progress.lastDate, today)}).`}
          </Text>
        ) : (
          <>
            <SectionTitle>
              {isAbono ? (recurring ? 'Próximo abono' : 'Primer abono') : recurring ? 'Próximo cobro' : kind === 'income' ? 'Primer cobro' : 'Primer pago'}
            </SectionTitle>
            <DatePicker
              value={firstDate}
              onChange={(d) => d && setFirstDate(d)}
              minKey={toKey(addMonths(fromKey(today), -12))}
              maxKey={toKey(addMonths(fromKey(today), 12))}
              presets={[{ label: 'Hoy', key: today }, { label: 'Mañana', key: toKey(addDays(fromKey(today), 1)) }]}
              allowNone={false}
              color={color}
            />
            {frequency !== 'weekly' && frequency !== 'biweekly' && day > 28 && (
              <Text style={[styles.note, { color: theme.muted }]}>En los meses más cortos se registra el último día.</Text>
            )}
            {frequency === 'biweekly' && (
              <Text style={[styles.note, { color: theme.muted }]}>Se registra el día 15 y el último día de cada mes.</Text>
            )}
          </>
        )}

        <SectionTitle>¿Hasta cuándo?</SectionTitle>
        <Segmented
          value={limited ? 'limited' : 'forever'}
          onChange={(v) => setLimited(v === 'limited')}
          options={[
            { value: 'forever', label: 'Sin fin' },
            { value: 'limited', label: isAbono ? 'Hasta pagar un total' : 'Un número de pagos' },
          ]}
          color={color}
        />
        {isAbono && limited && (
          <View style={styles.spaced}>
            <AmountInput currency={currency} value={totalText} onChangeText={setTotalText} placeholder="Total que debes" accessibilityLabel="Total que debes" />
            {abono?.owed != null && (
              <Text style={[styles.note, { color: theme.muted }]}>
                Llevas {formatMoney(abono.paid, currency)} abonado: debes {formatMoney(abono.owed, currency)}.
              </Text>
            )}
          </View>
        )}
        {!isAbono && limited && (
          <View style={styles.spaced}>
            <Stepper
              value={count}
              min={Math.max(1, progress?.paid ?? 1)}
              max={MAX_PAYMENTS}
              onChange={setCount}
              label={paymentUnit(frequency, count)}
              accessibilityLabel="Número de pagos"
            />
          </View>
        )}
        {planText && <Text style={[styles.note, { color: theme.muted }]}>{planText}</Text>}

        <Text style={[styles.preview, { color: theme.text }]}>{preview}</Text>
      </ScrollView>

      <PrimaryButton label={recurring ? 'Guardar' : 'Crear fijo'} color={color} onPress={save} disabled={!valid} />
      {recurring && (
        <View style={styles.actions}>
          {!ended && owed > 0 && (
            <TextButton label={`Liquidar (${formatMoney(owed, currency)})`} icon="checkmark-done" onPress={settle} />
          )}
          {!ended && <TextButton label="Ya no lo pago" icon="stop-circle-outline" onPress={() => setEnding(true)} />}
          {ended && recurring.endKind === 'cancelled' && <TextButton label="Volver a pagarlo" icon="play-circle-outline" onPress={resume} />}
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
  note: { fontSize: 13, marginTop: 8 },
  preview: { fontSize: 14, fontWeight: '600', marginTop: 14, marginBottom: 4 },
  actions: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 10 },
  status: { borderRadius: 14, padding: 12, marginBottom: 12 },
  statusTitle: { fontSize: 14.5, fontWeight: '700' },
  tight: { marginTop: 2 },
});
