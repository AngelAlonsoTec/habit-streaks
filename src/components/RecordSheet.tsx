import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateKey, formatDay, fromKey } from '@/lib/dates';
import {
  dailyTarget, describeProgress, formatAmount, Habit, isQuantity, isQuit, parseAmount, quickSteps, weekCount,
} from '@/lib/habit';
import { tapFeedback } from '@/lib/platform';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

type Props = {
  /** Hábito y día a registrar; null = cerrado. */
  target: { habit: Habit; day: DateKey } | null;
  onClose: () => void;
};

/**
 * Panel de registro para lo que no se marca con un toque: cantidades (sumas rápidas y
 * cantidad exacta) y recaídas de los hábitos para dejar (evita registrarlas sin querer).
 */
export function RecordSheet({ target, onClose }: Props) {
  return (
    <Modal visible={target != null} transparent animationType="fade" onRequestClose={onClose}>
      {/* Se monta de nuevo en cada apertura para empezar con el campo vacío. */}
      {target && <Sheet habit={target.habit} day={target.day} onClose={onClose} />}
    </Modal>
  );
}

function Sheet({ habit, day, onClose }: { habit: Habit; day: DateKey; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const days = useHabits((s) => s.completions[habit.id]);
  const addAmount = useHabits((s) => s.addAmount);
  const setCompletion = useHabits((s) => s.setCompletion);
  const [text, setText] = useState('');

  const quantity = isQuantity(habit);
  const quit = isQuit(habit);
  const value = days?.[day] ?? 0;
  const weekly = habit.goal.period === 'week';
  // Al dejar, la referencia es el límite tal cual; al generar por días, la meta del día.
  const goal = weekly || quit ? habit.goal.count : dailyTarget(habit);
  const progressValue = weekly ? weekCount(days, fromKey(day)) : value;
  const over = quit && progressValue > goal;
  const showBar = !(quit && goal === 0);
  const progress = goal > 0 ? Math.min(progressValue / goal, 1) : 0;
  const amount = parseAmount(text);

  const add = (delta: number) => {
    tapFeedback();
    addAmount(habit.id, day, delta);
  };

  const apply = (sign: 1 | -1) => {
    if (amount == null) return;
    add(sign * amount);
    setText('');
  };

  const valueLabel = quantity
    ? habit.unit
    : quit && goal === 0
      ? value === 1 ? 'recaída' : 'recaídas'
      : value === 1 ? 'vez' : 'veces';

  const limitText = quantity ? `${formatAmount(goal)} ${habit.unit}` : `${goal} ${goal === 1 ? 'vez' : 'veces'}`;
  const goalText = weekly
    ? `Esta semana: ${describeProgress(habit, progressValue, goal)}`
    : quit
      ? goal === 0 ? 'Objetivo: ninguna' : `Límite: máx. ${limitText} al día`
      : `Meta: ${limitText}`;

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: habit.color }]}>
              <Ionicons name={habit.icon} size={20} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{habit.name}</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>{formatDay(day)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={theme.muted} />
            </Pressable>
          </View>

          <View style={styles.totals}>
            <Text
              style={[styles.value, { color: over ? theme.danger : theme.text }]}
              accessibilityLabel={`Registrado: ${formatAmount(value)} ${valueLabel}`}
            >
              {formatAmount(value)}
              <Text style={[styles.unit, { color: theme.muted }]}> {valueLabel}</Text>
            </Text>
            <Text style={[styles.goalText, { color: over ? theme.danger : theme.muted }]}>
              {over ? `${goalText} · límite superado` : goalText}
            </Text>
            {showBar && (
              <View style={[styles.track, { backgroundColor: habit.color + theme.emptyAlpha }]}>
                <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: over ? theme.danger : habit.color }]} />
              </View>
            )}
          </View>

          {quantity ? (
            <>
              <View style={styles.steps}>
                {quickSteps(habit).map((step) => (
                  <Pressable
                    key={step}
                    onPress={() => add(step)}
                    accessibilityLabel={`Sumar ${formatAmount(step)} ${habit.unit}`}
                    style={({ pressed }) => [styles.step, { backgroundColor: habit.color + theme.emptyAlpha, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={[styles.stepText, { color: theme.text }]}>+{formatAmount(step)}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.inputRow, { backgroundColor: theme.surface }]}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Otra cantidad"
                  placeholderTextColor={theme.muted}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={() => apply(1)}
                  accessibilityLabel="Cantidad"
                  style={[styles.input, { color: theme.text }]}
                />
                <Text style={[styles.inputUnit, { color: theme.muted }]}>{habit.unit}</Text>
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={() => apply(-1)}
                  disabled={amount == null || value === 0}
                  style={[styles.button, { backgroundColor: theme.surface, opacity: amount == null || value === 0 ? 0.4 : 1 }]}
                >
                  <Ionicons name="remove" size={18} color={theme.text} />
                  <Text style={[styles.buttonText, { color: theme.text }]}>Restar</Text>
                </Pressable>
                <Pressable
                  onPress={() => apply(1)}
                  disabled={amount == null}
                  style={[styles.button, styles.primary, { backgroundColor: habit.color, opacity: amount == null ? 0.4 : 1 }]}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Sumar</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={() => add(-1)}
                disabled={value === 0}
                accessibilityLabel="Quitar una"
                style={[styles.button, { backgroundColor: theme.surface, opacity: value === 0 ? 0.4 : 1 }]}
              >
                <Ionicons name="remove" size={18} color={theme.text} />
                <Text style={[styles.buttonText, { color: theme.text }]}>Quitar</Text>
              </Pressable>
              <Pressable
                onPress={() => add(1)}
                style={[styles.button, styles.primary, { backgroundColor: goal === 0 ? theme.danger : habit.color }]}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{goal === 0 ? 'Registrar recaída' : 'Registrar una'}</Text>
              </Pressable>
            </View>
          )}

          {quit && (
            <Text style={[styles.hint, { color: theme.muted }]}>
              Los días sin registros cuentan como logrados. Registra solo cuando lo hagas.
            </Text>
          )}

          {value > 0 && (
            <Pressable onPress={() => { tapFeedback(); setCompletion(habit.id, day, 0); }} hitSlop={8} style={styles.reset}>
              <Text style={[styles.resetText, { color: theme.danger }]}>Borrar lo registrado este día</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 1 },
  totals: { alignItems: 'center', gap: 6 },
  value: { fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 20, fontWeight: '700' },
  goalText: { fontSize: 14 },
  track: { alignSelf: 'stretch', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 4 },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  stepText: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 18, fontWeight: '700', paddingVertical: 12, ...Platform.select({ web: { outlineWidth: 0 } }) },
  inputUnit: { fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 2 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: -4 },
  reset: { alignSelf: 'center' },
  resetText: { fontSize: 14, fontWeight: '600' },
});
