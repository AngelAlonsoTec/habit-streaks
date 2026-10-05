import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Habit } from '@/lib/habit';
import { confirmAction } from '@/lib/platform';
import { useHabits } from '@/store/habits';
import { IconName, useTheme } from '@/theme';

type Props = {
  habit: Habit | null;
  onClose: () => void;
};

/** Menú de acciones de un hábito (se abre manteniendo pulsada su tarjeta). */
export function HabitActionsSheet({ habit, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const deleteHabit = useHabits((s) => s.deleteHabit);

  if (!habit) return null;

  const actions: { label: string; icon: IconName; danger?: boolean; run: () => void | Promise<void> }[] = [
    { label: 'Editar', icon: 'create-outline', run: () => router.push({ pathname: '/habit/[id]/edit', params: { id: habit.id } }) },
    { label: 'Ver estadísticas', icon: 'stats-chart-outline', run: () => router.push({ pathname: '/habit/[id]', params: { id: habit.id } }) },
    {
      label: 'Eliminar',
      icon: 'trash-outline',
      danger: true,
      run: async () => {
        if (await confirmAction('Eliminar hábito', `Se borrará "${habit.name}" y todo su historial.`, 'Eliminar')) {
          deleteHabit(habit.id);
        }
      },
    },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar menú">
        <Pressable style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: habit.color }]}>
              <Ionicons name={habit.icon} size={20} color="#FFFFFF" />
            </View>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{habit.name}</Text>
          </View>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={async () => {
                onClose();
                await a.run();
              }}
              style={({ pressed }) => [styles.action, { backgroundColor: pressed ? theme.surface : 'transparent' }]}
            >
              <Ionicons name={a.icon} size={21} color={a.danger ? theme.danger : theme.text} />
              <Text style={[styles.actionText, { color: a.danger ? theme.danger : theme.text }]}>{a.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18, paddingHorizontal: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, marginBottom: 8 },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '800' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12 },
  actionText: { fontSize: 16, fontWeight: '600' },
});
