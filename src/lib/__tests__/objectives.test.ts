import { makeHabit } from '@/testing/fixtures';
import { addMonths, formatShortDate, fromKey, toKey } from '../dates';
import { describeDue, describeDueShort, describeObjective, nextObjective, Objective, suggestObjectives } from '../objectives';

const obj = (o: Partial<Objective>): Objective => ({
  id: 'o', title: 'Objetivo', dueDate: null, achievedOn: null, createdAt: '2026-01-01T00:00:00.000Z', ...o,
});

describe('fechas de los objetivos', () => {
  it('sumar meses no se salta al mes siguiente en días que no existen', () => {
    expect(toKey(addMonths(fromKey('2026-01-31'), 1))).toBe('2026-02-28');
    expect(toKey(addMonths(fromKey('2028-01-31'), 1))).toBe('2028-02-29'); // bisiesto
    expect(toKey(addMonths(fromKey('2026-10-05'), 3))).toBe('2027-01-05');
    expect(toKey(addMonths(fromKey('2026-08-31'), 1))).toBe('2026-09-30');
  });

  it('fecha corta, con el año solo si no es el actual', () => {
    expect(formatShortDate('2026-12-15', '2026-10-05')).toBe('15 dic');
    expect(formatShortDate('2027-01-05', '2026-10-05')).toBe('5 ene 2027');
  });
});

describe('estado de un objetivo', () => {
  const today = '2026-10-05';

  it('plazo: quedan días, vence hoy o mañana, o vencido', () => {
    expect(describeDue('2026-12-15', today)).toEqual({ text: 'Antes del 15 dic · quedan 71 días', tone: 'normal' });
    expect(describeDue('2026-10-10', today).tone).toBe('soon');
    expect(describeDue('2026-10-06', today).text).toBe('Vence mañana');
    expect(describeDue(today, today).text).toBe('Vence hoy');
    expect(describeDue('2026-10-04', today)).toEqual({ text: 'Plazo vencido hace 1 día', tone: 'overdue' });
    expect(describeDueShort('2026-12-15', today).text).toBe('71 días');
    expect(describeDueShort('2026-09-30', today)).toEqual({ text: 'plazo vencido', tone: 'overdue' });
  });

  it('logrado tiene prioridad sobre el plazo', () => {
    expect(describeObjective(obj({ achievedOn: '2026-10-01', dueDate: '2026-09-01' }), today)).toEqual({ text: 'Logrado el 1 oct', tone: 'done' });
    expect(describeObjective(obj({}), today).text).toBe('Sin fecha límite');
  });

  it('el próximo es el primero pendiente en el orden elegido, no el de plazo más cercano', () => {
    const list = [obj({ id: 'a1', achievedOn: '2026-09-01' }), obj({ id: 'a2', dueDate: '2027-06-01' }), obj({ id: 'b1', dueDate: '2026-11-01' })];
    expect(nextObjective(list)?.id).toBe('a2');
    expect(nextObjective([obj({ achievedOn: '2026-09-01' })])).toBeUndefined();
  });
});

describe('sugerencias', () => {
  it('idiomas: niveles A1…C2, por el nombre (con o sin tildes) o el icono', () => {
    expect(suggestObjectives(makeHabit({ name: 'Aprender Inglés' }))[0]).toBe('Alcanzar el A1');
    expect(suggestObjectives(makeHabit({ name: 'Practicar', icon: 'language' }))).toHaveLength(6);
  });

  it('no repite los que ya tiene', () => {
    const habit = makeHabit({ name: 'Francés', objectives: [obj({ title: 'alcanzar el a1' })] });
    expect(suggestObjectives(habit)[0]).toBe('Alcanzar el A2');
  });

  it('según el tipo de hábito', () => {
    expect(suggestObjectives(makeHabit({ name: 'Correr' }))[0]).toBe('Correr 5 km seguidos');
    expect(suggestObjectives(makeHabit({ name: 'Antes de dormir', categories: ['lectura'] }))[0]).toBe('Terminar un libro');
    expect(suggestObjectives(makeHabit({ name: 'Fumar', kind: 'quit' }))[0]).toBe('Superar la primera semana');
    expect(suggestObjectives(makeHabit({ name: 'Algo' })).length).toBeGreaterThan(0);
  });
});
