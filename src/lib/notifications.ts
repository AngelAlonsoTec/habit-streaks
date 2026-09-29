import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import type { Completions, Habit } from './habit';
import { planReminders } from './reminders';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Expo Go en Android (SDK 53+) lanza un error con solo importar expo-notifications,
 * así que allí no lo cargamos: los recordatorios necesitan la app instalada (build propio).
 * Web usa notifications.web.ts.
 */
const IN_EXPO_GO_ANDROID =
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const REMINDERS_SUPPORTED = !IN_EXPO_GO_ANDROID;

export const REMINDERS_UNAVAILABLE_MESSAGE =
  'Los recordatorios no funcionan dentro de Expo Go. Se guardan y sonarán en la app instalada.';

// Carga diferida: require solo se ejecuta donde el módulo está disponible.
export const Notifications: NotificationsModule | null = REMINDERS_SUPPORTED
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-notifications') as NotificationsModule)
  : null;

const CHANNEL_ID = 'reminders';

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(n: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  await n.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Recordatorios de hábitos',
    importance: n.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
  });
}

/** Pide permiso si hace falta. Devuelve si se pueden mostrar notificaciones. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!Notifications) return false;
  await ensureChannel(Notifications);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

let syncing: Promise<void> = Promise.resolve();

/** Reemplaza todas las notificaciones programadas por las del plan actual. */
export function syncReminders(habits: Habit[], completions: Completions): Promise<void> {
  const n = Notifications;
  if (!n) return Promise.resolve();
  // Encadenamos para que dos sincronizaciones seguidas no se pisen.
  syncing = syncing.then(async () => {
    const { granted } = await n.getPermissionsAsync();
    await n.cancelAllScheduledNotificationsAsync();
    if (!granted) return;
    await ensureChannel(n);
    for (const r of planReminders(habits, completions)) {
      await n.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, data: { habitId: r.habitId } },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL_ID },
      });
    }
  }).catch((e) => console.warn('No se pudieron programar los recordatorios', e));
  return syncing;
}
