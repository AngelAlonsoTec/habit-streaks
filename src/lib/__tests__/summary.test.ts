import { counts, makeHabit, NOW, range, TODAY } from '@/testing/fixtures';
import { fromKey } from '../dates';
import { occurrences, periodRange, summarize } from '../summary';

describe('periodRange', () => {
  const label = (p: Parameters<typeof periodRange>[0], o: number) => periodRange(p, o, NOW).label;

  it('semanas de lunes a domingo, también cruzando meses', () => {
    expect(label('week', 0)).toBe('21 – 27 sep 2026');
    expect(label('week', 1)).toBe('28 sep – 4 oct 2026');
  });

  it('meses, trimestres y años, con cambio de año hacia atrás', () => {
    expect(label('month', 0)).toBe('Septiembre 2026');
    expect(label('month', -9)).toBe('Diciembre 2025');
    expect(label('quarter', 0)).toBe('T3 2026 · jul – sep');
    expect(label('quarter', -3)).toBe('T4 2025 · oct – dic');
    expect(label('year', -1)).toBe('2025');
  });
});

describe('occurrences', () => {
  const week = periodRange('week', 0, NOW);

  it('hoy sin hacer no cuenta como fallo', () => {
    const o = occurrences(makeHabit(), counts(range('2026-09-24', 4)), week.start, week.end, NOW);
    expect(o).toEqual({ scheduled: 4, done: 4, pending: 1 }); // hoy queda pendiente
  });

  it('hoy hecho sí cuenta, y no cuenta nada antes de crear el hábito', () => {
    const habit = makeHabit({ createdAt: new Date(2026, 8, 23, 10).toISOString() });
    const o = occurrences(habit, counts([TODAY]), week.start, week.end, NOW);
    expect(o).toEqual({ scheduled: 3, done: 1, pending: 0 }); // 23, 24 y 25
  });

  it('solo los días que toca', () => {
    const habit = makeHabit({ days: [0, 1, 2, 3, 4] });
    const month = periodRange('month', -1, NOW); // agosto de 2026: 21 días laborables
    expect(occurrences(habit, {}, month.start, month.end, NOW).scheduled).toBe(21);
  });

  it('metas semanales: cada semana cuenta en el periodo de su lunes y la actual no penaliza', () => {
    const habit = makeHabit({ goal: { period: 'week', count: 3 } });
    const data = counts(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-15', '2026-09-22']);
    const month = periodRange('month', 0, NOW);
    const o = occurrences(habit, data, month.start, month.end, NOW);
    // Semanas del 7 (3/3) y del 14 (1/3). La del 31/8 es de agosto; la del 21 está en curso.
    expect(o.scheduled).toBe(2);
    expect(o.done).toBeCloseTo(4 / 3);
    expect(o.pending).toBe(1); // la semana en curso
    expect(occurrences(habit, data, month.start, month.end, NOW, true)).toEqual({ scheduled: 0, done: 0, pending: 0 });
  });
});

describe('summarize', () => {
  const read = makeHabit({ id: 'read', name: 'Leer' });
  const gym = makeHabit({ id: 'gym', name: 'Gimnasio', days: [0, 2, 4] });
  const completions = {
    read: counts(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']),
    gym: counts(['2026-09-21', '2026-09-25']), // falta el miércoles 23
  };

  it('resume la semana: cumplimiento, días perfectos, activos y veces', () => {
    const s = summarize([read, gym], completions, 'week', 0, NOW);
    // Leer 4/4 (hoy no cuenta); Gimnasio: lunes, miércoles y hoy → 2/3.
    expect(s.rate).toBe(86);
    expect(s.habits.map((h) => [h.habit.name, h.rate])).toEqual([['Leer', 100], ['Gimnasio', 67]]);
    expect(s.perfectDays).toBe(3); // lunes, martes y jueves
    expect(s.activeDays).toBe(5);
    expect(s.completions).toBe(6);
    expect(s.elapsedDays).toBe(5);
  });

  it('al dejar: los días sin registros cuentan, pasarse hoy ya es fallo y las recaídas no suman veces', () => {
    const smoke = makeHabit({ id: 'smoke', name: 'Fumar', kind: 'quit', goal: { period: 'day', count: 0 } });
    const clean = summarize([smoke], {}, 'week', 0, NOW);
    expect(clean.habits[0]).toMatchObject({ scheduled: 5, done: 5 }); // lunes a viernes, hoy incluido
    const slipped = summarize([smoke], { smoke: { '2026-09-22': 1, '2026-09-25': 2 } }, 'week', 0, NOW);
    expect(slipped.habits[0]).toMatchObject({ scheduled: 5, done: 3 });
    expect(slipped.completions).toBe(0);
    expect(slipped.activeDays).toBe(0);
    expect(slipped.perfectDays).toBe(3);
  });

  it('cuenta lo pendiente (hoy y la semana en curso) y lo registrado en el periodo', () => {
    const read = makeHabit({ id: 'read', unit: 'min', goal: { period: 'day', count: 20 } });
    const gym = makeHabit({ id: 'gym', goal: { period: 'week', count: 3 } });
    const s = summarize([read, gym], { read: { '2026-09-21': 30, '2026-09-22': 45, '2026-09-14': 99 } }, 'week', 0, NOW);
    expect(s.pending).toBe(2); // leer hoy y la semana del gimnasio
    expect(s.habits.find((h) => h.habit.id === 'read')?.total).toBe(75); // el 14 es de otra semana
  });

  it('lista los objetivos logrados dentro del periodo, del más reciente al más antiguo', () => {
    const objective = (title: string, achievedOn: string | null) => ({ id: title, title, dueDate: null, achievedOn, createdAt: '' });
    const english = makeHabit({
      id: 'en', name: 'Inglés',
      objectives: [objective('A1', '2026-09-22'), objective('A2', '2026-09-24'), objective('B1', '2026-09-14'), objective('B2', null)],
    });
    const s = summarize([english], {}, 'week', 0, NOW);
    expect(s.objectivesAchieved.map((o) => o.title)).toEqual(['A2', 'A1']);
  });

  it('las cantidades no inflan las veces: un día con registro cuenta una vez', () => {
    const steps = makeHabit({ id: 'steps', name: 'Caminar', unit: 'pasos', goal: { period: 'day', count: 10000 } });
    const s = summarize([steps], { steps: { '2026-09-21': 12000, '2026-09-22': 4000 } }, 'week', 0, NOW);
    expect(s.completions).toBe(2);
    expect(s.habits[0]).toMatchObject({ scheduled: 4, done: 1 }); // solo el lunes llegó a la meta
  });

  it('gráfica por día, con los días futuros vacíos y hoy marcado', () => {
    const s = summarize([read, gym], completions, 'week', 0, NOW);
    expect(s.buckets.map((b) => b.label)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    expect(s.buckets.map((b) => b.rate)).toEqual([100, 100, 50, 100, 100, null, null]);
    expect(s.buckets.findIndex((b) => b.current)).toBe(4);
    expect(s.weekdayRates[2]).toBe(50);
    expect(s.dailyRates['2026-09-23']).toBe(0.5);
  });

  it('número de barras según el periodo', () => {
    expect(summarize([read], completions, 'month', 0, NOW).buckets).toHaveLength(30);
    const quarter = summarize([read], completions, 'quarter', 0, NOW).buckets;
    expect(quarter).toHaveLength(14);
    // Solo se etiqueta la semana en que empieza cada mes.
    expect(quarter.map((b) => b.label).filter(Boolean)).toEqual(['jul', 'ago', 'sep']);
    expect(summarize([read], completions, 'year', 0, NOW).buckets).toHaveLength(12);
  });

  it('compara con el periodo anterior', () => {
    const data = { read: counts([...range('2026-09-24', 4), '2026-09-14', '2026-09-16']) };
    const s = summarize([read], data, 'week', 0, NOW);
    expect(s.rate).toBe(100);
    expect(s.previousRate).toBe(29); // 2 de 7
  });

  it('sin hábitos que tocaran, el cumplimiento es null', () => {
    const fresh = makeHabit({ createdAt: new Date(2026, 8, 25, 9).toISOString() });
    const s = summarize([fresh], {}, 'week', -1, NOW);
    expect(s.rate).toBeNull();
    expect(s.buckets.every((b) => b.rate === null)).toBe(true);
    expect(fromKey('2026-09-14').getDay()).toBe(1);
  });
});

describe('summarize · casos límite de calendario', () => {
  const dec30 = new Date(2026, 11, 30, 12); // miércoles

  it('semana que cruza el cambio de año', () => {
    expect(periodRange('week', 0, dec30).label).toBe('28 dic – 3 ene 2027');
    expect(periodRange('quarter', 1, dec30).label).toBe('T1 2027 · ene – mar');
  });

  it('febrero de año bisiesto tiene 29 barras', () => {
    const march2028 = new Date(2028, 2, 10);
    expect(summarize([makeHabit()], {}, 'month', -1, march2028).buckets).toHaveLength(29);
    expect(summarize([makeHabit()], {}, 'month', -1, new Date(2027, 2, 10)).buckets).toHaveLength(28);
  });

  it('una semana que cruza dos meses se cuenta solo en uno (el de su lunes)', () => {
    const weekly = makeHabit({ goal: { period: 'week', count: 1 } });
    const data = counts(['2026-08-31']); // lunes 31/8: esa semana pertenece a agosto
    const aug = periodRange('month', -1, NOW);
    const sep = periodRange('month', 0, NOW);
    const inAug = occurrences(weekly, data, aug.start, aug.end, NOW);
    const inSep = occurrences(weekly, data, sep.start, sep.end, NOW);
    expect(inAug.done).toBe(1);
    expect(inSep.done).toBe(0);
  });

  it('cuenta desde el primer registro si es anterior a la creación del hábito', () => {
    const habit = makeHabit({ createdAt: new Date(2026, 8, 24, 9).toISOString() });
    const week = periodRange('week', 0, NOW);
    // Marcó el lunes 21 aunque creó el hábito el 24: desde el 21 hasta el 24 (hoy no cuenta si no está hecho).
    expect(occurrences(habit, counts(['2026-09-21']), week.start, week.end, NOW)).toEqual({ scheduled: 4, done: 1, pending: 1 });
  });

  it('varias veces al día: un día a medias no cuenta como cumplido', () => {
    const water = makeHabit({ goal: { period: 'day', count: 8 } });
    const s = summarize([water], { h1: { '2026-09-21': 8, '2026-09-22': 5 } }, 'week', 0, NOW);
    expect(s.habits[0]).toMatchObject({ done: 1, scheduled: 4 });
    expect(s.completions).toBe(13);
    expect(s.dailyRates['2026-09-22']).toBe(0);
  });

  it('los días de descanso no entran en el cumplimiento ni en el mapa de constancia', () => {
    const weekdays = makeHabit({ days: [0, 1, 2, 3, 4] });
    const s = summarize([weekdays], {}, 'week', -1, NOW); // semana del 14 al 20
    expect(s.habits[0].scheduled).toBe(5);
    expect(Object.keys(s.dailyRates)).toHaveLength(5);
    expect(s.dailyRates['2026-09-19']).toBeUndefined(); // sábado
    expect(s.buckets[5].rate).toBeNull();
  });

  it('periodos pasados completos: todos los días transcurridos', () => {
    const s = summarize([makeHabit()], {}, 'month', -1, NOW);
    expect(s.elapsedDays).toBe(31);
    expect(s.buckets.every((b) => !b.current)).toBe(true);
    expect(s.rate).toBe(0);
  });

  it('periodo futuro: nada que resumir', () => {
    const s = summarize([makeHabit()], {}, 'week', 1, NOW);
    expect(s.elapsedDays).toBe(0);
    expect(s.rate).toBeNull();
    expect(s.buckets.every((b) => b.rate === null)).toBe(true);
  });

  it('ordena por cumplimiento y deja al final los hábitos sin datos', () => {
    const a = makeHabit({ id: 'a', name: 'A' });
    const b = makeHabit({ id: 'b', name: 'B' });
    const future = makeHabit({ id: 'c', name: 'C', createdAt: new Date(2026, 8, 26).toISOString() });
    const s = summarize([future, a, b], { b: counts(range('2026-09-24', 4)) }, 'week', 0, NOW);
    expect(s.habits.map((h) => h.habit.id)).toEqual(['b', 'a', 'c']);
    expect(s.habits[2].rate).toBeNull();
  });
});
