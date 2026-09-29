import { useLocalSearchParams } from 'expo-router';

import { HabitForm } from '@/components/HabitForm';
import { goBack } from '@/lib/platform';
import { useHabits } from '@/store/habits';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useHabits((s) => s.habits.find((h) => h.id === id));
  const updateHabit = useHabits((s) => s.updateHabit);

  if (!habit) return null;

  return (
    <HabitForm
      initial={habit}
      submitLabel="Guardar cambios"
      onSubmit={(input) => {
        updateHabit(habit.id, input);
        goBack({ pathname: '/habit/[id]', params: { id: habit.id } });
      }}
    />
  );
}
