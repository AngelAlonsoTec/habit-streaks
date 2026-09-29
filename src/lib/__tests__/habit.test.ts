import { counts, makeHabit } from '@/testing/fixtures';
import { fromKey } from '../dates';
import { describeGoal, isDoneFor, isScheduledOn, weekCount } from '../habit';

describe('reglas de hábito', () => {
  it('solo toca los días elegidos', () => {
    const h = makeHabit({ days: [0, 2, 4] });
    expect(isScheduledOn(h, fromKey('2026-09-21'))).toBe(true); // lunes
    expect(isScheduledOn(h, fromKey('2026-09-22'))).toBe(false); // martes
  });

  it('las metas semanales tocan todos los días', () => {
    const h = makeHabit({ goal: { period: 'week', count: 2 }, days: [0] });
    expect(isScheduledOn(h, fromKey('2026-09-26'))).toBe(true);
  });

  it('meta diaria con varias veces', () => {
    const h = makeHabit({ goal: { period: 'day', count: 3 } });
    expect(isDoneFor(h, { '2026-09-25': 2 }, fromKey('2026-09-25'))).toBe(false);
    expect(isDoneFor(h, { '2026-09-25': 3 }, fromKey('2026-09-25'))).toBe(true);
  });

  it('meta semanal se cumple con la suma de la semana', () => {
    const h = makeHabit({ goal: { period: 'week', count: 2 } });
    const data = counts(['2026-09-21', '2026-09-23']);
    expect(weekCount(data, fromKey('2026-09-27'))).toBe(2);
    expect(isDoneFor(h, data, fromKey('2026-09-25'))).toBe(true);
    expect(isDoneFor(h, data, fromKey('2026-09-28'))).toBe(false); // semana siguiente
  });

  it('describe la meta en lenguaje natural', () => {
    expect(describeGoal(makeHabit())).toBe('Todos los días');
    expect(describeGoal(makeHabit({ days: [0, 1, 2, 3, 4] }))).toBe('Entre semana');
    expect(describeGoal(makeHabit({ goal: { period: 'day', count: 8 }, days: [5, 6] }))).toBe('8 veces · Fines de semana');
    expect(describeGoal(makeHabit({ days: [0, 2] }))).toBe('L X');
    expect(describeGoal(makeHabit({ goal: { period: 'week', count: 1 } }))).toBe('1 vez por semana');
  });
});
