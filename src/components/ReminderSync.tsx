import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { Notifications, syncReminders } from '@/lib/notifications';
import { useHabits } from '@/store/habits';

const SYNC_DELAY_MS = 800;

type NotificationsModule = NonNullable<typeof Notifications>;

/**
 * Mantiene las notificaciones programadas al día (al cambiar hábitos o marcarlos, y al volver
 * a la app) y abre el hábito al tocar una notificación. No hace nada donde no hay notificaciones
 * (Expo Go en Android).
 */
export function ReminderSync() {
  return Notifications ? <ActiveReminderSync notifications={Notifications} /> : null;
}

function ActiveReminderSync({ notifications }: { notifications: NotificationsModule }) {
  const lastResponse = notifications.useLastNotificationResponse();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      const { habits, completions } = useHabits.getState();
      syncReminders(habits, completions);
    };
    run();
    const unsubscribe = useHabits.subscribe((s, prev) => {
      if (s.habits === prev.habits && s.completions === prev.completions) return;
      clearTimeout(timer);
      timer = setTimeout(run, SYNC_DELAY_MS);
    });
    const appState = AppState.addEventListener('change', (state) => state === 'active' && run());
    return () => {
      clearTimeout(timer);
      unsubscribe();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const habitId = lastResponse.notification.request.content.data?.habitId;
    if (typeof habitId === 'string' && useHabits.getState().habits.some((h) => h.id === habitId)) {
      router.push({ pathname: '/habit/[id]', params: { id: habitId } });
    }
    notifications.clearLastNotificationResponseAsync?.();
  }, [lastResponse, notifications]);

  return null;
}
