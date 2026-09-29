import { HabitForm } from '@/components/HabitForm';
import { goBack } from '@/lib/platform';
import { useHabits } from '@/store/habits';

export default function NewHabitScreen() {
  const addHabit = useHabits((s) => s.addHabit);

  return (
    <HabitForm
      submitLabel="Crear hábito"
      onSubmit={(input) => {
        addHabit(input);
        goBack();
      }}
    />
  );
}
