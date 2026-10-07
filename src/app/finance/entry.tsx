import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatePicker } from '@/components/DatePicker';
import { CategoryPicker } from '@/components/finance/CategoryPicker';
import { AmountInput, NumberField, PrimaryButton, TextButton } from '@/components/finance/ui';
import { Chip, SectionTitle, Segmented } from '@/components/ui';
import { addDays, DateKey, fromKey, toKey } from '@/lib/dates';
import {
  budgetLevel, FUEL_CATEGORY, lastOdometer, MAX_NOTE_LENGTH, MAX_PLATFORM_LENGTH, monthSpent,
  parseHours, parseQuantity, payoutDate, SHIFT_CATEGORY, sortByUse, Transaction, TransactionInput, TxKind, weekdayDate,
} from '@/lib/finance';
import { formatMoney, formatNumber, moneyInputText, parseMoney } from '@/lib/money';
import { confirmAction, goBack } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { chartColor, useTheme } from '@/theme';

type Mode = 'shift' | 'fuel';

/** Lo que se escribe de una plataforma en la jornada. */
type EarningRow = { platform: string; amountText: string; tripsText: string };

export default function EntryScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; kind?: string; mode?: string }>();
  const existing = useFinance((s) => (params.id ? s.transactions.find((t) => t.id === params.id) : undefined));

  if (params.id && !existing) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: 'Movimiento' }} />
        <Text style={[styles.missingText, { color: theme.muted }]}>Este movimiento ya no existe.</Text>
      </View>
    );
  }
  const mode = params.mode === 'shift' || params.mode === 'fuel' ? params.mode : null;
  const kind: TxKind = existing?.kind ?? (mode === 'shift' || params.kind === 'income' ? 'income' : 'expense');
  return <EntryForm existing={existing} initialKind={kind} mode={mode} />;
}

const toText = (n: number | null | undefined) => (n == null ? '' : String(n));

/** "litros", "litros y kilometraje", "horas, litros y viajes". */
const listFields = (fields: string[]) =>
  fields.length > 1 ? `${fields.slice(0, -1).join(', ')} y ${fields.at(-1)}` : fields[0];

function EntryForm({ existing, initialKind, mode }: { existing?: Transaction; initialKind: TxKind; mode: Mode | null }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const categories = useFinance((s) => s.categories);
  const platforms = useFinance((s) => s.platforms);
  const payouts = useFinance((s) => s.payouts);
  const transactions = useFinance((s) => s.transactions);
  const budgets = useFinance((s) => s.budgets);
  const addTransaction = useFinance((s) => s.addTransaction);
  const updateTransaction = useFinance((s) => s.updateTransaction);
  const deleteTransaction = useFinance((s) => s.deleteTransaction);
  const addCategory = useFinance((s) => s.addCategory);
  const addPlatform = useFinance((s) => s.addPlatform);

  // Las plataformas de la última jornada: lo normal es repetir.
  const lastShift = [...transactions].reverse().find((t) => t.shift)?.shift;
  const initialRows: EarningRow[] = existing?.shift
    ? existing.shift.platforms.map((p) => ({ platform: p.platform, amountText: moneyInputText(p.amount, currency), tripsText: toText(p.trips) }))
    : (lastShift?.platforms.map((p) => p.platform) ?? platforms.slice(0, 1)).map((platform) => ({ platform, amountText: '', tripsText: '' }));

  const [kind, setKind] = useState<TxKind>(initialKind);
  const [amountText, setAmountText] = useState(existing ? moneyInputText(existing.amount, currency) : '');
  const [categoryId, setCategoryId] = useState<string | null>(
    existing?.categoryId ?? (mode === 'shift' ? SHIFT_CATEGORY : mode === 'fuel' ? FUEL_CATEGORY : null),
  );
  const [date, setDate] = useState<DateKey>(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [rows, setRows] = useState<EarningRow[]>(initialRows);
  const [hoursText, setHoursText] = useState(toText(existing?.shift?.hours));
  const [litersText, setLitersText] = useState(toText(existing?.fuel?.liters));
  const [odometerText, setOdometerText] = useState(toText(existing?.fuel?.odometer));
  const [fullTank, setFullTank] = useState(existing?.fuel?.fullTank ?? true);
  const [newPlatform, setNewPlatform] = useState<string | null>(null);

  // Las más usadas primero: el gasto de todos los días está a un toque.
  const kindCategories = sortByUse(categories.filter((c) => c.kind === kind), transactions, today);
  const category = kindCategories.find((c) => c.id === categoryId);
  const isShift = kind === 'income' && categoryId === SHIFT_CATEGORY;
  const isFuel = kind === 'expense' && categoryId === FUEL_CATEGORY;

  // Cada campo se lee como lo escribe la gente; si no se entiende, se avisa (nunca se descarta en silencio).
  const earnings = rows.map((r) => ({
    platform: r.platform,
    amount: parseMoney(r.amountText, currency),
    trips: r.tripsText.trim() ? parseQuantity(r.tripsText, currency, true) : null,
    badTrips: r.tripsText.trim() !== '' && parseQuantity(r.tripsText, currency, true) == null,
  }));
  const shiftTotal = earnings.every((e) => e.amount != null) && earnings.length
    ? earnings.reduce((s, e) => s + e.amount!, 0)
    : null;
  const amount = isShift ? shiftTotal : parseMoney(amountText, currency);
  const hours = hoursText.trim() ? parseHours(hoursText, currency) : null;
  const liters = litersText.trim() ? parseQuantity(litersText, currency) : null;
  const odometer = odometerText.trim() ? parseQuantity(odometerText, currency, true) : null;

  const badFields = [
    isShift && hoursText.trim() && hours == null ? 'las horas' : null,
    isShift && earnings.some((e) => e.badTrips) ? 'los viajes' : null,
    isFuel && litersText.trim() && liters == null ? 'los litros' : null,
    isFuel && odometerText.trim() && odometer == null ? 'el kilometraje' : null,
  ].filter((f): f is string => f != null);
  const missingAmounts = isShift ? earnings.filter((e) => e.amount == null).map((e) => e.platform) : [];

  const color = category ? chartColor(category.color, theme) : kind === 'income' ? theme.primary : theme.danger;
  const valid = amount != null && category != null && badFields.length === 0 && (!isShift || rows.length > 0);

  const title = existing
    ? 'Editar movimiento'
    : isShift ? 'Nueva jornada' : isFuel ? 'Carga de gasolina' : kind === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto';

  // Aviso del presupuesto antes de guardar: así se ve venir.
  const budget = kind === 'expense' && categoryId ? budgets[categoryId] : undefined;
  const budgetHint = (() => {
    if (budget == null || amount == null || !category) return null;
    const after = monthSpent(transactions, category.id, date, existing?.id) + amount;
    const level = budgetLevel(after, budget);
    const text = level === 'over'
      ? `Con este gasto te pasarías ${formatMoney(after - budget, currency)} del presupuesto de ${category.name}.`
      : `Con este gasto llevarías ${formatMoney(after, currency)} de ${formatMoney(budget, currency)} en ${category.name} este mes (${Math.round((after / budget) * 100)} %).`;
    return { text, color: level === 'over' ? theme.danger : level === 'near' ? '#D97706' : theme.muted };
  })();

  const previousOdometer = isFuel ? lastOdometer(transactions, date, existing?.id) : null;
  const fuelHint = (() => {
    if (!isFuel) return null;
    const parts: { text: string; warning?: boolean }[] = [];
    if (amount != null && liters != null) parts.push({ text: `Sale a ${formatMoney(amount / liters, currency)} el litro.` });
    if (odometer != null && previousOdometer != null) {
      parts.push(
        odometer > previousOdometer
          ? { text: `Recorriste ${formatNumber(odometer - previousOdometer, currency, 0)} km desde la carga anterior.` }
          : { text: `Es menos que en tu carga anterior (${formatNumber(previousOdometer, currency, 0)} km). ¿Está bien escrito?`, warning: true },
      );
    }
    return parts;
  })();

  const totalTrips = earnings.reduce((s, e) => s + (e.trips ?? 0), 0);
  const tripsIncome = earnings.reduce((s, e) => s + (e.trips && e.amount ? e.amount : 0), 0);
  // Las apps que pagan por semana: cuándo llega lo de esta jornada.
  const laterPay = isShift && !existing?.shift?.paidOn
    ? rows.map((r) => ({ platform: r.platform, date: payoutDate(date, payouts[r.platform]) })).filter((p) => p.date > today)
    : [];
  const shiftHint = isShift && amount != null
    ? [
        hours != null ? `${formatMoney(amount / hours, currency)} por hora` : null,
        totalTrips > 0 ? `${formatMoney(tripsIncome / totalTrips, currency)} por viaje` : null,
      ].filter(Boolean).join(' · ')
    : '';

  const changeKind = (k: TxKind) => {
    setKind(k);
    setCategoryId(null);
  };

  const selectCategory = (id: string) => {
    setCategoryId(id);
    // Si ya escribió el importe y elige "Viajes", ese importe es el de su plataforma.
    if (id === SHIFT_CATEGORY && rows.length === 1 && !rows[0].amountText && amountText) {
      setRows([{ ...rows[0], amountText }]);
    }
  };

  const createCategory = (name: string) => {
    const id = addCategory(name, kind);
    if (id) selectCategory(id);
  };

  const togglePlatform = (platform: string) =>
    setRows((rs) => (rs.some((r) => r.platform === platform)
      ? rs.filter((r) => r.platform !== platform)
      : [...rs, { platform, amountText: '', tripsText: '' }]));

  const updateRow = (platform: string, patch: Partial<EarningRow>) =>
    setRows((rs) => rs.map((r) => (r.platform === platform ? { ...r, ...patch } : r)));

  const createPlatform = () => {
    const name = newPlatform ? addPlatform(newPlatform) : null;
    if (name && !rows.some((r) => r.platform === name)) togglePlatform(name);
    setNewPlatform(null);
  };

  const save = () => {
    if (!valid) return;
    const input: TransactionInput = {
      kind,
      amount,
      categoryId: category.id,
      date,
      note,
      shift: isShift
        ? { platforms: earnings.map((e) => ({ platform: e.platform, amount: e.amount!, trips: e.trips })), hours, paidOn: existing?.shift?.paidOn ?? null }
        : null,
      fuel: isFuel ? { liters, odometer, fullTank } : null,
    };
    if (existing) updateTransaction(existing.id, input);
    else addTransaction(input);
    goBack('/finance');
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirmAction('Eliminar movimiento', 'Se borrará de tus cuentas.', 'Eliminar')) {
      deleteTransaction(existing.id);
      goBack('/finance');
    }
  };

  const yesterday = toKey(addDays(fromKey(today), -1));
  // Las de la lista y las que tenga la jornada aunque ya se quitaran de la lista.
  const platformChoices = [...platforms, ...rows.map((r) => r.platform).filter((p) => !platforms.includes(p))];

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!mode && (
          <Segmented
            value={kind}
            onChange={changeKind}
            options={[
              { value: 'expense', label: 'Gasto', icon: 'arrow-up-circle-outline' },
              { value: 'income', label: 'Ingreso', icon: 'arrow-down-circle-outline' },
            ]}
            color={kind === 'income' ? theme.primary : theme.danger}
          />
        )}

        {!isShift && (
          <>
            <AmountInput
              currency={currency}
              large
              value={amountText}
              onChangeText={setAmountText}
              autoFocus={!existing}
              accessibilityLabel="Importe"
            />
            {amountText.trim() !== '' && amount == null && (
              <Text style={[styles.hint, { color: theme.danger }]}>Escribe un importe válido, por ejemplo 250 o 1,250.50.</Text>
            )}
          </>
        )}
        {budgetHint && <Text style={[styles.hint, { color: budgetHint.color }]}>{budgetHint.text}</Text>}

        {!mode && (
          <>
            <SectionTitle>Categoría</SectionTitle>
            <CategoryPicker categories={kindCategories} value={categoryId} onChange={selectCategory} onCreate={createCategory} />
          </>
        )}

        {isShift && (
          <>
            <SectionTitle>¿Con qué apps trabajaste?</SectionTitle>
            <View style={styles.wrap}>
              {platformChoices.map((p) => (
                <Chip key={p} label={p} color={color} selected={rows.some((r) => r.platform === p)} onPress={() => togglePlatform(p)} />
              ))}
              {newPlatform == null && <Chip label="Otra" icon="add" onPress={() => setNewPlatform('')} />}
            </View>
            {newPlatform != null && (
              <View style={styles.inlineRow}>
                <TextInput
                  value={newPlatform}
                  onChangeText={setNewPlatform}
                  placeholder="Nombre de la plataforma"
                  placeholderTextColor={theme.muted}
                  maxLength={MAX_PLATFORM_LENGTH}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={createPlatform}
                  style={[styles.input, styles.flex, { color: theme.text, backgroundColor: theme.surface }]}
                />
                <TextButton label="Añadir" onPress={createPlatform} />
              </View>
            )}

            {rows.length > 0 && <SectionTitle>Lo que te dejó cada una</SectionTitle>}
            {rows.map((r, i) => (
              <View key={r.platform} style={[styles.earning, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.earningName, { color: theme.text }]}>{r.platform}</Text>
                <View style={styles.fields}>
                  <View style={styles.earningAmount}>
                    <AmountInput
                      currency={currency}
                      value={r.amountText}
                      onChangeText={(t) => updateRow(r.platform, { amountText: t })}
                      autoFocus={!existing && i === 0}
                      accessibilityLabel={`Ganancia en ${r.platform}`}
                    />
                  </View>
                  <NumberField
                    unit="viajes"
                    integer
                    value={r.tripsText}
                    onChangeText={(t) => updateRow(r.platform, { tripsText: t })}
                    placeholder="0"
                    accessibilityLabel={`Viajes en ${r.platform}`}
                  />
                </View>
              </View>
            ))}
            {rows.length > 1 && amount != null && (
              <Text style={[styles.total, { color: theme.text }]}>Total de la jornada: {formatMoney(amount, currency)}</Text>
            )}
            {missingAmounts.length > 0 && rows.some((r) => r.amountText.trim()) && (
              <Text style={[styles.hint, { color: theme.muted }]}>Falta lo de {listFields(missingAmounts)}.</Text>
            )}

            <SectionTitle>Horas conectado (opcional)</SectionTitle>
            {/* Teclado con ":" para poder escribir 8:30 (el numérico no lo tiene). */}
            <NumberField
              unit="horas"
              keyboardType="numbers-and-punctuation"
              value={hoursText}
              onChangeText={setHoursText}
              placeholder="Ej.: 8:30"
              accessibilityLabel="Horas conectado"
            />
            <Text style={[styles.hint, { color: theme.muted }]}>
              {rows.length > 1
                ? 'Las horas totales: si tuviste varias apps abiertas a la vez, cuéntalas una sola vez.'
                : 'Desde que te conectaste hasta que acabaste.'}
            </Text>
            {shiftHint ? <Text style={[styles.hint, { color: theme.text }]}>{shiftHint}</Text> : null}
            {laterPay.length > 0 && (
              <Text style={[styles.hint, { color: theme.muted }]}>
                {laterPay.map((p) => `${p.platform} te lo paga el ${weekdayDate(p.date)}`).join('; ')}: hasta entonces se ve aparte del
                balance, como «por cobrar».
              </Text>
            )}
          </>
        )}

        {isFuel && (
          <>
            <SectionTitle>Carga (opcional)</SectionTitle>
            <View style={styles.fields}>
              <NumberField unit="litros" value={litersText} onChangeText={setLitersText} placeholder="0" accessibilityLabel="Litros" />
              <NumberField unit="km" integer value={odometerText} onChangeText={setOdometerText} placeholder="Kilometraje" accessibilityLabel="Kilometraje" />
            </View>
            <View style={[styles.switchRow, { backgroundColor: theme.surface }]}>
              <View style={styles.flex}>
                <Text style={[styles.switchTitle, { color: theme.text }]}>Tanque lleno</Text>
                <Text style={[styles.switchText, { color: theme.muted }]}>
                  Si lo llenas, el rendimiento sale exacto; si no, se calcula aproximado con varias cargas.
                </Text>
              </View>
              <Switch
                value={fullTank}
                onValueChange={setFullTank}
                trackColor={{ true: color, false: theme.border }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Tanque lleno"
              />
            </View>
            {fuelHint?.map((h) => (
              <Text key={h.text} style={[styles.hint, { color: h.warning ? '#D97706' : theme.text }]}>{h.text}</Text>
            ))}
          </>
        )}

        {badFields.length > 0 && (
          <Text style={[styles.hint, { color: theme.danger }]}>
            No entiendo {listFields(badFields)}: escribe solo el número, por ejemplo {isShift ? '8, 8.5 u 8:30 horas y 17 viajes' : '30.5 litros y 45,230 km'}.
          </Text>
        )}

        <SectionTitle>Fecha</SectionTitle>
        <DatePicker
          value={date}
          onChange={(d) => d && setDate(d)}
          maxKey={today}
          presets={[{ label: 'Hoy', key: today }, { label: 'Ayer', key: yesterday }]}
          allowNone={false}
          color={color}
        />

        <SectionTitle>Nota</SectionTitle>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={isShift ? 'Opcional: turno, zona…' : kind === 'income' ? 'Opcional: de qué es' : 'Opcional: en qué fue'}
          placeholderTextColor={theme.muted}
          maxLength={MAX_NOTE_LENGTH}
          returnKeyType="done"
          accessibilityLabel="Nota"
          style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
        />

        {existing?.recurringId && (
          <View style={styles.recurring}>
            <Ionicons name="repeat" size={14} color={theme.muted} />
            <Text style={[styles.hint, { color: theme.muted }]}>Lo apuntó solo un pago o cobro fijo.</Text>
          </View>
        )}

        {existing && (
          <Pressable onPress={remove} accessibilityRole="button" style={styles.delete}>
            <Ionicons name="trash-outline" size={17} color={theme.danger} />
            <Text style={[styles.deleteText, { color: theme.danger }]}>Eliminar movimiento</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border, backgroundColor: theme.bg }]}>
        {!valid && amount != null && !category && (
          <Text style={[styles.footerHint, { color: theme.muted }]}>Elige una categoría</Text>
        )}
        {isShift && rows.length === 0 && (
          <Text style={[styles.footerHint, { color: theme.muted }]}>Elige al menos una app</Text>
        )}
        <PrimaryButton
          label={
            existing ? 'Guardar cambios'
              : isShift ? 'Guardar jornada'
                : isFuel ? 'Guardar carga'
                  : kind === 'income' ? 'Guardar ingreso' : 'Guardar gasto'
          }
          color={color}
          onPress={save}
          disabled={!valid}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: {
    fontSize: 16, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  fields: { flexDirection: 'row', gap: 8 },
  earning: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 8, marginBottom: 4 },
  earningName: { fontSize: 15, fontWeight: '800', paddingHorizontal: 4 },
  earningAmount: { flex: 1.3 },
  total: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginTop: 8 },
  switchTitle: { fontSize: 15, fontWeight: '700' },
  switchText: { fontSize: 12.5, marginTop: 2 },
  recurring: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, paddingVertical: 10 },
  deleteText: { fontSize: 15, fontWeight: '700' },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  footerHint: { fontSize: 13, textAlign: 'center' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingText: { fontSize: 15 },
});
