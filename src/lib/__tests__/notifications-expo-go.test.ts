/* eslint-disable @typescript-eslint/no-require-imports -- jest.isolateModules necesita require() para cargar los módulos con los mocks aplicados */
/**
 * Expo Go en Android lanza un error con solo importar expo-notifications (SDK 53+).
 * La app no debe cargarlo allí, o se rompe entera al arrancar.
 */
describe('notificaciones en Expo Go (Android)', () => {
  it('no importa expo-notifications y desactiva los recordatorios sin romper la app', async () => {
    let mod: typeof import('../notifications') | undefined;
    let layout: unknown;
    jest.isolateModules(() => {
      jest.doMock('expo-notifications', () => {
        throw new Error('expo-notifications: Android Push notifications ... removed from Expo Go');
      });
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: { executionEnvironment: 'storeClient' },
        ExecutionEnvironment: { StoreClient: 'storeClient' },
      }));
      const { Platform } = require('react-native');
      jest.replaceProperty(Platform, 'OS', 'android');

      mod = require('../notifications');
      // El layout raíz importa ReminderSync, que es donde fallaba la carga.
      layout = require('@/app/_layout').default;
    });

    expect(mod!.REMINDERS_SUPPORTED).toBe(false);
    expect(mod!.Notifications).toBeNull();
    expect(typeof layout).toBe('function');
    await expect(mod!.requestReminderPermission()).resolves.toBe(false);
    await expect(mod!.syncReminders([], {})).resolves.toBeUndefined();
  });
});
