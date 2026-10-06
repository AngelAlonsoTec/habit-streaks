import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatePicker } from '@/components/DatePicker';
import { AmountInput, NumberField, PrimaryButton, TextButton } from '@/components/finance/ui';
import { Chip, SectionTitle, Segmented } from '@/components/ui';
import { addDays, DateKey, fromKey, toKey } from '@/lib/dates';
import {
  budgetLevel, FUEL_CATEGORY, lastOdometer, MAX_CATEGORY_LENGTH, MAX_NOTE_LENGTH, MAX_PLATFORM_LENGTH, monthSpent,
  SHIFT_CATEGORY, Transaction, TransactionInput, TxKind,
} from '@/lib/finance';
import { formatMoney, formatNumber, moneyInputText, parseMoney } from '@/lib/money';
import { confirmAction, goBack } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { useTheme } from '@/theme';

type Mode = 'shift' | 'fuel';

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

function EntryForm({ existing, initialKind, mode }: { existing?: Transaction; initialKind: TxKind; mode: Mode | null }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const categories = useFinance((s) => s.categories);
  const platforms = useFinance((s) => s.platforms);
  const transactions = useFinance((s) => s.transactions);
  const budgets = useFinance((s) => s.budgets);
  const addTransaction = useFinance((s) => s.addTransaction);
  const updateTransaction = useFinance((s) => s.updateTransaction);
  const deleteTransaction = useFinance((s) => s.deleteTransaction);
  const addCategory = useFinance((s) => s.addCategory);
  const addPlatform = useFinance((s) => s.addPlatform);

  // La plataforma de la última jornada: lo normal es repetir.
  const lastPlatform = [...transactions].reverse().find((t) => t.shift)?.shift?.platform;

  const [kind, setKind] = useState<TxKind>(initialKind);
  const [amountText, setAmountText] = useState(existing ? moneyInputText(existing.amount, currency) : '');
  const [categoryId, setCategoryId] = useState<string | null>(
    existing?.categoryId ?? (mode === 'shift' ? SHIFT_CATEGORY : mode === 'fuel' ? FUEL_CATEGORY : null),
  );
  const [date, setDate] = useState<DateKey>(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [platform, setPlatform] = useState(existing?.shift?.platform ?? lastPlatform ?? platforms[0] ?? '');
  const [hoursText, setHoursText] = useState(toText(existing?.shift?.hours));
  const [tripsText, setTripsText] = useState(toText(existing?.shift?.trips));
  const [litersText, setLitersText] = useState(toText(existing?.fuel?.liters));
  const [odometerText, setOdometerText] = useState(toText(existing?.fuel?.odometer));
  const [fullTank, setFullTank] = useState(existing?.fuel?.fullTank ?? true);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [newPlatform, setNewPlatform] = useState<string | null>(null);

  const amount = parseMoney(amountText, currency);
  const kindCategories = categories.filter((c) => c.kind === kind);
  const category = kindCategories.find((c) => c.id === categoryId);
  const isShift = kind === 'income' && categoryId === SHIFT_CATEGORY;
  const isFuel = kind === 'expense' && categoryId === FUEL_CATEGORY;
  const hours = parseMoney(hoursText, currency);
  const trips = parseMoney(tripsText, currency);
  const liters = parseMoney(litersText, currency);
  const odometer = parseMoney(odometerText, currency);
  const color = category?.color ?? (kind === 'income' ? theme.primary : theme.danger);
  const valid = amount != null && category != null && (!isShift || platform.trim().length > 0);

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

  const shiftHint = isShift && amount != null
    ? [
        hours != null ? `${formatMoney(amount / hours, currency)} por hora` : null,
        trips != null && trips >= 1 ? `${formatMoney(amount / Math.round(trips), currency)} por viaje` : null,
      ].filter(Boolean).join(' · ')
    : '';

  const changeKind = (k: TxKind) => {
    setKind(k);
    setCategoryId(null);
  };

  const createCategory = () => {
    const id = newCategory ? addCategory(newCategory, kind) : null;
    if (id) setCategoryId(id);
    setNewCategory(null);
  };

  const createPlatform = () => {
    const name = newPlatform ? addPlatform(newPlatform) : null;
    if (name) setPlatform(name);
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
      shift: isShift ? { platform, hours, trips } : null,
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
        {budgetHint && <Text style={[styles.hint, { color: budgetHint.color }]}>{budgetHint.text}</Text>}

        {!mode && (
          <>
            <SectionTitle>Categoría</SectionTitle>
            <View style={styles.wrap}>
              {kindCategories.map((c) => (
                <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
              {newCategory == null && <Chip label="Nueva" icon="add" onPress={() => setNewCategory('')} />}
            </View>
            {newCategory != null && (
              <View style={styles.inlineRow}>
                <TextInput
                  value={newCategory}
                  onChangeText={setNewCategory}
                  placeholder="Nombre de la categoría"
                  placeholderTextColor={theme.muted}
                  maxLength={MAX_CATEGORY_LENGTH}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={createCategory}
                  style={[styles.input, styles.flex, { color: theme.text, backgroundColor: theme.surface }]}
                />
                <TextButton label="Añadir" onPress={createCategory} />
              </View>
            )}
          </>
        )}

        {isShift && (
          <>
            <SectionTitle>Plataforma</SectionTitle>
            <View style={styles.wrap}>
              {platforms.map((p) => (
                <Chip key={p} label={p} color={color} selected={platform === p} onPress={() => setPlatform(p)} />
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
            <SectionTitle>Jornada (opcional)</SectionTitle>
            <View style={styles.fields}>
              <NumberField unit="horas" value={hoursText} onChangeText={setHoursText} placeholder="0" accessibilityLabel="Horas conectado" />
              <NumberField unit="viajes" integer value={tripsText} onChangeText={setTripsText} placeholder="0" accessibilityLabel="Viajes" />
            </View>
            {shiftHint ? <Text style={[styles.hint, { color: theme.text }]}>{shiftHint}</Text> : null}
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
                <Text style={[styles.switchText, { color: theme.muted }]}>Entre dos cargas llenas se calcula el rendimiento.</Text>
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
