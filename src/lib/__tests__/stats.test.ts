import { counts, makeHabit, NOW, range, TODAY } from '@/testing/fixtures';
import { computeStats } from '../stats';

describe('computeStats · meta diaria todos los días', () => {
  const habit = makeHabit();

  it('sin completados todo es cero', () => {
    expect(computeStats(habit, undefined, NOW)).toMatchObject({
      currentStreak: 0, bestStreak: 0, total: 0, rate30: 0, streakUnit: 'day',
    });
  });

  it('cuenta la racha incluyendo hoy', () => {
    const s = computeStats(habit, counts(range(TODAY, 5)), NOW);
    expect(s.currentStreak).toBe(5);
    expect(s.bestStreak).toBe(5);
  });

  it('mantiene la racha si hoy aún no está hecho', () => {
    expect(computeStats(habit, counts(range('2026-09-24', 3)), NOW).currentStreak).toBe(3);
  });

  it('pierde la racha si falló ayer', () => {
    const s = computeStats(habit, counts(range('2026-09-23', 4)), NOW);
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(4);
  });

  it('mejor racha cruzando meses y total', () => {
    const s = computeStats(habit, counts([...range('2026-03-02', 6), TODAY]), NOW);
    expect(s.bestStreak).toBe(6);
    expect(s.currentStreak).toBe(1);
    expect(s.total).toBe(7);
  });

  it('cumplimiento de 30 días', () => {
    expect(computeStats(habit, counts(range(TODAY, 15)), NOW).rate30).toBe(50);
  });

  it('hoy sin marcar no penaliza el cumplimiento', () => {
    expect(computeStats(habit, counts(range('2026-09-24', 29)), NOW).rate30).toBe(100);
  });

  it('un hábito nuevo solo cuenta desde su creación', () => {
    const fresh = makeHabit({ createdAt: new Date(2026, 8, 24, 9).toISOString() });
    expect(computeStats(fresh, counts([TODAY]), NOW).rate30).toBe(50);
    expect(computeStats(fresh, counts([TODAY, '2026-09-24']), NOW).rate30).toBe(100);
  });

  it('cuenta veces por día de la semana', () => {
    const s = computeStats(habit, counts(['2026-09-21', '2026-09-14', '2026-09-25']), NOW);
    expect(s.weekdayCounts).toEqual([2, 0, 0, 0, 1, 0, 0]);
  });
});

describe('computeStats · días concretos', () => {
  // Entre semana: el fin de semana no rompe la racha.
  const habit = makeHabit({ days: [0, 1, 2, 3, 4] });

  it('el fin de semana no rompe la racha', () => {
    const weekdays = [
      '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18',
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
    ];
    const s = computeStats(habit, counts(weekdays), NOW);
    expect(s.currentStreak).toBe(10);
    expect(s.rate30).toBeLessThan(100); // semanas anteriores sin hacer
  });

  it('hacerlo en un día de descanso no suma racha pero cuenta en el total', () => {
    const s = computeStats(habit, counts(['2026-09-19', '2026-09-20']), NOW);
    expect(s.currentStreak).toBe(0);
    expect(s.total).toBe(2);
  });
});

describe('computeStats · varias veces al día', () => {
  const habit = makeHabit({ goal: { period: 'day', count: 3 } });

  it('un día solo cuenta si llega a la meta', () => {
    const data = { ...counts(range('2026-09-24', 2), 3), [TODAY]: 3, '2026-09-22': 2 };
    const s = computeStats(habit, data, NOW);
    expect(s.currentStreak).toBe(3);
    expect(s.total).toBe(11);
  });
});

describe('computeStats · meta semanal', () => {
  const habit = makeHabit({ goal: { period: 'week', count: 3 } });

  it('cuenta semanas seguidas y la actual no rompe si aún no llega', () => {
    const data = counts([
      '2026-09-07', '2026-09-09', '2026-09-11', // semana del 7: 3, cumplida
      '2026-09-14', '2026-09-15', '2026-09-20', // semana del 14: 3, cumplida
      '2026-09-22', // semana actual: 1 (en curso)
    ]);
    const s = computeStats(habit, data, NOW);
    expect(s.streakUnit).toBe('week');
    expect(s.currentStreak).toBe(2);
    expect(s.bestStreak).toBe(2);
  });

  it('una semana incompleta rompe la racha', () => {
    const data = counts(['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14']);
    expect(computeStats(habit, data, NOW).currentStreak).toBe(0);
  });
});

describe('computeStats · casos límite', () => {
  it('rachas que cruzan el cambio de año', () => {
    const habit = makeHabit({ createdAt: new Date(2026, 0, 1).toISOString() });
    const jan3 = new Date(2027, 0, 3, 12);
    const s = computeStats(habit, counts(range('2027-01-03', 10)), jan3);
    expect(s.currentStreak).toBe(10);
  });

  it('el 29 de febrero cuenta como un día más de la racha', () => {
    const habit = makeHabit({ createdAt: new Date(2028, 0, 1).toISOString() });
    const mar1 = new Date(2028, 2, 1, 12);
    expect(computeStats(habit, counts(['2028-02-28', '2028-02-29', '2028-03-01']), mar1).currentStreak).toBe(3);
  });

  it('veces por día de la semana suma las repeticiones', () => {
    const habit = makeHabit({ goal: { period: 'day', count: 8 } });
    const s = computeStats(habit, { '2026-09-21': 8, '2026-09-22': 3 }, NOW);
    expect(s.weekdayCounts.slice(0, 2)).toEqual([8, 3]);
    expect(s.total).toBe(11);
  });

  it('meta semanal con hábito recién creado: sin racha pero sin errores', () => {
    const habit = makeHabit({ goal: { period: 'week', count: 3 }, createdAt: new Date(2026, 8, 25).toISOString() });
    expect(computeStats(habit, undefined, NOW)).toMatchObject({ currentStreak: 0, bestStreak: 0, rate30: 0 });
  });

  it('ignora días guardados con 0 repeticiones', () => {
    expect(computeStats(makeHabit(), { [TODAY]: 0 }, NOW)).toMatchObject({ total: 0, currentStreak: 0 });
  });
});
