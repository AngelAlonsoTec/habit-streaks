import { counts, makeHabit } from '@/testing/fixtures';
import { fromKey } from '../dates';
import {
  dailyTarget, describeGoal, describeProgress, formatAmount, isDoneFor, isScheduledOn, parseAmount, quickSteps, weekCount,
} from '../habit';

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

describe('hábitos cuantitativos', () => {
  const run = makeHabit({ unit: 'km', goal: { period: 'day', count: 5 } });

  it('el día se cumple al llegar a la cantidad', () => {
    expect(isDoneFor(run, { '2026-09-25': 4.5 }, fromKey('2026-09-25'))).toBe(false);
    expect(isDoneFor(run, { '2026-09-25': 5.2 }, fromKey('2026-09-25'))).toBe(true);
  });

  it('meta semanal: suma la semana; cada día se compara con el ritmo (1/7)', () => {
    const weekly = makeHabit({ unit: 'km', goal: { period: 'week', count: 14 } });
    expect(dailyTarget(weekly)).toBe(2);
    const data = { '2026-09-21': 6, '2026-09-24': 8 };
    expect(isDoneFor(weekly, data, fromKey('2026-09-25'))).toBe(true);
    expect(isDoneFor(weekly, { '2026-09-21': 6 }, fromKey('2026-09-25'))).toBe(false);
  });

  it('describe meta y progreso con la unidad', () => {
    expect(describeGoal(run)).toBe('5 km · Todos los días');
    expect(describeGoal(makeHabit({ unit: 'min', goal: { period: 'week', count: 150 } }))).toBe('150 min por semana');
    expect(describeProgress(run, 3.25, 5)).toBe('3,25 / 5 km');
    expect(describeProgress(makeHabit(), 2, 8)).toBe('2/8');
  });

  it('formatea en español', () => {
    expect(formatAmount(10000)).toBe('10.000');
    expect(formatAmount(0.1 + 0.2)).toBe('0,3');
    expect(formatAmount(2.5)).toBe('2,5');
  });

  it('entiende coma o punto decimal y puntos de miles', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('1.5')).toBe(1.5);
    expect(parseAmount(' 2,25 ')).toBe(2.25);
    expect(parseAmount('10.000')).toBe(10000);
    expect(parseAmount('10 000')).toBe(10000);
    expect(parseAmount('1.234,5')).toBe(1234.5);
    expect(parseAmount('5.')).toBe(5);
    expect(parseAmount(',5')).toBe(0.5);
  });

  it('rechaza lo que no es una cantidad positiva', () => {
    for (const bad of ['', 'abc', '0', '-3', '1,2,3', '1e5']) expect(parseAmount(bad)).toBeNull();
  });

  it('sumas rápidas: las de la unidad o fracciones redondas de la meta', () => {
    expect(quickSteps(run)).toEqual([0.5, 1, 2, 5]);
    expect(quickSteps(makeHabit({ unit: 'capítulos', goal: { period: 'day', count: 4 } }))).toEqual([0.5, 1, 2, 5]);
    expect(quickSteps(makeHabit({ unit: 'flexiones', goal: { period: 'day', count: 100 } }))).toEqual([10, 25, 50, 100]);
  });
});
