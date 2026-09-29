import { addDays, daysBetween, fromKey, startOfWeek, toKey, weekdayIndex } from '../dates';

describe('dates', () => {
  it('convierte ida y vuelta entre Date y DateKey', () => {
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toKey(fromKey('2026-12-31'))).toBe('2026-12-31');
  });

  it('suma días cruzando meses, años y bisiestos', () => {
    expect(toKey(addDays(fromKey('2026-01-31'), 1))).toBe('2026-02-01');
    expect(toKey(addDays(fromKey('2026-12-31'), 1))).toBe('2027-01-01');
    expect(toKey(addDays(fromKey('2028-02-28'), 1))).toBe('2028-02-29');
    expect(toKey(addDays(fromKey('2026-03-01'), -1))).toBe('2026-02-28');
  });

  it('mantiene el día correcto en cambios de horario de verano', () => {
    let d = fromKey('2026-03-20');
    for (let i = 0; i < 20; i++) d = addDays(d, 1);
    expect(toKey(d)).toBe('2026-04-09');
    expect(daysBetween(fromKey('2026-03-20'), fromKey('2026-04-09'))).toBe(20);
    expect(daysBetween(fromKey('2026-10-20'), fromKey('2026-11-09'))).toBe(20);
  });

  it('usa lunes como primer día de la semana', () => {
    expect(weekdayIndex(fromKey('2026-09-21'))).toBe(0); // lunes
    expect(weekdayIndex(fromKey('2026-09-27'))).toBe(6); // domingo
    expect(toKey(startOfWeek(fromKey('2026-09-27')))).toBe('2026-09-21');
    expect(toKey(startOfWeek(fromKey('2026-09-21')))).toBe('2026-09-21');
  });
});

describe('dates · casos límite', () => {
  it('diferencia de días entre años y en años bisiestos', () => {
    expect(daysBetween(fromKey('2026-12-31'), fromKey('2027-01-01'))).toBe(1);
    expect(daysBetween(fromKey('2028-02-01'), fromKey('2028-03-01'))).toBe(29);
    expect(daysBetween(fromKey('2027-02-01'), fromKey('2027-03-01'))).toBe(28);
    expect(daysBetween(fromKey('2026-09-25'), fromKey('2026-09-20'))).toBe(-5);
  });

  it('la hora del día no afecta a la clave ni al inicio de semana', () => {
    const lateNight = new Date(2026, 8, 27, 23, 59, 59); // domingo casi a medianoche
    expect(toKey(lateNight)).toBe('2026-09-27');
    expect(toKey(startOfWeek(lateNight))).toBe('2026-09-21');
    expect(startOfWeek(lateNight).getHours()).toBe(0);
  });

  it('semana que empieza en un año y termina en el siguiente', () => {
    expect(toKey(startOfWeek(fromKey('2027-01-02')))).toBe('2026-12-28');
  });
});
