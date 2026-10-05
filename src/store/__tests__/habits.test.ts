import AsyncStorage from '@react-native-async-storage/async-storage';

import { ALL_DAYS, HabitInput } from '@/lib/habit';
import { migrate, useHabits } from '../habits';

const input: HabitInput = {
  name: '  Leer  ',
  icon: 'book',
  color: '#3B82F6',
  categories: ['lectura'],
  timeOfDay: 'evening',
  goal: { period: 'day', count: 1 },
  unit: null,
  days: ALL_DAYS,
  reminders: ['21:00', '08:00', '21:00'],
};

const s = () => useHabits.getState();

beforeEach(() => {
  useHabits.setState({ habits: [], completions: {}, customCategories: [] });
});

describe('store de hábitos', () => {
  it('crea un hábito normalizado', () => {
    const id = s().addHabit(input);
    const [habit] = s().habits;
    expect(habit).toMatchObject({ id, name: 'Leer', reminders: ['08:00', '21:00'], archived: false });
  });

  it('limita la meta y nunca deja días vacíos', () => {
    s().addHabit({ ...input, goal: { period: 'day', count: 999 }, days: [] });
    expect(s().habits[0].goal.count).toBe(50);
    expect(s().habits[0].days).toEqual(ALL_DAYS);
  });

  it('meta de 1: tocar alterna hecho/no hecho', () => {
    const id = s().addHabit(input);
    s().cycleCompletion(id, '2026-09-25');
    expect(s().completions[id]).toEqual({ '2026-09-25': 1 });
    s().cycleCompletion(id, '2026-09-25');
    expect(s().completions[id]).toEqual({});
  });

  it('meta de 3: suma hasta la meta y luego vuelve a 0', () => {
    const id = s().addHabit({ ...input, goal: { period: 'day', count: 3 } });
    for (let i = 0; i < 3; i++) s().cycleCompletion(id, '2026-09-25');
    expect(s().completions[id]['2026-09-25']).toBe(3);
    s().cycleCompletion(id, '2026-09-25');
    expect(s().completions[id]['2026-09-25']).toBeUndefined();
  });

  it('meta semanal: cada toque alterna el día', () => {
    const id = s().addHabit({ ...input, goal: { period: 'week', count: 4 } });
    s().cycleCompletion(id, '2026-09-25');
    s().cycleCompletion(id, '2026-09-25');
    expect(s().completions[id]).toEqual({});
  });

  it('archiva y restaura', () => {
    const id = s().addHabit(input);
    s().setArchived(id, true);
    expect(s().habits[0].archived).toBe(true);
    s().setArchived(id, false);
    expect(s().habits[0].archived).toBe(false);
  });

  it('al borrar un hábito borra también su historial', () => {
    const a = s().addHabit(input);
    const b = s().addHabit(input);
    s().setCompletion(a, '2026-09-25', 1);
    s().setCompletion(b, '2026-09-25', 2);
    s().deleteHabit(a);
    expect(s().habits.map((h) => h.id)).toEqual([b]);
    expect(s().completions[a]).toBeUndefined();
    expect(s().completions[b]).toEqual({ '2026-09-25': 2 });
  });

  it('categorías personalizadas sin duplicados', () => {
    const a = s().addCategory('Guitarra');
    const b = s().addCategory('  guitarra ');
    expect(a).toBe(b);
    expect(s().customCategories).toHaveLength(1);
  });

  it('persiste en AsyncStorage (versión 3)', async () => {
    const id = s().addHabit(input);
    s().setCompletion(id, '2026-09-25', 1);
    const saved = JSON.parse((await AsyncStorage.getItem('myhabits-store'))!);
    expect(saved.version).toBe(3);
    expect(saved.state.completions[id]).toEqual({ '2026-09-25': 1 });
    expect(saved.state).not.toHaveProperty('hasHydrated');
  });
});

describe('migración desde la versión 1', () => {
  it('convierte hábitos y completados antiguos', () => {
    const v1 = {
      habits: [{ id: 'a', name: 'Leer', description: 'x', icon: 'book', color: '#3B82F6', createdAt: 'c', updatedAt: 'u' }],
      completions: { a: { '2026-09-24': true, '2026-09-25': true } },
    };
    const v2 = migrate(v1, 1);
    expect(v2.habits[0]).toEqual({
      id: 'a', name: 'Leer', icon: 'book', color: '#3B82F6', createdAt: 'c', updatedAt: 'u',
      categories: [], timeOfDay: 'anytime', goal: { period: 'day', count: 1 }, unit: null, days: ALL_DAYS, reminders: [], archived: false,
    });
    expect(v2.completions).toEqual({ a: { '2026-09-24': 1, '2026-09-25': 1 } });
    expect(v2.settings).toEqual({ showHeatmaps: true });
  });
});

describe('migración desde la versión 2', () => {
  it('los hábitos existentes pasan a contarse por veces', () => {
    const v2 = { habits: [{ id: 'a', name: 'Agua', goal: { period: 'day', count: 8 } }], completions: { a: { '2026-09-25': 3 } } };
    const v3 = migrate(v2, 2);
    expect(v3.habits[0]).toEqual({ id: 'a', name: 'Agua', goal: { period: 'day', count: 8 }, unit: null });
    expect(v3.completions).toEqual(v2.completions);
  });
});

describe('store · hábitos cuantitativos', () => {
  const run: HabitInput = { ...input, name: 'Correr', unit: ' km ', goal: { period: 'day', count: 5.255 } };

  it('guarda la unidad recortada y la meta con 2 decimales, sin el tope de 50 veces', () => {
    s().addHabit(run);
    expect(s().habits[0]).toMatchObject({ unit: 'km', goal: { period: 'day', count: 5.26 } });
    s().addHabit({ ...run, unit: 'pasos', goal: { period: 'day', count: 10000 } });
    expect(s().habits[1].goal.count).toBe(10000);
  });

  it('una unidad vacía vuelve a contar por veces', () => {
    s().addHabit({ ...run, unit: '   ', goal: { period: 'day', count: 2.5 } });
    expect(s().habits[0]).toMatchObject({ unit: null, goal: { period: 'day', count: 3 } });
  });

  it('suma y resta cantidades sin errores de coma flotante y nunca baja de 0', () => {
    const id = s().addHabit(run);
    s().addAmount(id, '2026-09-25', 0.1);
    s().addAmount(id, '2026-09-25', 0.2);
    expect(s().completions[id]['2026-09-25']).toBe(0.3);
    s().addAmount(id, '2026-09-25', -1);
    expect(s().completions[id]).toEqual({});
  });
});

describe('store · casos límite', () => {
  it('editar conserva la fecha de creación y actualiza updatedAt', async () => {
    const id = s().addHabit(input);
    const before = s().habits[0];
    await new Promise((r) => setTimeout(r, 5));
    s().updateHabit(id, { name: 'Leer más' });
    const after = s().habits[0];
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt > before.updatedAt).toBe(true);
    expect(after.name).toBe('Leer más');
  });

  it('editar también normaliza (nombre, horas duplicadas, meta mínima)', () => {
    const id = s().addHabit(input);
    s().updateHabit(id, { name: '  X  ', reminders: ['09:00', '09:00', '07:00'], goal: { period: 'day', count: 0 } });
    expect(s().habits[0]).toMatchObject({ name: 'X', reminders: ['07:00', '09:00'], goal: { period: 'day', count: 1 } });
  });

  it('marcar un hábito que no existe no hace nada', () => {
    s().cycleCompletion('no-existe', '2026-09-25');
    expect(s().completions).toEqual({});
  });

  it('poner 0 repeticiones borra el día en lugar de guardar un 0', () => {
    const id = s().addHabit(input);
    s().setCompletion(id, '2026-09-25', 3);
    s().setCompletion(id, '2026-09-25', 0);
    expect(s().completions[id]).toEqual({});
  });

  it('archivar o editar un hábito no toca a los demás', () => {
    const a = s().addHabit(input);
    const b = s().addHabit({ ...input, name: 'Correr' });
    s().setArchived(a, true);
    expect(s().habits.find((h) => h.id === b)?.archived).toBe(false);
  });

  it('ajustes: la vista compacta se guarda', () => {
    s().updateSettings({ showHeatmaps: false });
    expect(s().settings.showHeatmaps).toBe(false);
    s().updateSettings({ showHeatmaps: true });
    expect(s().settings.showHeatmaps).toBe(true);
  });

  it('el nombre de una categoría se guarda sin espacios sobrantes', () => {
    const id = s().addCategory('  Yoga  ');
    expect(s().customCategories.find((c) => c.id === id)?.name).toBe('Yoga');
  });
});

describe('migración · otros casos', () => {
  it('datos ya en versión 2 se dejan igual', () => {
    const v2 = { habits: [], completions: { a: { '2026-09-25': 3 } }, customCategories: [], settings: { showHeatmaps: false } };
    expect(migrate(v2, 2)).toEqual(v2);
  });

  it('una versión 1 vacía no falla', () => {
    expect(migrate({}, 1)).toEqual({ habits: [], completions: {}, customCategories: [], settings: { showHeatmaps: true } });
  });

  it('un hábito v1 con campos nuevos ya presentes los respeta', () => {
    const v1 = { habits: [{ id: 'a', name: 'Leer', icon: 'book', color: '#fff', createdAt: 'c', updatedAt: 'u', archived: true }], completions: {} };
    expect(migrate(v1, 1).habits[0].archived).toBe(true);
  });
});
