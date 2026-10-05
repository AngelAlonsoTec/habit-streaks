import { addDays, startOfDay, toKey } from './dates';
import { Completions, dailyTarget, describeProgress, formatAmount, Habit, isDoneFor, isQuit, isScheduledOn, weekCount } from './habit';

/** Días hacia delante que se programan. Se recalculan al abrir la app y al marcar hábitos. */
const DAYS_AHEAD = 7;
/** iOS solo guarda 64 notificaciones pendientes; nos quedamos por debajo en ambas plataformas. */
const MAX_SCHEDULED = 60;

export type PlannedReminder = {
  habitId: string;
  date: Date;
  title: string;
  body: string;
};

/**
 * Calcula los recordatorios de los próximos días. Omite los días en los que el hábito
 * no toca o ya está cumplido: no molestamos si ya lo hiciste. Los hábitos para dejar
 * avisan mientras sigas dentro del límite (pasado el límite, el aviso ya no ayuda).
 */
export function planReminders(habits: Habit[], completions: Completions, now = new Date()): PlannedReminder[] {
  const today = startOfDay(now);
  const planned: PlannedReminder[] = [];
  for (const habit of habits) {
    if (habit.archived || habit.reminders.length === 0) continue;
    const days = completions[habit.id];
    for (let d = 0; d < DAYS_AHEAD; d++) {
      const day = addDays(today, d);
      const skip = isQuit(habit) ? !isDoneFor(habit, days, day) : isDoneFor(habit, days, day);
      if (!isScheduledOn(habit, day) || skip) continue;
      const count = days?.[toKey(day)] ?? 0;
      const target = dailyTarget(habit);
      for (const time of habit.reminders) {
        const [h, m] = time.split(':').map(Number);
        const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (date <= now) continue;
        planned.push({
          habitId: habit.id,
          date,
          title: habit.name,
          body: reminderBody(habit, d === 0 ? count : 0, target, weekCount(days, day)),
        });
      }
    }
  }
  return planned.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

function reminderBody(habit: Habit, count: number, target: number, week: number): string {
  if (isQuit(habit)) {
    const limit = habit.goal.count;
    if (limit === 0) return 'Sigue así: hoy sin recaídas.';
    const value = habit.goal.period === 'week' ? week : count;
    const progress = describeProgress(habit, value, limit);
    return `${habit.goal.period === 'week' ? 'Esta semana' : 'Hoy'}: ${progress}.`;
  }
  if (habit.unit != null) {
    const unit = habit.unit;
    if (habit.goal.period === 'week') return `Esta semana llevas ${formatAmount(week)} de ${formatAmount(habit.goal.count)} ${unit}.`;
    return `Llevas ${formatAmount(count)} de ${formatAmount(target)} ${unit} hoy.`;
  }
  if (habit.goal.period === 'week') return `Esta semana llevas ${week} de ${habit.goal.count}.`;
  if (target > 1) return `Llevas ${count} de ${target} hoy.`;
  return 'Pendiente para hoy.';
}
