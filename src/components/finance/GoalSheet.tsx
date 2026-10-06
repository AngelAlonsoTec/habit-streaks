import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DatePicker } from '@/components/DatePicker';
import { AmountInput, PrimaryButton, SheetHeader, SheetModal, TextButton } from '@/components/finance/ui';
import { Chip, SectionTitle } from '@/components/ui';
import { GOAL_ICONS, MAX_GOAL_NAME_LENGTH, SavingsGoal, savingsPace } from '@/lib/finance';
import { formatMoney, moneyInputText, parseMoney } from '@/lib/money';
import { confirmAction } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useFinance } from '@/store/finance';
import { HABIT_COLORS, IconName, useTheme } from '@/theme';

const SUGGESTIONS: { name: string; icon: IconName }[] = [
  { name: 'Fondo de emergencia', icon: 'shield-checkmark' },
  { name: 'Viaje', icon: 'airplane' },
  { name: 'Celular nuevo', icon: 'phone-portrait' },
  { name: 'Computadora', icon: 'laptop' },
  { name: 'Enganche del auto', icon: 'car' },
  { name: 'Regalos', icon: 'gift' },
];

/** Cada icono tiene su color, así cada meta se distingue sin elegir dos cosas. */
export const goalColor = (icon: IconName) => HABIT_COLORS[(GOAL_ICONS.indexOf(icon) + HABIT_COLORS.length) % HABIT_COLORS.length];

type Props = {
  /** Meta a editar, 'new' para crear una, o null = cerrado. */
  goal: SavingsGoal | 'new' | null;
  onClose: () => void;
};

export function GoalSheet({ goal, onClose }: Props) {
  return (
    <SheetModal open={goal != null} onClose={onClose}>
      {goal != null && <Body goal={goal === 'new' ? null : goal} onClose={onClose} />}
    </SheetModal>
  );
}

function Body({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  const theme = useTheme();
  const today = useToday();
  const currency = useFinance((s) => s.currency);
  const addGoal = useFinance((s) => s.addGoal);
  const updateGoal = useFinance((s) => s.updateGoal);
  const deleteGoal = useFinance((s) => s.deleteGoal);

  const [name, setName] = useState(goal?.name ?? '');
  const [icon, setIcon] = useState<IconName>(goal?.icon ?? 'wallet');
  const [targetText, setTargetText] = useState(goal ? moneyInputText(goal.target, currency) : '');
  const [dueDate, setDueDate] = useState(goal?.dueDate ?? null);
  const target = parseMoney(targetText, currency);
  const color = goalColor(icon);
  const valid = name.trim().length > 0 && target != null;

  const pace = target != null && dueDate
    ? savingsPace({ ...(goal ?? { id: '', name, icon, color, deposits: [], achievedOn: null, createdAt: '' }), target, dueDate }, today)
    : null;

  const save = () => {
    if (!valid) return;
    const input = { name, icon, color, target, dueDate };
    if (goal) updateGoal(goal.id, input);
    else addGoal(input);
    onClose();
  };

  const remove = async () => {
    if (!goal) return;
    if (await confirmAction('Eliminar meta', `Se borrará "${goal.name}" y lo que llevas apartado en ella.`, 'Eliminar')) {
      deleteGoal(goal.id);
      onClose();
    }
  };

  return (
    <>
      <SheetHeader icon={icon} color={color} title={goal ? 'Editar meta' : 'Nueva meta de ahorro'} onClose={onClose} />
      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ej.: Viaje a la playa"
          placeholderTextColor={theme.muted}
          maxLength={MAX_GOAL_NAME_LENGTH}
          accessibilityLabel="Nombre de la meta"
          style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
        />
        {!goal && !name.trim() && (
          <View style={[styles.wrap, styles.suggestions]}>
            {SUGGESTIONS.map((s) => (
              <Chip
                key={s.name}
                label={s.name}
                icon={s.icon}
                onPress={() => {
                  setName(s.name);
                  setIcon(s.icon);
                }}
              />
            ))}
          </View>
        )}

        <View style={[styles.icons, styles.suggestions]}>
          {GOAL_ICONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              accessibilityLabel={`Icono ${i}`}
              accessibilityState={{ selected: icon === i }}
              style={[styles.icon, { backgroundColor: icon === i ? goalColor(i) : theme.surface }]}
            >
              <Ionicons name={i} size={18} color={icon === i ? '#FFFFFF' : theme.muted} />
            </Pressable>
          ))}
        </View>

        <SectionTitle>¿Cuánto quieres juntar?</SectionTitle>
        <AmountInput currency={currency} value={targetText} onChangeText={setTargetText} accessibilityLabel="Monto de la meta" />

        <SectionTitle>Fecha límite (opcional)</SectionTitle>
        <DatePicker value={dueDate} onChange={setDueDate} minKey={today} color={color} />

        {pace && (pace.perMonth != null || pace.perWeek != null) && (
          <Text style={[styles.pace, { color: theme.text }]}>
            Para llegar a tiempo tendrías que apartar{' '}
            <Text style={styles.bold}>
              {formatMoney(pace.perMonth ?? pace.perWeek!, currency)} {pace.perMonth != null ? 'al mes' : 'a la semana'}
            </Text>
            .
          </Text>
        )}
      </ScrollView>

      <PrimaryButton label={goal ? 'Guardar' : 'Crear meta'} color={color} onPress={save} disabled={!valid} />
      {goal && (
        <View style={styles.center}>
          <TextButton label="Eliminar meta" icon="trash-outline" color={theme.danger} onPress={remove} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 0 },
  input: {
    fontSize: 17, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestions: { marginTop: 12 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pace: { fontSize: 14, lineHeight: 20, marginTop: 14, marginBottom: 4 },
  bold: { fontWeight: '800' },
  center: { alignItems: 'center' },
});
