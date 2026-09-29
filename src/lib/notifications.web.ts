import type { Completions, Habit } from './habit';

// En web no hay notificaciones locales: los recordatorios se guardan pero no suenan.
export const REMINDERS_SUPPORTED = false;

export const REMINDERS_UNAVAILABLE_MESSAGE = 'Los recordatorios suenan en la app del móvil; en la web solo se guardan.';

export const Notifications = null;

export async function requestReminderPermission(): Promise<boolean> {
  return false;
}

export function syncReminders(_habits: Habit[], _completions: Completions): Promise<void> {
  return Promise.resolve();
}
