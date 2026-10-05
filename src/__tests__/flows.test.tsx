import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';

import { makeHabit } from '@/testing/fixtures';
import { addDays, toKey, weekdayIndex } from '@/lib/dates';
import { Habit } from '@/lib/habit';
import { Alert, AlertButton } from 'react-native';

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

  it('crea un hábito cuantitativo y registra cantidades con el panel', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.changeText(await screen.findByPlaceholderText('Nombre del hábito'), 'Correr');
    next();
    fireEvent.press(await screen.findByText('Cantidad'));
    fireEvent.press(screen.getByText('km'));
    fireEvent.changeText(screen.getByLabelText('Meta'), '7,5');
    fireEvent(screen.getByLabelText('Meta'), 'blur');
    next();
    next();
    fireEvent.press(screen.getByText('Crear hábito'));
    await waitFor(() => expect(screen).toHavePathname('/'));

    const [habit] = useHabits.getState().habits;
    expect(habit).toMatchObject({ unit: 'km', goal: { period: 'day', count: 7.5 } });
    expect(await screen.findByText('0 / 7,5 km hoy')).toBeTruthy();

    const today = toKey(new Date());
    fireEvent.press(screen.getByLabelText('Registrar Correr'));
    fireEvent.press(await screen.findByLabelText('Sumar 2 km'));
    fireEvent.changeText(screen.getByLabelText('Cantidad'), '1,5');
    fireEvent.press(screen.getByText('Sumar'));
    await waitFor(() => expect(useHabits.getState().completions[habit.id]).toEqual({ [today]: 3.5 }));
    fireEvent.changeText(screen.getByLabelText('Cantidad'), '0,5');
    fireEvent.press(screen.getByText('Restar'));
    await waitFor(() => expect(useHabits.getState().completions[habit.id]).toEqual({ [today]: 3 }));

    fireEvent.press(screen.getAllByLabelText('Cerrar').at(-1)!);
    expect(await screen.findByText('3 / 7,5 km hoy')).toBeTruthy();
  });

  it('crea un hábito para dejar desde una sugerencia y registra una recaída', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.press(await screen.findByText('Dejar hábito'));
    expect(screen.getByText('¿Qué hábito quieres dejar?')).toBeTruthy();
    fireEvent.press(screen.getByText('Dejar de fumar'));
    next();
    expect(await screen.findByText('¿Cuál es tu límite?')).toBeTruthy();
    expect(screen.getByText('Ninguna: dejarlo del todo')).toBeTruthy();
    next();
    expect(screen.queryByText('Momento del día')).toBeNull();
    next();
    fireEvent.press(screen.getByText('Crear hábito'));
    await waitFor(() => expect(screen).toHavePathname('/'));

    const [habit] = useHabits.getState().habits;
    expect(habit).toMatchObject({ name: 'Dejar de fumar', kind: 'quit', goal: { period: 'day', count: 0 }, unit: null });
    expect(await screen.findByText('Sin recaídas hoy')).toBeTruthy();
    expect(screen.getByText('Dejar')).toBeTruthy();
    expect(screen.getByText('1 de 1 dentro del límite')).toBeTruthy();
    expect(screen.getByText('Sin hábitos por hacer este día')).toBeTruthy();

    // Tocar no registra nada directamente: abre el panel.
    fireEvent.press(screen.getByLabelText('Registrar Dejar de fumar'));
    fireEvent.press(await screen.findByText('Registrar recaída'));
    await waitFor(() => expect(Object.values(useHabits.getState().completions[habit.id])).toEqual([1]));
    fireEvent.press(screen.getAllByLabelText('Cerrar').at(-1)!);
    expect(await screen.findByText('1 recaída hoy')).toBeTruthy();
    expect(screen.getByText('0 de 1 dentro del límite')).toBeTruthy();
  });

  it('hábito para dejar con límite: se ajusta en el asistente', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.press(await screen.findByText('Dejar hábito'));
    fireEvent.changeText(screen.getByPlaceholderText('Nombre del hábito'), 'Café');
    next();
    fireEvent.press(await screen.findByLabelText('Más veces'));
    fireEvent.press(screen.getByLabelText('Más veces'));
    expect(screen.getByText('veces al día como máximo')).toBeTruthy();
    next();
    next();
    fireEvent.press(screen.getByText('Crear hábito'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(useHabits.getState().habits[0]).toMatchObject({ kind: 'quit', goal: { period: 'day', count: 2 } });
    expect(await screen.findByText('0 / máx. 2 hoy')).toBeTruthy();
  });

  it('una unidad propia en un hábito cuantitativo semanal', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.changeText(await screen.findByPlaceholderText('Nombre del hábito'), 'Novela');
    next();
    fireEvent.press(await screen.findByText('Cantidad'));
    fireEvent.press(screen.getByText('Semanal'));
    fireEvent.press(screen.getByText('Otra'));
    fireEvent.changeText(screen.getByLabelText('Unidad propia'), 'capítulos');
    fireEvent(screen.getByLabelText('Unidad propia'), 'submitEditing');
    fireEvent.changeText(screen.getByLabelText('Meta'), '10');
    fireEvent(screen.getByLabelText('Meta'), 'submitEditing');
    next();
    next();
    fireEvent.press(screen.getByText('Crear hábito'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(useHabits.getState().habits[0]).toMatchObject({ unit: 'capítulos', goal: { period: 'week', count: 10 } });
    expect(await screen.findByText('0 / 10 capítulos esta semana')).toBeTruthy();
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
    expect(screen.getByText('Últimos 12 meses')).toBeTruthy();
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

  it('editar un hábito cuantitativo conserva la unidad y cambia la meta', async () => {
    seed({ name: 'Correr', unit: 'km', goal: { period: 'day', count: 5 } });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1/edit' });
    fireEvent.press(await screen.findByLabelText('Paso 2: Frecuencia'));
    expect(await screen.findByDisplayValue('5')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Meta'), '7,5');
    fireEvent(screen.getByLabelText('Meta'), 'blur');
    fireEvent.press(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(screen).toHavePathname('/habit/h1'));
    expect(useHabits.getState().habits[0]).toMatchObject({ unit: 'km', goal: { period: 'day', count: 7.5 } });
    expect(await screen.findByText(/^7,5 km · Todos los días/)).toBeTruthy();
  });

  it('editar un hábito para dejar: sin cambiar el tipo y con el límite en 0', async () => {
    seed({ name: 'Café', kind: 'quit', goal: { period: 'day', count: 2 } });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1/edit' });
    expect(await screen.findByText('¿Qué hábito quieres dejar?')).toBeTruthy();
    expect(screen.queryByText('Generar hábito')).toBeNull();
    fireEvent.press(screen.getByLabelText('Paso 2: Límite'));
    fireEvent.press(await screen.findByLabelText('Menos veces'));
    fireEvent.press(screen.getByLabelText('Menos veces'));
    fireEvent.press(screen.getByLabelText('Menos veces')); // no baja de 0
    expect(screen.getByText('Ninguna: dejarlo del todo')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(screen).toHavePathname('/habit/h1'));
    expect(useHabits.getState().habits[0]).toMatchObject({ kind: 'quit', goal: { period: 'day', count: 0 } });
  });

  it('detalle de un hábito para dejar: tocar un día abre el panel y no marca nada sin querer', async () => {
    seed({ name: 'Fumar', kind: 'quit', goal: { period: 'day', count: 0 } });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    expect(await screen.findByText('Éxito 30 días')).toBeTruthy();
    expect(screen.getByText('Días con recaída')).toBeTruthy();
    const today = toKey(new Date());
    fireEvent.press(screen.getByLabelText(today));
    expect(useHabits.getState().completions.h1).toBeUndefined();
    fireEvent.press(await screen.findByText('Registrar recaída'));
    await waitFor(() => expect(useHabits.getState().completions.h1).toEqual({ [today]: 1 }));
    fireEvent.press(screen.getByText('Quitar'));
    await waitFor(() => expect(useHabits.getState().completions.h1).toEqual({}));
  });

  it('objetivos: se añaden con una sugerencia y un plazo, se marcan y se ven en Hoy', async () => {
    seed({ name: 'Aprender inglés', icon: 'language' });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    expect(await screen.findByText(/márcate hitos/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Añadir objetivo'));
    fireEvent.press(await screen.findByText('Alcanzar el A1'));
    expect(screen.getByDisplayValue('Alcanzar el A1')).toBeTruthy();
    fireEvent.press(screen.getByText('En 3 meses'));
    fireEvent.press(screen.getByText('Añadir objetivo'));
    await waitFor(() => expect(useHabits.getState().habits[0].objectives).toHaveLength(1));

    fireEvent.press(screen.getByLabelText('Añadir objetivo'));
    fireEvent.changeText(await screen.findByLabelText('Objetivo'), 'Ver una serie sin subtítulos');
    fireEvent.press(screen.getByText('Añadir objetivo'));
    await waitFor(() => expect(useHabits.getState().habits[0].objectives).toHaveLength(2));

    const [a1] = useHabits.getState().habits[0].objectives;
    expect(a1.dueDate).not.toBeNull();
    expect(screen.getByText('0 de 2 logrados')).toBeTruthy();
    expect(screen.getByText('Próximo')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Marcar logrado: Alcanzar el A1'));
    expect(useHabits.getState().habits[0].objectives[0].achievedOn).toBe(toKey(new Date()));
    expect(await screen.findByText('1 de 2 logrados')).toBeTruthy();
    expect(screen.getByText(/^Logrado el/)).toBeTruthy();

    // En Hoy, la tarjeta muestra el siguiente pendiente.
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Ver una serie sin subtítulos')).toBeTruthy();
    expect(screen.getByText(/Próximo:/)).toBeTruthy();
  });

  it('objetivos: editar, reordenar y borrar desde su panel', async () => {
    seed({
      name: 'Correr',
      objectives: ['5 km', '10 km', 'Media maratón'].map((title, i) => ({ id: `o${i}`, title, dueDate: null, achievedOn: null, createdAt: '' })),
    });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.[1].onPress?.());
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });

    fireEvent.press(await screen.findByLabelText('Editar objetivo Media maratón'));
    fireEvent.press(await screen.findByText('Subir'));
    const titles = () => useHabits.getState().habits[0].objectives.map((o) => o.title);
    await waitFor(() => expect(titles()).toEqual(['5 km', 'Media maratón', '10 km']));
    fireEvent.changeText(screen.getByLabelText('Objetivo'), 'Media maratón (21 km)');
    fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(titles()).toEqual(['5 km', 'Media maratón (21 km)', '10 km']));

    fireEvent.press(screen.getByLabelText('Editar objetivo 10 km'));
    fireEvent.press(await screen.findByLabelText('Eliminar objetivo'));
    await waitFor(() => expect(titles()).toEqual(['5 km', 'Media maratón (21 km)']));
    expect(useHabits.getState().habits).toHaveLength(1); // el hábito sigue ahí
    jest.restoreAllMocks();
  });

  it('una URL de hábito inexistente no rompe la app', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/no-existe' });
    await waitFor(() => expect(screen).toHavePathname('/habit/no-existe'));
  });
});
