import * as Notifications from 'expo-notifications';

import { makeHabit, NOW } from '@/testing/fixtures';
import { syncReminders } from '../notifications';
import { planReminders } from '../reminders';

const at = (d: Date) => `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('planReminders', () => {
  it('programa varias horas al día durante 7 días, sin las que ya pasaron hoy', () => {
    const plan = planReminders([makeHabit({ reminders: ['08:00', '20:00'] })], {}, NOW);
    expect(plan.map((r) => at(r.date)).slice(0, 3)).toEqual(['25/9 20:00', '26/9 08:00', '26/9 20:00']);
    expect(plan).toHaveLength(13); // hoy 1 + 6 días × 2
  });

  it('no avisa si ya se completó ese día', () => {
    const plan = planReminders([makeHabit({ reminders: ['20:00'] })], { h1: { '2026-09-25': 1 } }, NOW);
    expect(at(plan[0].date)).toBe('26/9 20:00');
  });

  it('solo los días que toca', () => {
    const plan = planReminders([makeHabit({ reminders: ['09:00'], days: [0] })], {}, NOW);
    expect(plan.map((r) => at(r.date))).toEqual(['28/9 09:00']);
  });

  it('meta semanal: deja de avisar cuando se cumple la semana', () => {
    const habit = makeHabit({ reminders: ['18:00'], goal: { period: 'week', count: 2 } });
    const plan = planReminders([habit], { h1: { '2026-09-21': 1, '2026-09-22': 1 } }, NOW);
    expect(at(plan[0].date)).toBe('28/9 18:00');
  });

  it('muestra el progreso en metas de varias veces', () => {
    const habit = makeHabit({ reminders: ['20:00'], goal: { period: 'day', count: 8 } });
    const [first] = planReminders([habit], { h1: { '2026-09-25': 3 } }, NOW);
    expect(first.body).toBe('Llevas 3 de 8 hoy.');
  });

  it('al dejar: avisa aunque no haya registros, pero no si ya se pasó del límite', () => {
    const smoke = makeHabit({ reminders: ['20:00'], kind: 'quit', goal: { period: 'day', count: 0 } });
    const plan = planReminders([smoke], {}, NOW);
    expect(plan).toHaveLength(7);
    expect(plan[0].body).toBe('Sigue así: hoy sin recaídas.');
    expect(planReminders([smoke], { h1: { '2026-09-25': 1 } }, NOW)).toHaveLength(6);
    const coffee = makeHabit({ reminders: ['20:00'], kind: 'quit', goal: { period: 'day', count: 2 } });
    expect(planReminders([coffee], { h1: { '2026-09-25': 1 } }, NOW)[0].body).toBe('Hoy: 1 / máx. 2.');
  });

  it('muestra la cantidad con su unidad en hábitos cuantitativos', () => {
    const daily = makeHabit({ reminders: ['20:00'], unit: 'km', goal: { period: 'day', count: 5 } });
    expect(planReminders([daily], { h1: { '2026-09-25': 2.5 } }, NOW)[0].body).toBe('Llevas 2,5 de 5 km hoy.');
    const weekly = makeHabit({ reminders: ['20:00'], unit: 'min', goal: { period: 'week', count: 150 } });
    expect(planReminders([weekly], { h1: { '2026-09-22': 45 } }, NOW)[0].body).toBe('Esta semana llevas 45 de 150 min.');
  });

  it('ignora archivados y respeta el máximo de 60, en orden', () => {
    const many = Array.from({ length: 12 }, (_, i) => makeHabit({ id: `h${i}`, reminders: ['07:00', '12:00', '19:00'] }));
    const archived = makeHabit({ id: 'arch', reminders: ['16:00'], archived: true });
    const plan = planReminders([...many, archived], {}, NOW);
    expect(plan).toHaveLength(60);
    expect(plan.some((r) => r.habitId === 'arch')).toBe(false);
    const times = plan.map((r) => r.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe('syncReminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reemplaza las notificaciones programadas', async () => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    await syncReminders([makeHabit({ reminders: ['20:00'] })], {});
    jest.useRealTimers();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(7);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ title: 'Leer', data: { habitId: 'h1' } }) }),
    );
  });

  it('sin permiso solo limpia', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await syncReminders([makeHabit({ reminders: ['20:00'] })], {});
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('requestReminderPermission', () => {
  // Import diferido para usar la misma instancia mockeada del módulo.
  const { requestReminderPermission } = jest.requireActual<typeof import('../notifications')>('../notifications');
  const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
  const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it('si ya hay permiso no vuelve a preguntar', async () => {
    getPermissions.mockResolvedValueOnce({ granted: true, canAskAgain: true });
    await expect(requestReminderPermission()).resolves.toBe(true);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('si el usuario lo bloqueó, no insiste', async () => {
    getPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: false });
    await expect(requestReminderPermission()).resolves.toBe(false);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('pregunta y devuelve la respuesta del usuario', async () => {
    getPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    requestPermissions.mockResolvedValueOnce({ granted: false });
    await expect(requestReminderPermission()).resolves.toBe(false);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('en Android crea el canal antes de pedir permiso (requisito de Android 13)', async () => {
    const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
    jest.replaceProperty(Platform, 'OS', 'android');
    getPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    requestPermissions.mockResolvedValueOnce({ granted: true });
    await expect(requestReminderPermission()).resolves.toBe(true);
    const channelOrder = (Notifications.setNotificationChannelAsync as jest.Mock).mock.invocationCallOrder[0];
    expect(channelOrder).toBeLessThan(requestPermissions.mock.invocationCallOrder[0]);
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('reminders', expect.objectContaining({ name: 'Recordatorios de hábitos' }));
    jest.restoreAllMocks();
  });
});

describe('syncReminders · robustez', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dos sincronizaciones seguidas no se pisan (la segunda espera a la primera)', async () => {
    const order: string[] = [];
    (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockImplementation(async () => {
      order.push('cancel');
    });
    (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(async () => {
      order.push('schedule');
      return 'id';
    });
    const habit = makeHabit({ reminders: ['23:59'] });
    await Promise.all([syncReminders([habit], {}), syncReminders([habit], {})]);
    // cancel → schedule… → cancel → schedule…: nunca dos "cancel" seguidos a mitad de programar.
    const firstCancelAgain = order.indexOf('cancel', 1);
    expect(order.slice(1, firstCancelAgain).every((s) => s === 'schedule')).toBe(true);
    expect(order.filter((s) => s === 'cancel')).toHaveLength(2);
  });

  it('un error al programar no rompe la app', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(new Error('fallo nativo'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(syncReminders([makeHabit({ reminders: ['23:59'] })], {})).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('No se pudieron programar los recordatorios', expect.any(Error));
    warn.mockRestore();
  });
});
