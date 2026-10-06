import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmountInput, PrimaryButton, SheetHeader, SheetModal, TextButton } from '@/components/finance/ui';
import { Chip, SectionTitle } from '@/components/ui';
import { addMonths, fromKey, toKey } from '@/lib/dates';
import { monthSpent } from '@/lib/finance';
import { formatMoney, formatMoneyRounded, moneyInputText, parseMoney } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { chartColor, useTheme } from '@/theme';

type Props = {
  /** Categoría a la que se pone presupuesto, 'new' para elegirla, o null = cerrado. */
  target: string | 'new' | null;
  onClose: () => void;
};

/** Presupuesto mensual de una categoría de gasto. */
export function BudgetSheet({ target, onClose }: Props) {
  return (
    <SheetModal open={target != null} onClose={onClose}>
      {target != null && <Body initial={target === 'new' ? null : target} onClose={onClose} />}
    </SheetModal>
  );
}

function Body({ initial, onClose }: { initial: string | null; onClose: () => void }) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const categories = useFinance((s) => s.categories);
  const budgets = useFinance((s) => s.budgets);
  const transactions = useFinance((s) => s.transactions);
  const setBudget = useFinance((s) => s.setBudget);

  const [categoryId, setCategoryId] = useState(initial);
  const existing = categoryId ? budgets[categoryId] : undefined;
  const [text, setText] = useState(existing ? moneyInputText(existing, currency) : '');
  const category = categories.find((c) => c.id === categoryId);
  const amount = parseMoney(text, currency);

  const spent = categoryId ? monthSpent(transactions, categoryId, today) : 0;
  // Media de los tres meses anteriores con gastos, como referencia.
  const average = useMemo(() => {
    if (!categoryId) return null;
    const months = [1, 2, 3].map((i) => monthSpent(transactions, categoryId, toKey(addMonths(fromKey(today), -i)))).filter((m) => m > 0);
    return months.length ? months.reduce((a, b) => a + b, 0) / months.length : null;
  }, [categoryId, transactions, today]);

  const choices = categories.filter((c) => c.kind === 'expense' && budgets[c.id] == null);

  const save = () => {
    if (!categoryId || amount == null) return;
    setBudget(categoryId, amount);
    onClose();
  };

  return (
    <>
      <SheetHeader
        icon={category?.icon ?? 'pie-chart'}
        color={category ? chartColor(category.color, theme) : theme.primary}
        title={category ? `Presupuesto: ${category.name}` : 'Nuevo presupuesto'}
        subtitle="Lo máximo que quieres gastar al mes"
        onClose={onClose}
      />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        {initial == null && (
          <>
            <SectionTitle>Categoría</SectionTitle>
            <View style={styles.wrap}>
              {choices.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  icon={c.icon}
                  color={chartColor(c.color, theme)}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(c.id)}
                />
              ))}
            </View>
          </>
        )}

        {categoryId && (
          <>
            <SectionTitle>Al mes</SectionTitle>
            <AmountInput
              currency={currency}
              value={text}
              onChangeText={setText}
              onSubmitEditing={save}
              autoFocus={initial != null}
              accessibilityLabel="Presupuesto mensual"
            />
            <Text style={[styles.info, { color: theme.muted }]}>
              Este mes llevas {formatMoney(spent, currency)}
              {amount != null ? ` (${Math.round((spent / amount) * 100)} %)` : ''}.
            </Text>
            {average != null && (
              <View style={styles.wrap}>
                <Chip
                  label={`Tu promedio: ${formatMoneyRounded(average, currency)}`}
                  icon="analytics-outline"
                  onPress={() => setText(moneyInputText(Math.round(average), currency))}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>

      <PrimaryButton label="Guardar presupuesto" color={category ? chartColor(category.color, theme) : theme.primary} onPress={save} disabled={!categoryId || amount == null} />
      {existing != null && (
        <View style={styles.center}>
          <TextButton
            label="Quitar presupuesto"
            icon="trash-outline"
            color={theme.danger}
            onPress={() => {
              setBudget(categoryId!, null);
              onClose();
            }}
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  info: { fontSize: 13, marginTop: 8, marginBottom: 10 },
  center: { alignItems: 'center' },
});
