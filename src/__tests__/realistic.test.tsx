/**
 * Casos realistas y poco comunes: lo que pasa de verdad con el móvil en la mano
 * (medianoche con la app abierta, cambios de hora, datos antiguos, cantidades escritas a mano…).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';

import { buildMonths } from '@/components/Heatmap';
import { fromKey, toKey } from '@/lib/dates';
import { describeProgress, Habit, isDoneFor, parseAmount } from '@/lib/habit';
import { planReminders } from '@/lib/reminders';
import { computeStats } from '@/lib/stats';
import { summarize } from '@/lib/summary';
import { useHabits } from '@/store/habits';
import { makeHabit } from '@/testing/fixtures';

const APP_DIR = path.resolve(__dirname, '../app');
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const iso = (y: number, m: number, d: number) => at(y, m, d, 9).toISOString();

function seed(...habits: Partial<Habit>[]) {
  useHabits.setState({ habits: habits.map((h, i) => makeHabit({ id: `h${i + 1}`, ...h })) });
}

beforeEach(() => {
  useHabits.setState({ habits: [], completions: {}, customCategories: [], settings: { showHeatmaps: true }, hasHydrated: true });
});
afterEach(() => jest.useRealTimers());

describe('con el móvil en la mano', () => {
  it('la app abierta pasa la medianoche: lo que marcas va al día nuevo, no al anterior', async () => {
    jest.useFakeTimers({ now: at(2026, 10, 4, 23, 58), advanceTimers: true });
    seed({ name: 'Leer', createdAt: iso(2026, 9, 1) });
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Domingo, 4 de octubre')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000); // 00:03 del lunes
    });
    expect(await screen.findByText('Lunes, 5 de octubre')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Marcar Leer'));
    expect(useHabits.getState().completions.h1).toEqual({ '2026-10-05': 1 });
    expect(screen.queryByText(/Volver a hoy/)).toBeNull();
  });

  it('si estabas viendo un día pasado, la medianoche no te cambia de día', async () => {
    jest.useFakeTimers({ now: at(2026, 10, 4, 23, 58), advanceTimers: true });
    seed({ name: 'Leer', createdAt: iso(2026, 9, 1) });
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(await screen.findByLabelText('Ver 2026-10-02'));
    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
    fireEvent.press(screen.getByLabelText('Marcar Leer'));
    expect(useHabits.getState().completions.h1).toEqual({ '2026-10-02': 1 });
  });

  it('empieza a dejar de fumar hoy y anota que fumó por última vez hace 3 días', async () => {
    jest.useFakeTimers({ now: at(2026, 10, 5, 12), advanceTimers: true });
    seed({ name: 'Fumar', kind: 'quit', goal: { period: 'day', count: 0 }, createdAt: at(2026, 10, 5, 10).toISOString() });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    fireEvent.press(await screen.findByLabelText('2026-10-02'));
    fireEvent.press(await screen.findByText('Registrar recaída'));
    fireEvent.press(screen.getAllByLabelText('Cerrar').at(-1)!);
    // Limpio el 3, el 4 y hoy: 3 días; la recaída cuenta como 1 día con recaída.
    await waitFor(() => expect(screen.getAllByText('3 días').length).toBeGreaterThan(0));
    const stats = computeStats(useHabits.getState().habits[0], useHabits.getState().completions.h1, at(2026, 10, 5));
    expect(stats).toMatchObject({ currentStreak: 3, overLimit: 1 });
  });

  it('café: llega justo al límite, se pasa y luego corrige el error', () => {
    const id = useHabits.getState().addHabit({
      name: 'Café', icon: 'cafe', color: '#F59E0B', categories: [], timeOfDay: 'anytime',
      kind: 'quit', goal: { period: 'day', count: 2 }, unit: null, days: [0, 1, 2, 3, 4, 5, 6], reminders: [],
    });
    const now = new Date();
    const today = toKey(now);
    const s = () => useHabits.getState();
    const streak = () => computeStats(s().habits[0], s().completions[id], now).currentStreak;

    s().addAmount(id, today, 1);
    s().addAmount(id, today, 1);
    expect(isDoneFor(s().habits[0], s().completions[id], now)).toBe(true); // 2 de 2: aún dentro
    expect(streak()).toBe(1);
    s().addAmount(id, today, 1); // se pasa
    expect(isDoneFor(s().habits[0], s().completions[id], now)).toBe(false);
    expect(streak()).toBe(0);
    s().addAmount(id, today, -1); // era un error: lo corrige
    expect(streak()).toBe(1);
    expect(describeProgress(s().habits[0], 2, 2)).toBe('2 / máx. 2');
  });

  it('correr: hace los 15 km de la semana en una sola salida el domingo', () => {
    const run = makeHabit({ unit: 'km', goal: { period: 'week', count: 15 }, reminders: ['19:00'], createdAt: iso(2026, 9, 1) });
    const days = { '2026-09-23': 8, '2026-09-26': 8.5, '2026-10-04': 15 };
    const monday = at(2026, 10, 5, 8);
    // Semana del 21/9 (16,5 km) y la del 28/9 (15 km en un día): 2 semanas; la actual aún no rompe.
    expect(computeStats(run, days, monday)).toMatchObject({ currentStreak: 2, streakUnit: 'week' });
    expect(isDoneFor(run, days, monday)).toBe(false);
    expect(planReminders([run], { h1: days }, monday)[0].body).toBe('Esta semana llevas 0 de 15 km.');
  });

  it('crea un hábito semanal un jueves: esa primera semana corta no le rompe la racha', () => {
    const gym = makeHabit({ goal: { period: 'week', count: 3 }, createdAt: iso(2026, 10, 1) }); // jueves
    const days = { '2026-10-02': 1, '2026-10-03': 1 }; // solo 2 de 3 en esa semana
    const stats = computeStats(gym, days, at(2026, 10, 5));
    expect(stats.currentStreak).toBe(0);
    expect(stats.rate30).toBe(0); // la semana corta no cuenta como fallo: aún no hay semanas que evaluar
    const week = summarize([gym], { h1: days }, 'month', -1, at(2026, 10, 5)); // septiembre
    expect(week.habits[0].scheduled).toBe(0);
    // Si esa semana corta sí llega a la meta, cuenta a favor.
    const full = computeStats(gym, { ...days, '2026-10-04': 1 }, at(2026, 10, 5));
    expect(full.currentStreak).toBe(1);
  });
});

describe('cantidades escritas a mano', () => {
  it('acepta lo que la gente escribe de verdad', () => {
    expect(parseAmount('+5')).toBe(5);
    expect(parseAmount('2,5 km')).toBe(2.5);
    expect(parseAmount('30min')).toBe(30);
    expect(parseAmount('1.234,5')).toBe(1234.5);
    expect(parseAmount('2,50')).toBe(2.5);
  });

  it('rechaza lo que no tiene sentido', () => {
    for (const bad of ['0,001', '-3', '1e5', 'km', '5,5,5', '9999999']) expect(parseAmount(bad)).toBeNull();
  });

  it('restar más de lo registrado deja el día vacío y sumar de más se queda en el máximo', () => {
    const id = useHabits.getState().addHabit({
      name: 'Pasos', icon: 'walk', color: '#39D353', categories: [], timeOfDay: 'anytime',
      kind: 'build', goal: { period: 'day', count: 10000 }, unit: 'pasos', days: [0, 1, 2, 3, 4, 5, 6], reminders: [],
    });
    const s = () => useHabits.getState();
    s().addAmount(id, '2026-10-05', 3500);
    s().addAmount(id, '2026-10-05', -5000);
    expect(s().completions[id]).toEqual({});
    s().addAmount(id, '2026-10-05', 900_000);
    s().addAmount(id, '2026-10-05', 900_000);
    expect(s().completions[id]['2026-10-05']).toBe(1_000_000);
  });

  it('al dejar un hábito por cantidad se puede escribir 0 como límite', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.press(await screen.findByText('Dejar hábito'));
    fireEvent.changeText(screen.getByPlaceholderText('Nombre del hábito'), 'Videojuegos');
    fireEvent.press(screen.getByText('Siguiente'));
    fireEvent.press(await screen.findByText('Cantidad'));
    fireEvent.changeText(screen.getByLabelText('Meta'), '0');
    fireEvent(screen.getByLabelText('Meta'), 'blur');
    expect(screen.getByDisplayValue('0')).toBeTruthy();
    fireEvent.press(screen.getByText('Siguiente'));
    fireEvent.press(screen.getByText('Siguiente'));
    fireEvent.press(screen.getByText('Crear hábito'));
    await waitFor(() => expect(useHabits.getState().habits).toHaveLength(1));
    expect(useHabits.getState().habits[0]).toMatchObject({ kind: 'quit', unit: 'min', goal: { period: 'day', count: 0 } });
  });
});

describe('calendario y reloj', () => {
  it('racha que cruza el cambio de horario de verano (Madrid 25/10, Los Ángeles 1/11)', () => {
    const quit = makeHabit({ kind: 'quit', goal: { period: 'day', count: 0 }, createdAt: iso(2026, 10, 20) });
    expect(computeStats(quit, {}, at(2026, 11, 3)).currentStreak).toBe(15); // del 20/10 al 3/11
    const read = makeHabit({ unit: 'min', goal: { period: 'day', count: 20 }, createdAt: iso(2026, 10, 1) });
    const days = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [toKey(at(2026, 10, 24 + i)), 25]));
    expect(computeStats(read, days, at(2026, 11, 4)).currentStreak).toBe(12);
    const blocks = buildMonths('2026-10-01', '2026-11-03');
    expect(blocks[0].columns.flat().filter(Boolean)).toHaveLength(31);
  });

  it('racha que cruza el fin de año y el heatmap marca el año nuevo', () => {
    const quit = makeHabit({ kind: 'quit', goal: { period: 'day', count: 0 }, createdAt: iso(2026, 12, 20) });
    expect(computeStats(quit, {}, at(2027, 1, 3)).currentStreak).toBe(15);
    expect(buildMonths('2026-12-01', '2027-01-03').map((b) => b.label)).toEqual(['Dic', 'Ene 27']);
  });

  it('reloj adelantado: un registro con fecha futura no estropea la racha de hoy', () => {
    const quit = makeHabit({ kind: 'quit', goal: { period: 'day', count: 0 }, createdAt: iso(2026, 9, 1) });
    const days = { '2026-10-10': 1 }; // anotado cuando el móvil marcaba otra fecha
    expect(computeStats(quit, days, at(2026, 10, 5)).currentStreak).toBe(35);
    expect(summarize([quit], { h1: days }, 'week', 0, at(2026, 10, 5)).habits[0]).toMatchObject({ scheduled: 1, done: 1 });
  });
});

describe('datos y rendimiento', () => {
  it('alguien con datos de la primera versión abre la app nueva', async () => {
    await AsyncStorage.setItem('myhabits-store', JSON.stringify({
      version: 1,
      state: {
        habits: [{ id: 'old', name: 'Leer', description: 'antes', icon: 'book', color: '#3B82F6', createdAt: iso(2026, 9, 1), updatedAt: iso(2026, 9, 1) }],
        completions: { old: { '2026-10-03': true, '2026-10-04': true } },
      },
    }));
    await useHabits.persist.rehydrate();
    const [habit] = useHabits.getState().habits;
    expect(habit).toMatchObject({ kind: 'build', unit: null, goal: { period: 'day', count: 1 }, archived: false });
    expect(computeStats(habit, useHabits.getState().completions.old, at(2026, 10, 5))).toMatchObject({ currentStreak: 2 });
    useHabits.getState().setCompletion('old', '2026-10-05', 1);
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('myhabits-store'))!).version).toBe(4));
  });

  it('cambiar un hábito de veces a cantidad al editarlo conserva el historial', () => {
    const id = useHabits.getState().addHabit({
      name: 'Agua', icon: 'water', color: '#3B82F6', categories: [], timeOfDay: 'anytime',
      kind: 'build', goal: { period: 'day', count: 8 }, unit: null, days: [0, 1, 2, 3, 4, 5, 6], reminders: [],
    });
    useHabits.getState().setCompletion(id, '2026-10-04', 6);
    useHabits.getState().updateHabit(id, { unit: 'vasos', goal: { period: 'day', count: 8 } });
    const habit = useHabits.getState().habits[0];
    expect(useHabits.getState().completions[id]).toEqual({ '2026-10-04': 6 });
    expect(describeProgress(habit, 6, 8)).toBe('6 / 8 vasos');
  });

  it('40 hábitos con dos años de historial: estadísticas y resumen anual siguen siendo rápidos', () => {
    const habits = Array.from({ length: 40 }, (_, i) =>
      makeHabit({
        id: `h${i}`,
        kind: i % 4 === 0 ? 'quit' : 'build',
        unit: i % 3 === 0 ? 'min' : null,
        goal: { period: i % 5 === 0 ? 'week' : 'day', count: i % 4 === 0 ? 2 : 3 },
        createdAt: iso(2024, 10, 1),
      }),
    );
    const completions = Object.fromEntries(habits.map((h, i) => [
      h.id,
      Object.fromEntries(Array.from({ length: 730 }, (_, d) => [toKey(at(2024, 10, 6 + d)), (d * 7 + i) % 5])),
    ]));
    const start = Date.now();
    for (const h of habits) computeStats(h, completions[h.id], at(2026, 10, 5));
    summarize(habits, completions, 'year', 0, at(2026, 10, 5));
    expect(Date.now() - start).toBeLessThan(3000);
    expect(fromKey('2026-10-05').getDay()).toBe(1);
  });
});
