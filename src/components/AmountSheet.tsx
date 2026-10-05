import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateKey, formatDay, fromKey } from '@/lib/dates';
import { dailyTarget, describeProgress, formatAmount, Habit, parseAmount, quickSteps, weekCount } from '@/lib/habit';
import { tapFeedback } from '@/lib/platform';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

type Props = {
  /** Hábito cuantitativo y día a registrar; null = cerrado. */
  target: { habit: Habit; day: DateKey } | null;
  onClose: () => void;
};

/** Panel para registrar cantidades: sumas rápidas y un campo para la cantidad exacta. */
export function AmountSheet({ target, onClose }: Props) {
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

  const value = days?.[day] ?? 0;
  const weekly = habit.goal.period === 'week';
  const goal = weekly ? habit.goal.count : dailyTarget(habit);
  const progressValue = weekly ? weekCount(days, fromKey(day)) : value;
  const progress = Math.min(progressValue / goal, 1);
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
            <Text style={[styles.value, { color: theme.text }]} accessibilityLabel={`Registrado: ${formatAmount(value)} ${habit.unit}`}>
              {formatAmount(value)}
              <Text style={[styles.unit, { color: theme.muted }]}> {habit.unit}</Text>
            </Text>
            <Text style={[styles.goalText, { color: theme.muted }]}>
              {weekly
                ? `Esta semana: ${describeProgress(habit, progressValue, goal)}`
                : `Meta: ${formatAmount(goal)} ${habit.unit}`}
            </Text>
            <View style={[styles.track, { backgroundColor: habit.color + theme.emptyAlpha }]}>
              <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: habit.color }]} />
            </View>
          </View>

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
  reset: { alignSelf: 'center' },
  resetText: { fontSize: 14, fontWeight: '600' },
});
