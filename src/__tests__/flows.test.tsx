import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';

import { makeHabit } from '@/testing/fixtures';
import { addDays, toKey, weekdayIndex } from '@/lib/dates';
import { Habit } from '@/lib/habit';
import { useHabits } from '@/store/habits';

const APP_DIR = path.resolve(__dirname, '../app');

beforeEach(() => {
  useHabits.setState({ habits: [], completions: {}, customCategories: [], settings: { showHeatmaps: true }, hasHydrated: true });
});

const next = () => fireEvent.press(screen.getByText('Siguiente'));

/** Prepara el estado antes de montar la app (no necesita act: aún no hay nada renderizado). */
function seed(...habits: Partial<Habit>[]) {
  useHabits.setState({ habits: habits.map((h, i) => makeHabit({ id: `h${i + 1}`, ...h })) });
}

describe('flujos de la app', () => {
  it('estado vacío → crear hábito', async () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(await screen.findByText('Crear hábito'));
    await waitFor(() => expect(screen).toHavePathname('/habit/new'));
  });

  it('crea un hábito desde una sugerencia con meta de varias veces', async () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(await screen.findByText('Crear hábito'));
    fireEvent.press(await screen.findByText('Beber agua'));
    expect(screen.getByDisplayValue('Beber agua')).toBeTruthy();
    next();
    expect(await screen.findByText('8')).toBeTruthy();
    next();
    next();
    fireEvent.press(screen.getAllByText('Crear hábito').at(-1)!);
    await waitFor(() => expect(screen).toHavePathname('/'));

    const [habit] = useHabits.getState().habits;
    expect(habit).toMatchObject({ name: 'Beber agua', goal: { period: 'day', count: 8 }, categories: ['salud', 'nutricion'] });
    expect(await screen.findByText('0/8 hoy')).toBeTruthy();

    // Cada toque suma una vez.
    fireEvent.press(screen.getByLabelText('Marcar Beber agua'));
    fireEvent.press(screen.getByLabelText('Marcar Beber agua'));
    expect(await screen.findByText('2/8 hoy')).toBeTruthy();
    // Mantener pulsado reinicia.
    fireEvent(screen.getByLabelText('Marcar Beber agua'), 'longPress');
    expect(await screen.findByText('0/8 hoy')).toBeTruthy();
  });

  it('configura meta, días, momento, recordatorios y categoría nueva', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.changeText(await screen.findByPlaceholderText('Nombre del hábito'), 'Guitarra');
    next();
    fireEvent.press(await screen.findByLabelText('Más veces'));
    fireEvent.press(screen.getByText('Entre semana'));
    next();
    fireEvent.press(await screen.findByText('Noche'));

    fireEvent.press(screen.getByText('Añadir hora'));
    fireEvent.press(await screen.findByText('Guardar hora')); // hora por defecto de "Noche": 21:00
    await waitFor(() => expect(screen.getByText('21:00')).toBeTruthy());
    fireEvent.press(screen.getByText('Otra hora'));
    fireEvent.press(await screen.findByLabelText('Hora 07'));
    fireEvent.press(screen.getByLabelText('Minuto 30'));
    fireEvent.press(screen.getByText('Guardar hora'));
    await waitFor(() => expect(screen.getByText('07:30')).toBeTruthy());
    next();

    fireEvent.press(await screen.findByText('Nueva'));
    fireEvent.changeText(screen.getByPlaceholderText('Nombre de la categoría'), 'Música en vivo');
    fireEvent(screen.getByPlaceholderText('Nombre de la categoría'), 'submitEditing');
    fireEvent.press(screen.getByText('Crear hábito'));
    await waitFor(() => expect(screen).toHavePathname('/'));

    const [habit] = useHabits.getState().habits;
    const [custom] = useHabits.getState().customCategories;
    expect(custom.name).toBe('Música en vivo');
    expect(habit).toMatchObject({
      name: 'Guitarra',
      goal: { period: 'day', count: 2 },
      days: [0, 1, 2, 3, 4],
      timeOfDay: 'evening',
      reminders: ['07:30', '21:00'],
      categories: [custom.id],
    });
  });

  it('meta semanal', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.changeText(await screen.findByPlaceholderText('Nombre del hábito'), 'Correr');
    next();
    fireEvent.press(await screen.findByText('Semanal'));
    expect(screen.getByText('veces por semana')).toBeTruthy();
    expect(screen.queryByText('Qué días')).toBeNull();
    next();
    next();
    fireEvent.press(screen.getByText('Crear hábito'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(useHabits.getState().habits[0].goal).toEqual({ period: 'week', count: 3 });
    expect(await screen.findByText('0/3 esta semana')).toBeTruthy();
  });

  it('no se puede avanzar sin nombre; los pasos visitados se pueden revisar', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.press(await screen.findByText('Siguiente'));
    expect(screen.getByText('¿Qué hábito quieres construir?')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Paso 3: Horario'));
    expect(screen.queryByText('¿Cuándo lo harás?')).toBeNull();

    fireEvent.changeText(screen.getByPlaceholderText('Nombre del hábito'), 'Leer');
    next();
    expect(await screen.findByText('¿Con qué frecuencia?')).toBeTruthy();
    fireEvent.press(screen.getByText('Atrás'));
    expect(await screen.findByDisplayValue('Leer')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Paso 2: Frecuencia'));
    expect(await screen.findByText('¿Con qué frecuencia?')).toBeTruthy();
  });

  it('mantener pulsada una tarjeta abre el menú para editar', async () => {
    seed({ name: 'Leer' });
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent(await screen.findByText('Leer'), 'longPress');
    fireEvent.press(await screen.findByText('Editar'));
    await waitFor(() => expect(screen).toHavePathname('/habit/h1/edit'));
    // Al editar, cualquier paso es accesible y se puede guardar desde él.
    fireEvent.press(await screen.findByLabelText('Paso 3: Horario'));
    fireEvent.press(await screen.findByText('Mañana'));
    fireEvent.press(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(useHabits.getState().habits[0].timeOfDay).toBe('morning');
  });

  it('el botón de vista compacta responde a toques seguidos', async () => {
    seed({ name: 'Leer' });
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(await screen.findByLabelText('Vista compacta'));
    expect(useHabits.getState().settings.showHeatmaps).toBe(false);
    fireEvent.press(screen.getByLabelText('Mostrar gráficas'));
    fireEvent.press(screen.getByLabelText('Vista compacta'));
    fireEvent.press(screen.getByLabelText('Mostrar gráficas'));
    expect(useHabits.getState().settings.showHeatmaps).toBe(true);
  });

  it('resumen: se abre desde el encabezado y cambia de periodo', async () => {
    const today = new Date();
    seed({ name: 'Leer', createdAt: new Date(today.getFullYear() - 1, 0, 1).toISOString() });
    // 30 días cumplidos este año y ninguno el anterior: el cumplimiento sube respecto al año anterior.
    for (let i = 1; i <= 30; i++) useHabits.getState().setCompletion('h1', toKey(addDays(today, -i)), 1);
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(await screen.findByLabelText('Resumen'));
    await waitFor(() => expect(screen).toHavePathname('/summary'));
    expect(await screen.findByText('Evolución')).toBeTruthy();
    expect(screen.getByText('Por hábito')).toBeTruthy();

    fireEvent.press(screen.getByText('Año'));
    expect(await screen.findByText(String(today.getFullYear()))).toBeTruthy();
    expect(screen.getByText('Constancia')).toBeTruthy();
    expect(screen.getByText(/respecto al año anterior/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Periodo anterior'));
    expect(await screen.findByText(String(today.getFullYear() - 1))).toBeTruthy();
  });

  it('el menú permite archivar', async () => {
    seed({ name: 'Leer' }, { name: 'Correr' });
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent(await screen.findByText('Correr'), 'longPress');
    fireEvent.press(await screen.findByText('Archivar'));
    expect(useHabits.getState().habits.find((h) => h.name === 'Correr')?.archived).toBe(true);
  });

  it('agrupa por momento del día, separa los días de descanso y filtra por categoría', async () => {
    const todayIdx = weekdayIndex(new Date());
    seed(
      { name: 'Meditar', timeOfDay: 'morning', categories: ['mente'] },
      { name: 'Leer', timeOfDay: 'evening', categories: ['lectura'] },
      { name: 'Descanso hoy', days: [(todayIdx + 1) % 7] },
    );
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Mañana')).toBeTruthy();
    expect(screen.getByText('Noche')).toBeTruthy();
    expect(screen.getByText('Descanso este día')).toBeTruthy();
    expect(screen.getByText('0 de 2 completados')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Mente'));
    await waitFor(() => expect(screen.queryByText('Leer')).toBeNull());
    expect(screen.getByText('Meditar')).toBeTruthy();
    expect(screen.getByText('0 de 1 completados')).toBeTruthy();
  });

  it('permite marcar un día pasado desde la tira semanal', async () => {
    seed({ name: 'Leer' });
    renderRouter(APP_DIR, { initialUrl: '/' });
    const yesterday = toKey(addDays(new Date(), -1));
    fireEvent.press(await screen.findByLabelText(`Ver ${yesterday}`));
    expect(await screen.findByText(/Volver a hoy/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Marcar Leer'));
    expect(useHabits.getState().completions.h1).toEqual({ [yesterday]: 1 });
  });

  it('detalle: estadísticas, calendario y archivar', async () => {
    seed({ name: 'Leer' });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    expect(await screen.findByText('Racha actual')).toBeTruthy();
    expect(screen.getByText('Último año')).toBeTruthy();
    expect(screen.getByText('Tus mejores días')).toBeTruthy();

    const today = toKey(new Date());
    fireEvent.press(screen.getByLabelText(today));
    expect(useHabits.getState().completions.h1?.[today]).toBe(1);
    expect(screen.getAllByText('1 día').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByText('Editar'));
    await waitFor(() => expect(screen).toHavePathname('/habit/h1/edit'));
    fireEvent.press(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(screen).toHavePathname('/habit/h1'));

    fireEvent.press(await screen.findByText('Archivar'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(useHabits.getState().habits[0].archived).toBe(true);
    expect(await screen.findByText('Empieza tu primer hábito')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Hábitos archivados'));
    fireEvent.press(await screen.findByLabelText('Restaurar Leer'));
    expect(useHabits.getState().habits[0].archived).toBe(false);
  });

  it('editar conserva el historial', async () => {
    seed({ name: 'Leer' });
    useHabits.getState().setCompletion('h1', '2026-01-01', 1);
    renderRouter(APP_DIR, { initialUrl: '/habit/h1/edit' });
    fireEvent.changeText(await screen.findByDisplayValue('Leer'), 'Leer 30 min');
    fireEvent.press(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(screen).toHavePathname('/habit/h1'));
    expect(useHabits.getState().habits[0].name).toBe('Leer 30 min');
    expect(useHabits.getState().completions.h1).toEqual({ '2026-01-01': 1 });
  });

  it('una URL de hábito inexistente no rompe la app', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/no-existe' });
    await waitFor(() => expect(screen).toHavePathname('/habit/no-existe'));
  });
});
