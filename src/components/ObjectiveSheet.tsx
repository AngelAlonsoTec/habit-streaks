import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatePicker } from '@/components/DatePicker';
import { Chip, SectionTitle } from '@/components/ui';
import type { Habit } from '@/lib/habit';
import { MAX_OBJECTIVE_LENGTH, Objective, suggestObjectives } from '@/lib/objectives';
import { confirmAction } from '@/lib/platform';
import { useToday } from '@/lib/useToday';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

/** Referencia fija: un selector de zustand que devuelve un [] nuevo en cada llamada provoca renders sin fin. */
const NO_OBJECTIVES: Objective[] = [];

type Props = {
  habit: Habit;
  /** Objetivo a editar, 'new' para crear uno, o null = cerrado. */
  objective: Objective | 'new' | null;
  onClose: () => void;
};

/** Crear o editar un objetivo: título (con sugerencias), fecha límite opcional, orden y borrar. */
export function ObjectiveSheet({ habit, objective, onClose }: Props) {
  return (
    <Modal visible={objective != null} transparent animationType="fade" onRequestClose={onClose}>
      {/* Se monta de nuevo en cada apertura para partir de los datos del objetivo. */}
      {objective != null && <Sheet habit={habit} objective={objective === 'new' ? null : objective} onClose={onClose} />}
    </Modal>
  );
}

function Sheet({ habit, objective, onClose }: { habit: Habit; objective: Objective | null; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const addObjective = useHabits((s) => s.addObjective);
  const updateObjective = useHabits((s) => s.updateObjective);
  const deleteObjective = useHabits((s) => s.deleteObjective);
  const moveObjective = useHabits((s) => s.moveObjective);
  // El orden se lee del store para que Subir/Bajar se vea al momento.
  const objectives = useHabits((s) => s.habits.find((h) => h.id === habit.id)?.objectives ?? NO_OBJECTIVES);

  const [title, setTitle] = useState(objective?.title ?? '');
  const [dueDate, setDueDate] = useState(objective?.dueDate ?? null);
  const isNew = objective == null;
  const valid = title.trim().length > 0;
  const index = objective ? objectives.findIndex((o) => o.id === objective.id) : -1;
  const suggestions = isNew && !title.trim() ? suggestObjectives(habit).slice(0, 6) : [];

  const save = () => {
    if (!valid) return;
    if (isNew) addObjective(habit.id, { title, dueDate });
    else updateObjective(habit.id, objective.id, { title, dueDate });
    onClose();
  };

  const remove = async () => {
    if (!objective) return;
    if (await confirmAction('Eliminar objetivo', `Se borrará "${objective.title}".`, 'Eliminar')) {
      deleteObjective(habit.id, objective.id);
      onClose();
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
          <View style={styles.header}>
            <Ionicons name="flag" size={20} color={habit.color} />
            <Text style={[styles.title, { color: theme.text }]}>{isNew ? 'Nuevo objetivo' : 'Editar objetivo'}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={theme.muted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ej.: Alcanzar el A1"
              placeholderTextColor={theme.muted}
              maxLength={MAX_OBJECTIVE_LENGTH}
              autoFocus={isNew}
              returnKeyType="done"
              onSubmitEditing={save}
              accessibilityLabel="Objetivo"
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
            />

            {suggestions.length > 0 && (
              <>
                <SectionTitle>Sugerencias</SectionTitle>
                <View style={styles.wrap}>
                  {suggestions.map((s) => (
                    <Chip key={s} label={s} onPress={() => setTitle(s)} />
                  ))}
                </View>
              </>
            )}

            <SectionTitle>Fecha límite (opcional)</SectionTitle>
            <DatePicker value={dueDate} onChange={setDueDate} minKey={today} color={habit.color} />

            {!isNew && (
              <View style={styles.tools}>
                <Pressable
                  onPress={() => moveObjective(habit.id, objective.id, -1)}
                  disabled={index <= 0}
                  style={[styles.tool, { backgroundColor: theme.surface, opacity: index <= 0 ? 0.4 : 1 }]}
                >
                  <Ionicons name="arrow-up" size={16} color={theme.text} />
                  <Text style={[styles.toolText, { color: theme.text }]}>Subir</Text>
                </Pressable>
                <Pressable
                  onPress={() => moveObjective(habit.id, objective.id, 1)}
                  disabled={index < 0 || index >= objectives.length - 1}
                  style={[styles.tool, { backgroundColor: theme.surface, opacity: index >= objectives.length - 1 ? 0.4 : 1 }]}
                >
                  <Ionicons name="arrow-down" size={16} color={theme.text} />
                  <Text style={[styles.toolText, { color: theme.text }]}>Bajar</Text>
                </Pressable>
                <Pressable onPress={remove} accessibilityLabel="Eliminar objetivo" style={[styles.tool, { backgroundColor: theme.surface }]}>
                  <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  <Text style={[styles.toolText, { color: theme.danger }]}>Eliminar</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          <Pressable
            onPress={save}
            disabled={!valid}
            style={({ pressed }) => [styles.primary, { backgroundColor: habit.color, opacity: !valid ? 0.4 : pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.primaryText}>{isNew ? 'Añadir objetivo' : 'Guardar'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18, paddingHorizontal: 20, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 16 },
  input: {
    fontSize: 17, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tools: { flexDirection: 'row', gap: 8, marginTop: 20 },
  tool: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  toolText: { fontSize: 14, fontWeight: '700' },
  primary: { borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
