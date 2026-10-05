/**
 * Casos realistas y poco comunes: lo que pasa de verdad con el móvil en la mano
 * (medianoche con la app abierta, cambios de hora, datos antiguos, cantidades escritas a mano…).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';

import { datePresets } from '@/components/DatePicker';
import { buildMonths } from '@/components/Heatmap';
import { fromKey, toKey } from '@/lib/dates';
import { describeProgress, Habit, isDoneFor, parseAmount } from '@/lib/habit';
import { describeDue, Objective, suggestObjectives } from '@/lib/objectives';
import { planReminders } from '@/lib/reminders';
import { computeStats } from '@/lib/stats';
import { summarize } from '@/lib/summary';
import { useHabits } from '@/store/habits';
import { makeHabit } from '@/testing/fixtures';

const APP_DIR = path.resolve(__dirname, '../app');
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const iso = (y: number, m: number, d: number) => at(y, m, d, 9).toISOString();
const objective = (title: string, o: Partial<Objective> = {}): Objective => ({
  id: title, title, dueDate: null, achievedOn: null, createdAt: iso(2026, 9, 1), ...o,
});

function seed(...habits: Partial<Habit>[]) {
  useHabits.setState({ habits: habits.map((h, i) => makeHabit({ id: `h${i + 1}`, ...h })) });
}

beforeEach(() => {
  useHabits.setState({ habits: [], completions: {}, customCategories: [], settings: { showHeatmaps: true, compactTipSeen: true }, hasHydrated: true });
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
    expect(habit).toMatchObject({ kind: 'build', unit: null, goal: { period: 'day', count: 1 }, objectives: [] });
    expect(computeStats(habit, useHabits.getState().completions.old, at(2026, 10, 5))).toMatchObject({ currentStreak: 2 });
    useHabits.getState().setCompletion('old', '2026-10-05', 1);
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('myhabits-store'))!).version).toBe(7));
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

describe('objetivos en la vida real', () => {
  it('un objetivo que vence hoy pasa a vencido al cruzar la medianoche con la app abierta', async () => {
    jest.useFakeTimers({ now: at(2026, 10, 4, 23, 58), advanceTimers: true });
    seed({ name: 'Inglés', objectives: [objective('Examen A2', { dueDate: '2026-10-04' })] });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    expect(await screen.findByText('Vence hoy')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(await screen.findByText('Plazo vencido hace 1 día')).toBeTruthy();
  });

  it('marcarlo logrado a las 23:59 lo guarda en ese día, no en el siguiente', async () => {
    jest.useFakeTimers({ now: at(2026, 10, 4, 23, 59), advanceTimers: true });
    seed({ name: 'Inglés', objectives: [objective('Alcanzar el A1')] });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    fireEvent.press(await screen.findByLabelText('Marcar logrado: Alcanzar el A1'));
    expect(useHabits.getState().habits[0].objectives[0].achievedOn).toBe('2026-10-04');
  });

  it('lo marca por error y lo desmarca: no queda rastro en el resumen', () => {
    seed({ name: 'Inglés', objectives: [objective('Alcanzar el A1')] });
    const s = () => useHabits.getState();
    s().setObjectiveAchieved('h1', 'Alcanzar el A1', '2026-10-05');
    expect(summarize(s().habits, {}, 'week', 0, at(2026, 10, 5)).objectivesAchieved).toHaveLength(1);
    s().setObjectiveAchieved('h1', 'Alcanzar el A1', null);
    expect(summarize(s().habits, {}, 'week', 0, at(2026, 10, 5)).objectivesAchieved).toHaveLength(0);
  });

  it('cerrar el panel sin guardar o con el título vacío no crea nada', async () => {
    seed({ name: 'Inglés' });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    fireEvent.press(await screen.findByLabelText('Añadir objetivo'));
    fireEvent.changeText(await screen.findByLabelText('Objetivo'), 'Alcanzar el B2');
    fireEvent.press(screen.getAllByLabelText('Cerrar')[0]); // toca fuera del panel
    fireEvent.press(await screen.findByLabelText('Añadir objetivo'));
    fireEvent.changeText(await screen.findByLabelText('Objetivo'), '    ');
    fireEvent(screen.getByLabelText('Objetivo'), 'submitEditing');
    fireEvent.press(screen.getByText('Añadir objetivo'));
    expect(useHabits.getState().habits[0].objectives).toEqual([]);
  });

  it('elige una sugerencia y la retoca antes de guardar', async () => {
    seed({ name: 'Aprender inglés' });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    fireEvent.press(await screen.findByLabelText('Añadir objetivo'));
    fireEvent.press(await screen.findByText('Alcanzar el B1'));
    fireEvent.changeText(screen.getByLabelText('Objetivo'), 'Alcanzar el B1 y aprobar el examen oficial');
    fireEvent.press(screen.getByText('Añadir objetivo'));
    await waitFor(() =>
      expect(useHabits.getState().habits[0].objectives[0].title).toBe('Alcanzar el B1 y aprobar el examen oficial'),
    );
  });

  it('editar solo el título de un objetivo vencido no le cambia la fecha', async () => {
    jest.useFakeTimers({ now: at(2026, 10, 5, 12), advanceTimers: true });
    seed({ name: 'Inglés', objectives: [objective('A2', { dueDate: '2026-09-01' })] });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    expect(await screen.findByText('Plazo vencido hace 34 días')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Editar objetivo A2'));
    fireEvent.changeText(await screen.findByLabelText('Objetivo'), 'Alcanzar el A2');
    fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(useHabits.getState().habits[0].objectives[0]).toMatchObject({ title: 'Alcanzar el A2', dueDate: '2026-09-01' }));
  });

  it('en Hoy, un próximo objetivo vencido se avisa en la tarjeta', async () => {
    jest.useFakeTimers({ now: at(2026, 10, 5, 12), advanceTimers: true });
    seed({ name: 'Inglés', createdAt: iso(2026, 9, 1), objectives: [objective('Alcanzar el A1', { dueDate: '2026-09-30' })] });
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText(/plazo vencido/)).toBeTruthy();
  });

  it('editar el hábito desde el asistente conserva sus objetivos', async () => {
    seed({ name: 'Inglés', objectives: [objective('A1', { achievedOn: '2026-09-20' }), objective('A2')] });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1/edit' });
    fireEvent.changeText(await screen.findByDisplayValue('Inglés'), 'Inglés para el trabajo');
    fireEvent.press(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(useHabits.getState().habits[0].name).toBe('Inglés para el trabajo'));
    expect(useHabits.getState().habits[0].objectives.map((o) => [o.title, o.achievedOn])).toEqual([['A1', '2026-09-20'], ['A2', null]]);
  });

  it('borrar el hábito se lleva sus objetivos y no toca a los demás', () => {
    seed({ name: 'Inglés', objectives: [objective('A1'), objective('A2')] }, { name: 'Correr' });
    const s = () => useHabits.getState();
    s().deleteHabit('h1');
    expect(s().habits.map((h) => h.name)).toEqual(['Correr']);
  });

  it('20 objetivos: el último no se puede bajar y el primero no se puede subir', async () => {
    const many = Array.from({ length: 20 }, (_, i) => objective(`Hito ${i + 1}`));
    seed({ name: 'Proyecto', objectives: many });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    expect(await screen.findByText('0 de 20 logrados')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Editar objetivo Hito 20'));
    fireEvent.press(await screen.findByText('Bajar'));
    fireEvent.press(screen.getAllByLabelText('Cerrar').at(-1)!);
    fireEvent.press(screen.getByLabelText('Editar objetivo Hito 1'));
    fireEvent.press(await screen.findByText('Subir'));
    const titles = useHabits.getState().habits[0].objectives.map((o) => o.title);
    expect(titles[0]).toBe('Hito 1');
    expect(titles[19]).toBe('Hito 20');
  });

  it('títulos raros: muy largos se recortan y con emojis o mayúsculas funcionan', () => {
    const id = useHabits.getState().addHabit({
      name: 'Inglés', icon: 'language', color: '#6366F1', categories: [], timeOfDay: 'anytime',
      kind: 'build', goal: { period: 'day', count: 1 }, unit: null, days: [0, 1, 2, 3, 4, 5, 6], reminders: [],
    });
    useHabits.getState().addObjective(id, { title: 'x'.repeat(120), dueDate: null });
    useHabits.getState().addObjective(id, { title: '🇬🇧 ALCANZAR EL A1', dueDate: null });
    const [long, emoji] = useHabits.getState().habits[0].objectives;
    expect(long.title).toHaveLength(80);
    expect(emoji.title).toBe('🇬🇧 ALCANZAR EL A1');
    // Ya tiene uno igual (en mayúsculas): la sugerencia del A1 no se repite.
    const withUpper = makeHabit({ name: 'Inglés', objectives: [objective('ALCANZAR EL A1')] });
    expect(suggestObjectives(withUpper)[0]).toBe('Alcanzar el A2');
  });

  it('atajos de fecha en días raros: 29 de febrero y 31 de diciembre', () => {
    const leap = Object.fromEntries(datePresets('2028-02-29').map((p) => [p.label, p.key]));
    expect(leap['En 1 año']).toBe('2029-02-28');
    expect(leap['En 1 mes']).toBe('2028-03-29');
    const newYearsEve = Object.fromEntries(datePresets('2026-12-31').map((p) => [p.label, p.key]));
    expect(newYearsEve['Fin de año']).toBe('2026-12-31');
    expect(describeDue(newYearsEve['Fin de año'], '2026-12-31').text).toBe('Vence hoy');
    expect(newYearsEve['En 1 mes']).toBe('2027-01-31');
  });

  it('el resumen de cada mes solo cuenta lo logrado en ese mes', () => {
    const habit = makeHabit({
      name: 'Inglés',
      objectives: [objective('A1', { achievedOn: '2026-09-20' }), objective('A2', { achievedOn: '2026-10-02' })],
    });
    expect(summarize([habit], {}, 'month', 0, at(2026, 10, 5)).objectivesAchieved.map((o) => o.title)).toEqual(['A2']);
    expect(summarize([habit], {}, 'month', -1, at(2026, 10, 5)).objectivesAchieved.map((o) => o.title)).toEqual(['A1']);
    expect(summarize([habit], {}, 'year', 0, at(2026, 10, 5)).objectivesAchieved).toHaveLength(2);
  });

  it('alguien que venía de la versión 4 entra al detalle y ve la tarjeta vacía', async () => {
    await AsyncStorage.setItem('myhabits-store', JSON.stringify({
      version: 4,
      state: {
        habits: [{ ...makeHabit({ id: 'v4', name: 'Leer' }), objectives: undefined }],
        completions: {}, customCategories: [], settings: { showHeatmaps: true },
      },
    }));
    await useHabits.persist.rehydrate();
    expect(useHabits.getState().habits[0].objectives).toEqual([]);
    renderRouter(APP_DIR, { initialUrl: '/habit/v4' });
    expect(await screen.findByText(/márcate hitos/)).toBeTruthy();
  });

  it('quien tenía hábitos archivados actualiza: vuelven a Hoy con todo su historial', async () => {
    await AsyncStorage.setItem('myhabits-store', JSON.stringify({
      version: 6,
      state: {
        habits: [
          { ...makeHabit({ id: 'old', name: 'Piano' }), archived: true, archivedAt: '2026-08-20' },
          { ...makeHabit({ id: 'cur', name: 'Leer' }), archived: false, archivedAt: null },
        ],
        completions: { old: { '2026-08-19': 1, '2026-08-20': 1 } },
        customCategories: [],
        settings: { showHeatmaps: true, compactTipSeen: true },
      },
    }));
    await useHabits.persist.rehydrate();
    const habits = useHabits.getState().habits;
    expect(habits.map((h) => h.name)).toEqual(['Piano', 'Leer']);
    expect(habits.every((h) => !('archived' in h) && !('archivedAt' in h))).toBe(true);
    expect(useHabits.getState().completions.old).toEqual({ '2026-08-19': 1, '2026-08-20': 1 });
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Piano')).toBeTruthy();
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('myhabits-store'))!).version).toBe(7));
  });
});

describe('textos de la interfaz', () => {
  it('al ver un día pasado el título es la fecha y "Volver a hoy" regresa', async () => {
    jest.useFakeTimers({ now: at(2026, 10, 5, 12), advanceTimers: true });
    seed({ name: 'Leer', createdAt: iso(2026, 9, 1) });
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Hoy')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ver 2026-10-04'));
    expect(await screen.findByText('Ayer')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ver 2026-09-30'));
    expect(await screen.findByText('Miércoles 30')).toBeTruthy();
    expect(screen.queryByText('Registro')).toBeNull();
    fireEvent.press(screen.getByText('Volver a hoy'));
    expect(await screen.findByText('Hoy')).toBeTruthy();
    expect(screen.queryByText('Volver a hoy')).toBeNull();
  });

  it('resumen de un lunes por la mañana: pendiente, no "no tocaba"', async () => {
    jest.useFakeTimers({ now: at(2026, 10, 5, 9), advanceTimers: true });
    seed(
      { name: 'Leer', createdAt: iso(2026, 9, 1) },
      { name: 'Paseo largo', days: [5, 6], createdAt: iso(2026, 9, 1) }, // solo fines de semana
      { name: 'Gimnasio', goal: { period: 'week', count: 3 }, createdAt: iso(2026, 9, 1) },
    );
    renderRouter(APP_DIR, { initialUrl: '/summary' });
    expect(await screen.findByText('Pendiente hoy')).toBeTruthy();
    expect(screen.getByText('Semana en curso')).toBeTruthy();
    expect(screen.getByText('No tocaba en este periodo')).toBeTruthy();
    expect(screen.getByText('Aún no hay días cerrados: lo de hoy cuenta en cuanto lo hagas.')).toBeTruthy();
  });

  it('el resumen da totales legibles y la parte de las semanas con coma', async () => {
    jest.useFakeTimers({ now: at(2026, 10, 5, 9), advanceTimers: true });
    seed(
      { name: 'Inglés', unit: 'min', goal: { period: 'day', count: 30 }, createdAt: iso(2026, 9, 1) },
      { name: 'Correr', unit: 'km', goal: { period: 'week', count: 10 }, createdAt: iso(2026, 8, 1) },
    );
    useHabits.setState({
      completions: {
        h1: { '2026-09-28': 600, '2026-09-29': 675 },
        h2: { '2026-09-07': 10, '2026-09-14': 5 },
      },
    });
    renderRouter(APP_DIR, { initialUrl: '/summary' });
    fireEvent.press(await screen.findByText('Mes'));
    fireEvent.press(screen.getByLabelText('Periodo anterior'));
    expect(await screen.findByText(/· 21 h 15 min$/)).toBeTruthy();
    expect(screen.getByText(/^1,5 de 4 semanas/)).toBeTruthy();
  });

  it('el detalle muestra el total en horas', async () => {
    seed({ name: 'Inglés', unit: 'min', goal: { period: 'day', count: 30 } });
    useHabits.setState({ completions: { h1: { '2026-09-28': 600, '2026-09-29': 675 } } });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    expect(await screen.findByText('21 h 15 min')).toBeTruthy();
  });
});
