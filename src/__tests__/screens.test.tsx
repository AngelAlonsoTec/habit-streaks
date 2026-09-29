import * as Notifications from 'expo-notifications';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';
import { Alert, AlertButton, AppState } from 'react-native';

import { ReminderSync } from '@/components/ReminderSync';
import { toKey } from '@/lib/dates';
import { Habit } from '@/lib/habit';
import { useHabits } from '@/store/habits';
import { makeHabit } from '@/testing/fixtures';
import { render } from '@testing-library/react-native';

const APP_DIR = path.resolve(__dirname, '../app');
const today = () => toKey(new Date());

beforeEach(() => {
  useHabits.setState({ habits: [], completions: {}, customCategories: [], settings: { showHeatmaps: true }, hasHydrated: true });
});
afterEach(() => {
  jest.restoreAllMocks();
});

function seed(...habits: Partial<Habit>[]) {
  useHabits.setState({ habits: habits.map((h, i) => makeHabit({ id: `h${i + 1}`, ...h })) });
}

/** El usuario confirma (o cancela) el diálogo nativo. */
function answerAlert(confirm: boolean) {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => {
    buttons?.[confirm ? 1 : 0].onPress?.();
  });
}

const next = () => fireEvent.press(screen.getByText('Siguiente'));

describe('detalle del hábito', () => {
  it('eliminar pide confirmación y, si se cancela, no borra nada', async () => {
    seed({ name: 'Leer' });
    answerAlert(false);
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    fireEvent.press(await screen.findByText('Eliminar'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(useHabits.getState().habits).toHaveLength(1);
    expect(screen).toHavePathname('/habit/h1');
  });

  it('eliminar confirmado borra el hábito y su historial', async () => {
    seed({ name: 'Leer' });
    useHabits.getState().setCompletion('h1', today(), 1);
    answerAlert(true);
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    fireEvent.press(await screen.findByText('Eliminar'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(useHabits.getState().habits).toHaveLength(0);
    expect(useHabits.getState().completions.h1).toBeUndefined();
  });

  it('en el calendario, mantener pulsado un día lo reinicia', async () => {
    seed({ name: 'Agua', goal: { period: 'day', count: 8 } });
    useHabits.getState().setCompletion('h1', today(), 5);
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    fireEvent(await screen.findByLabelText(`${today()}, 5 veces`), 'longPress');
    expect(useHabits.getState().completions.h1?.[today()]).toBeUndefined();
  });

  it('en metas de varias veces, tocar un día del calendario suma una', async () => {
    seed({ name: 'Agua', goal: { period: 'day', count: 8 } });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    fireEvent.press(await screen.findByLabelText(today()));
    fireEvent.press(await screen.findByLabelText(`${today()}, 1 vez`));
    expect(useHabits.getState().completions.h1?.[today()]).toBe(2);
    expect(screen.getByText('Menos')).toBeTruthy(); // leyenda de intensidad
  });

  it('muestra categorías, horario y recordatorios del hábito', async () => {
    seed({ name: 'Leer', categories: ['lectura'], timeOfDay: 'evening', reminders: ['21:30', '22:00'], days: [0, 1, 2, 3, 4] });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1' });
    expect(await screen.findByText('Lectura')).toBeTruthy();
    expect(screen.getByText('Entre semana · Noche')).toBeTruthy();
    expect(screen.getByText('21:30 · 22:00')).toBeTruthy();
  });
});

describe('menú de la tarjeta', () => {
  it('"Ver estadísticas" abre el detalle', async () => {
    seed({ name: 'Leer' });
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent(await screen.findByText('Leer'), 'longPress');
    fireEvent.press(await screen.findByText('Ver estadísticas'));
    await waitFor(() => expect(screen).toHavePathname('/habit/h1'));
  });

  it('"Eliminar" pide confirmación y borra', async () => {
    seed({ name: 'Leer' }, { name: 'Correr' });
    answerAlert(true);
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent(await screen.findByText('Correr'), 'longPress');
    fireEvent.press(await screen.findByText('Eliminar'));
    await waitFor(() => expect(useHabits.getState().habits.map((h) => h.name)).toEqual(['Leer']));
  });

  it('se cierra tocando fuera sin hacer nada', async () => {
    seed({ name: 'Leer' });
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent(await screen.findByText('Leer'), 'longPress');
    fireEvent.press(await screen.findByLabelText('Cerrar menú'));
    await waitFor(() => expect(screen.queryByText('Ver estadísticas')).toBeNull());
    expect(useHabits.getState().habits[0].archived).toBe(false);
  });
});

describe('archivados', () => {
  it('eliminar desde archivados pide confirmación', async () => {
    seed({ name: 'Leer', archived: true }, { name: 'Correr' });
    answerAlert(true);
    renderRouter(APP_DIR, { initialUrl: '/archived' });
    fireEvent.press(await screen.findByLabelText('Eliminar Leer'));
    await waitFor(() => expect(useHabits.getState().habits.map((h) => h.name)).toEqual(['Correr']));
  });

  it('sin archivados muestra un aviso', async () => {
    renderRouter(APP_DIR, { initialUrl: '/archived' });
    expect(await screen.findByText('No tienes hábitos archivados.')).toBeTruthy();
  });

  it('el botón de archivados solo aparece si hay alguno', async () => {
    seed({ name: 'Leer' });
    renderRouter(APP_DIR, { initialUrl: '/' });
    await screen.findByText('Leer');
    expect(screen.queryByLabelText('Hábitos archivados')).toBeNull();
  });
});

describe('formulario: límites', () => {
  it('la meta diaria no baja de 1 ni pasa de 50', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.changeText(await screen.findByPlaceholderText('Nombre del hábito'), 'Agua');
    next();
    fireEvent.press(await screen.findByLabelText('Menos veces'));
    expect(screen.getByText('vez al día')).toBeTruthy();
    for (let i = 0; i < 60; i++) fireEvent.press(screen.getByLabelText('Más veces'));
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('al pasar a meta semanal propone 3 veces y al volver a diaria, 1', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.changeText(await screen.findByPlaceholderText('Nombre del hábito'), 'Correr');
    next();
    fireEvent.press(await screen.findByText('Semanal'));
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.press(screen.getByText('Diaria'));
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('no se puede quitar el último día de la semana', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.changeText(await screen.findByPlaceholderText('Nombre del hábito'), 'Correr');
    next();
    fireEvent.press(await screen.findByText('Fines de semana'));
    fireEvent.press(screen.getByLabelText('Día S'));
    fireEvent.press(screen.getByLabelText('Día D')); // intento de quitar el último
    next();
    next();
    fireEvent.press(screen.getByText('Crear hábito'));
    await waitFor(() => expect(useHabits.getState().habits).toHaveLength(1));
    expect(useHabits.getState().habits[0].days).toEqual([6]);
  });

  it('cambiar y quitar recordatorios', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.changeText(await screen.findByPlaceholderText('Nombre del hábito'), 'Leer');
    next();
    next();
    fireEvent.press(await screen.findByText('Añadir hora'));
    fireEvent.press(await screen.findByText('Guardar hora'));
    await screen.findByText('10:00'); // hora por defecto de "Cualquier momento"
    fireEvent.press(screen.getByLabelText('Cambiar 10:00'));
    fireEvent.press(await screen.findByLabelText('Hora 18'));
    fireEvent.press(screen.getByText('Guardar hora'));
    await screen.findByText('18:00');
    fireEvent.press(screen.getByText('Otra hora'));
    fireEvent.press(await screen.findByText('Guardar hora'));
    await screen.findByText('10:00');
    fireEvent.press(screen.getByLabelText('Quitar recordatorio 18:00'));
    await waitFor(() => expect(screen.queryByText('18:00')).toBeNull());
    next();
    fireEvent.press(screen.getByText('Crear hábito'));
    await waitFor(() => expect(useHabits.getState().habits[0]?.reminders).toEqual(['10:00']));
  });

  it('categorías: se pueden quitar y una categoría en blanco no se crea', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.press(await screen.findByText('Leer 20 minutos')); // plantilla con categoría Lectura
    next();
    next();
    next();
    fireEvent.press(await screen.findByLabelText('Lectura'));
    fireEvent.press(screen.getByText('Nueva'));
    fireEvent.changeText(screen.getByPlaceholderText('Nombre de la categoría'), '   ');
    fireEvent(screen.getByPlaceholderText('Nombre de la categoría'), 'submitEditing');
    fireEvent.press(screen.getByText('Crear hábito'));
    await waitFor(() => expect(useHabits.getState().habits).toHaveLength(1));
    expect(useHabits.getState().habits[0].categories).toEqual([]);
    expect(useHabits.getState().customCategories).toEqual([]);
  });

  it('iconos: "Ver todos" muestra más y "Ver menos" los recoge', async () => {
    renderRouter(APP_DIR, { initialUrl: '/habit/new' });
    fireEvent.changeText(await screen.findByPlaceholderText('Nombre del hábito'), 'Algo');
    expect(screen.getByText('Ver todos')).toBeTruthy();
    fireEvent.press(screen.getByText('Ver todos'));
    expect(await screen.findByText('Ver menos')).toBeTruthy();
    fireEvent.press(screen.getByText('Ver menos'));
    expect(await screen.findByText('Ver todos')).toBeTruthy();
  });

  it('al editar no se muestran sugerencias y el paso 1 conserva los datos', async () => {
    seed({ name: 'Leer', color: '#EF4444', icon: 'book' });
    renderRouter(APP_DIR, { initialUrl: '/habit/h1/edit' });
    expect(await screen.findByDisplayValue('Leer')).toBeTruthy();
    expect(screen.queryByText('Sugerencias')).toBeNull();
    fireEvent.press(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(screen).toHavePathname('/habit/h1'));
    expect(useHabits.getState().habits[0]).toMatchObject({ name: 'Leer', color: '#EF4444', icon: 'book' });
  });
});

describe('recordatorios en segundo plano', () => {
  const lastResponse = Notifications.useLastNotificationResponse as jest.Mock;
  afterEach(() => lastResponse.mockReturnValue(null));

  it('tocar una notificación abre su hábito', async () => {
    seed({ name: 'Leer' });
    lastResponse.mockReturnValue({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: { request: { content: { data: { habitId: 'h1' } } } },
    });
    renderRouter(APP_DIR, { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/habit/h1'));
    expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('una notificación de un hábito que ya no existe no navega', async () => {
    seed({ name: 'Leer' });
    lastResponse.mockReturnValue({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: { request: { content: { data: { habitId: 'borrado' } } } },
    });
    renderRouter(APP_DIR, { initialUrl: '/' });
    await screen.findByText('Leer');
    expect(screen).toHavePathname('/');
  });

  it('reprograma al arrancar, al marcar un hábito (con espera) y al volver a la app', async () => {
    jest.useFakeTimers();
    const cancel = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;
    cancel.mockClear();
    let onAppState: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onAppState = handler as (state: string) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    seed({ name: 'Leer', reminders: ['23:59'] });

    const advance = (ms: number) =>
      act(async () => {
        await jest.advanceTimersByTimeAsync(ms);
      });

    render(<ReminderSync />);
    await advance(0);
    expect(cancel).toHaveBeenCalledTimes(1);

    await act(async () => {
      useHabits.getState().setCompletion('h1', today(), 1);
    });
    await advance(500);
    expect(cancel).toHaveBeenCalledTimes(1); // aún esperando: agrupa cambios seguidos
    await advance(400);
    expect(cancel).toHaveBeenCalledTimes(2);

    await act(async () => {
      onAppState?.('active');
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(cancel).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});
