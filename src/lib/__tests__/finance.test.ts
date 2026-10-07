import {
  abonoState, budgetLevel, byNextCharge, cashFlow, isEnded, outlook, categoriesFor, creditDueDates, creditSummary, paymentAmount, payoutDate, pendingShifts, planDates,
  planProgress, startForPaid, formatHours, parseHours, parseQuantity, sortByUse, describeFrequency, describeFrequencyShort,
  describePeriod, describeWhen, driverStats, dueDates, fixedSummary, fuelEfficiency, fuelStats, isCustomCategory, knownService, lastOdometer,
  mergeCategories, monthlyEquivalent, monthSpent, nextOccurrence, occursOn, periodRange, periodTotals, Recurring, SavingsGoal, savingsPace,
  totalsByCategory, withCatalogCategory, yearlyEquivalent,
} from '../finance';
import { fromKey } from '../dates';
import { makeTx } from '@/testing/fixtures';

const fill = (date: string, amount: number, liters: number | null, odometer: number | null, fullTank = true) =>
  makeTx({ categoryId: 'gasolina', date, amount, fuel: { liters, odometer, fullTank } });

const shift = (date: string, amount: number, platform: string, hours: number | null, trips: number | null) =>
  makeTx({ kind: 'income', categoryId: 'viajes', date, amount, shift: { platforms: [{ platform, amount, trips }], hours } });

const recurring = (r: Partial<Recurring>): Recurring => ({
  id: 'r1', kind: 'expense', name: 'Renta', amount: 5000, categoryId: 'renta', frequency: 'monthly', day: 1,
  startDate: '2026-01-01', lastApplied: null, createdAt: '2026-01-01T09:00:00.000Z', ...r,
});

const goal = (g: Partial<SavingsGoal>): SavingsGoal => ({
  id: 'g1', name: 'Viaje', icon: 'airplane', color: '#3B82F6', target: 12000, dueDate: null, deposits: [],
  achievedOn: null, createdAt: '2026-01-01T09:00:00.000Z', ...g,
});

describe('categorías por perfil', () => {
  it('cada perfil trae lo suyo y todos tienen "Otros" para reubicar', () => {
    const driver = categoriesFor(['driver']).map((c) => c.id);
    expect(driver).toEqual(expect.arrayContaining(['viajes', 'gasolina', 'mantenimiento', 'otros-ingresos', 'otros-gastos']));
    expect(driver).not.toContain('sueldo');
    for (const p of ['worker', 'student', 'driver'] as const) {
      const ids = categoriesFor([p]).map((c) => c.id);
      expect(ids).toEqual(expect.arrayContaining(['otros-ingresos', 'otros-gastos']));
    }
  });

  it('combinar perfiles une sus categorías sin repetir', () => {
    const ids = categoriesFor(['student', 'driver']).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['mesada', 'beca', 'viajes', 'gasolina', 'escuela']));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('al añadir un perfil se suman sus categorías y las propias siguen al final', () => {
    const custom = { id: 'custom-1', name: 'Mascota', icon: 'paw' as const, color: '#64748B', kind: 'expense' as const };
    const merged = mergeCategories([...categoriesFor(['student']), custom], ['student', 'driver']);
    expect(merged.at(-1)).toEqual(custom);
    expect(merged.map((c) => c.id)).toContain('viajes');
    expect(isCustomCategory('custom-1')).toBe(true);
    expect(isCustomCategory('comida')).toBe(false);
  });
});

describe('periodos', () => {
  it('la semana va de lunes a domingo y el mes es natural', () => {
    expect(periodRange('week', 0, '2026-10-07')).toEqual({ start: '2026-10-05', end: '2026-10-11' });
    expect(periodRange('week', -1, '2026-10-05')).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(periodRange('month', 0, '2026-10-31')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(periodRange('month', -8, '2028-10-15')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('nombres legibles', () => {
    expect(describePeriod('week', 0, '2026-10-07')).toBe('Esta semana');
    expect(describePeriod('week', -1, '2026-10-07')).toBe('Semana pasada');
    expect(describePeriod('week', -2, '2026-10-07')).toBe('21 – 27 sep');
    expect(describePeriod('week', -2, '2026-10-19')).toBe('5 – 11 oct');
    expect(describePeriod('week', -2, '2026-10-12')).toBe('28 sep – 4 oct');
    expect(describePeriod('month', 0, '2026-10-07')).toBe('Octubre');
    expect(describePeriod('month', -10, '2026-10-07')).toBe('Diciembre 2025');
  });
});

describe('totales', () => {
  const range = { start: '2026-10-01', end: '2026-10-31' };

  it('ingresos, gastos, ahorro y balance, con los bordes del periodo incluidos', () => {
    const txs = [
      makeTx({ kind: 'income', categoryId: 'sueldo', amount: 9000, date: '2026-10-01' }),
      makeTx({ amount: 1200.5, date: '2026-10-31' }),
      makeTx({ amount: 999, date: '2026-09-30' }), // fuera
      makeTx({ amount: 300, date: '2026-11-01' }), // fuera
    ];
    const goals = [goal({ deposits: [{ id: 'd1', date: '2026-10-15', amount: 2000 }, { id: 'd2', date: '2026-10-20', amount: -500 }] })];
    expect(periodTotals(txs, goals, range)).toEqual({ income: 9000, expense: 1200.5, saved: 1500, balance: 6299.5 });
  });

  it('por categoría, de mayor a menor', () => {
    const txs = [
      makeTx({ categoryId: 'comida', amount: 150, date: '2026-10-02' }),
      makeTx({ categoryId: 'ocio', amount: 500, date: '2026-10-03' }),
      makeTx({ categoryId: 'comida', amount: 400, date: '2026-10-04' }),
    ];
    expect(totalsByCategory(txs, 'expense', range)).toEqual([
      { categoryId: 'comida', amount: 550, count: 2 },
      { categoryId: 'ocio', amount: 500, count: 1 },
    ]);
  });

  it('lo gastado en el mes de una categoría, sin contar el que se edita', () => {
    const txs = [
      makeTx({ id: 'a', amount: 200, date: '2026-10-02' }),
      makeTx({ id: 'b', amount: 300, date: '2026-10-20' }),
      makeTx({ id: 'c', amount: 999, date: '2026-09-30' }),
    ];
    expect(monthSpent(txs, 'comida', '2026-10-25')).toBe(500);
    expect(monthSpent(txs, 'comida', '2026-10-25', 'b')).toBe(200);
  });

  it('el presupuesto avisa desde el 80 % y se pasa solo por encima del 100 %', () => {
    expect(budgetLevel(799.99, 1000)).toBe('ok');
    expect(budgetLevel(800, 1000)).toBe('near');
    expect(budgetLevel(1000, 1000)).toBe('near');
    expect(budgetLevel(1000.01, 1000)).toBe('over');
  });
});

describe('conductor', () => {
  const range = { start: '2026-10-05', end: '2026-10-11' };

  it('por plataforma, por hora y por viaje, solo con las jornadas que los apuntaron', () => {
    const txs = [
      shift('2026-10-05', 1200, 'Uber', 8, 15),
      shift('2026-10-06', 900, 'Uber', 6, null),
      shift('2026-10-06', 600, 'DiDi', null, 8),
      fill('2026-10-06', 700, 30, null),
      makeTx({ categoryId: 'lavado', amount: 100, date: '2026-10-07' }),
      makeTx({ categoryId: 'comida', amount: 250, date: '2026-10-07' }), // no es del auto
    ];
    const s = driverStats(txs, range);
    expect(s.platforms.map((p) => p.platform)).toEqual(['Uber', 'DiDi']);
    expect(s.platforms[0]).toMatchObject({ income: 2100, hours: 14, trips: 15, perHour: 150, perTrip: 80, shifts: 2 });
    expect(s.platforms[1]).toMatchObject({ income: 600, hours: 0, trips: 8, perHour: null, perTrip: 75 });
    expect(s).toMatchObject({ income: 2700, vehicleCosts: 800, net: 1900, hours: 14, trips: 23, perHour: 150 });
    // Neto por hora: (lo ganado en las jornadas con horas − gastos del auto) / horas.
    expect(s.netPerHour).toBe(92.86);
    expect(s.perTrip).toBe(78.26);
  });

  it('sin jornadas no hay cifras por hora', () => {
    expect(driverStats([fill('2026-10-06', 500, 20, null)], range)).toMatchObject({ platforms: [], perHour: null, net: -500 });
  });
});

describe('gasolina', () => {
  it('gasto, litros y precio medio del periodo (sin contar las cargas sin litros en el precio)', () => {
    const txs = [fill('2026-10-02', 800, 33.5, null), fill('2026-10-09', 700, 29, null), fill('2026-10-12', 300, null, null)];
    expect(fuelStats(txs, { start: '2026-10-01', end: '2026-10-31' })).toEqual({ spent: 1800, liters: 62.5, fills: 3, pricePerLiter: 24 });
  });

  it('rendimiento entre cargas llenas', () => {
    const e = fuelEfficiency([fill('2026-10-01', 800, 33, 45230), fill('2026-10-05', 700, 29, 45580)]);
    expect(e).toEqual({ kmPerLiter: 12.1, costPerKm: 2, km: 350, intervals: 1, estimated: false });
  });

  it('una carga parcial en medio suma sus litros al tramo', () => {
    const e = fuelEfficiency([
      fill('2026-10-01', 800, 33, 10000),
      fill('2026-10-03', 200, 8, 10120, false),
      fill('2026-10-05', 500, 22, 10360),
    ]);
    expect(e).toMatchObject({ km: 360, kmPerLiter: 12, costPerKm: 1.94 });
  });

  it('una carga sin litros corta la cuenta; una llena sin kilometraje se salva con la aproximación', () => {
    expect(fuelEfficiency([fill('2026-10-01', 800, 33, 10000), fill('2026-10-03', 200, null, null, false), fill('2026-10-05', 500, 22, 10360)])).toBeNull();
    // Lleno a 10000 km y lleno a 10360 km: lo gastado son los 25 + 22 litros de después.
    expect(fuelEfficiency([fill('2026-10-01', 800, 33, 10000), fill('2026-10-03', 600, 25, null), fill('2026-10-05', 500, 22, 10360)]))
      .toMatchObject({ kmPerLiter: 7.7, km: 360, estimated: true });
  });

  it('quien nunca llena el tanque ("póngale 300") tiene un rendimiento aproximado', () => {
    const txs = [0, 1, 2, 3, 4, 5].map((i) => fill(`2026-10-0${i + 1}`, 300, 12.4, 10000 + i * 140, false));
    expect(fuelEfficiency(txs)).toEqual({ kmPerLiter: 11.3, costPerKm: 2.14, km: 700, intervals: 5, estimated: true });
    // Con pocos datos no se inventa nada.
    expect(fuelEfficiency(txs.slice(0, 2))).toBeNull();
    expect(fuelEfficiency([fill('2026-10-01', 300, 12, 10000, false), fill('2026-10-02', 300, 12, 10100, false), fill('2026-10-03', 300, 12, 10200, false)])).toBeNull();
  });

  it('ignora un kilometraje mal escrito y se queda con los últimos tramos', () => {
    const txs = [
      fill('2026-09-01', 800, 30, 1000),
      fill('2026-09-08', 800, 30, 1360), // 12 km/l
      fill('2026-09-15', 800, 30, 91360), // 3000 km/l: un cero de más
      fill('2026-09-22', 800, 30, 91720), // 12 km/l
    ];
    expect(fuelEfficiency(txs)).toMatchObject({ kmPerLiter: 12, intervals: 2 });
    expect(fuelEfficiency(txs, undefined, 1)).toMatchObject({ km: 360, intervals: 1 });
    expect(fuelEfficiency(txs, '2026-09-10')).toMatchObject({ km: 360, intervals: 1 });
    expect(fuelEfficiency([fill('2026-09-01', 800, 30, 1000)])).toBeNull();
  });

  it('último kilometraje anterior a la fecha, sin contar la carga que se edita', () => {
    const txs = [fill('2026-10-01', 800, 30, 1000), { ...fill('2026-10-05', 800, 30, 1400), id: 'edit' }, fill('2026-10-09', 800, 30, 1800)];
    expect(lastOdometer(txs, '2026-10-06')).toBe(1400);
    expect(lastOdometer(txs, '2026-10-06', 'edit')).toBe(1000);
    expect(lastOdometer(txs, '2026-09-30')).toBeNull();
  });
});

describe('fijos', () => {
  it('el día 31 cae en el último día de los meses cortos (también en bisiesto)', () => {
    const r = { frequency: 'monthly' as const, day: 31, startDate: '2026-01-01' };
    expect(occursOn(r, fromKey('2027-02-28'))).toBe(true);
    expect(occursOn(r, fromKey('2028-02-28'))).toBe(false);
    expect(occursOn(r, fromKey('2028-02-29'))).toBe(true);
    expect(occursOn(r, fromKey('2026-04-30'))).toBe(true);
    expect(occursOn(r, fromKey('2026-05-30'))).toBe(false);
  });

  it('la quincena es el 15 y el último día', () => {
    const r = { frequency: 'biweekly' as const, day: 0, startDate: '2026-01-01' };
    expect(['2027-02-14', '2027-02-15', '2027-02-27', '2027-02-28'].map((k) => occursOn(r, fromKey(k)))).toEqual([false, true, false, true]);
  });

  it('pone al día lo que tocaba desde lo último registrado', () => {
    const rent = recurring({ day: 1, startDate: '2026-07-10', lastApplied: '2026-07-10' });
    expect(dueDates(rent, '2026-10-06')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    expect(dueDates({ ...rent, lastApplied: '2026-10-06' }, '2026-10-06')).toEqual([]);
    // Recién creado: cuenta desde el día de inicio, incluido.
    expect(dueDates(recurring({ frequency: 'weekly', day: 1, startDate: '2026-10-06' }), '2026-10-06')).toEqual(['2026-10-06']);
  });

  it('si la app no se abrió en años, se pone al día como mucho dos años', () => {
    const r = recurring({ day: 1, startDate: '2020-01-01', lastApplied: '2020-01-01' });
    expect(dueDates(r, '2026-10-06')).toHaveLength(24);
  });

  it('próxima fecha y textos', () => {
    const r = recurring({ frequency: 'weekly', day: 0, startDate: '2026-10-06' });
    expect(nextOccurrence(r, '2026-10-06')).toBe('2026-10-12');
    expect(nextOccurrence(recurring({ day: 31 }), '2027-02-10')).toBe('2027-02-28');
    expect(describeFrequency({ frequency: 'weekly', day: 2 })).toBe('Cada semana, los miércoles');
    expect(describeFrequency({ frequency: 'monthly', day: 31 })).toBe('Cada mes, el último día');
    expect(describeFrequencyShort({ frequency: 'weekly', day: 5 })).toBe('Cada sábado');
    expect(describeFrequencyShort({ frequency: 'monthly', day: 6 })).toBe('El 6 de cada mes');
  });

  it('equivalente mensual', () => {
    expect(monthlyEquivalent({ frequency: 'weekly', amount: 2500 })).toBe(10833.33);
    expect(monthlyEquivalent({ frequency: 'biweekly', amount: 6000 })).toBe(12000);
    expect(monthlyEquivalent({ frequency: 'monthly', amount: 5000 })).toBe(5000);
  });
});

describe('metas de ahorro', () => {
  it('sin fecha solo dice lo que falta', () => {
    expect(savingsPace(goal({ deposits: [{ id: 'd', date: '2026-10-01', amount: 2000 }] }), '2026-10-06')).toEqual({
      remaining: 10000, perWeek: null, perMonth: null, daysLeft: null, overdue: false,
    });
  });

  it('"en 6 meses" son 6 pagos redondos; si ya abonaste este mes, quedan 5', () => {
    expect(savingsPace(goal({ target: 15000, dueDate: '2027-04-06' }), '2026-10-06').perMonth).toBe(2500);
    const paid = goal({ target: 15000, dueDate: '2027-04-06', deposits: [{ id: 'd', date: '2026-10-06', amount: 2500 }] });
    expect(savingsPace(paid, '2026-10-06').perMonth).toBe(2500);
  });

  it('a fin de año desde octubre: 3 pagos', () => {
    expect(savingsPace(goal({ target: 15000, dueDate: '2026-12-31' }), '2026-10-06').perMonth).toBe(5000);
  });

  it('con menos de dos meses, por semana', () => {
    const p = savingsPace(goal({ target: 4000, dueDate: '2026-11-03' }), '2026-10-06');
    expect(p).toMatchObject({ perWeek: 1000, perMonth: null, daysLeft: 28 });
  });

  it('vencida, el día límite y lograda', () => {
    expect(savingsPace(goal({ dueDate: '2026-10-01' }), '2026-10-06')).toMatchObject({ overdue: true, remaining: 12000 });
    expect(savingsPace(goal({ dueDate: '2026-10-06' }), '2026-10-06')).toMatchObject({ overdue: false, daysLeft: 0 });
    expect(savingsPace(goal({ dueDate: '2026-12-01', deposits: [{ id: 'd', date: '2026-10-01', amount: 13000 }] }), '2026-10-06'))
      .toMatchObject({ remaining: 0, perMonth: null, overdue: false });
  });
});

describe('lo que se escribe a mano', () => {
  it.each([
    ['8', 8], ['8.5', 8.5], ['8,5', 8.5], ['8:30', 8.5], ['8h', 8], ['8 h', 8], ['8 h 30', 8.5], ['8h30min', 8.5],
    ['10 horas', 10], ['0:45', 0.75], ['45 min', 0.75], ['8:20', 8.33], ['8.5 h', 8.5],
  ])('horas: %p son %p', (text, expected) => {
    expect(parseHours(text, 'MXN')).toBe(expected);
  });

  it.each(['ocho', '8:75', '0', '', 'h'])('horas: rechaza %p', (text) => {
    expect(parseHours(text, 'MXN')).toBeNull();
  });

  it('litros, kilómetros y viajes con su unidad detrás', () => {
    expect(parseQuantity('30 lts', 'MXN')).toBe(30);
    expect(parseQuantity('41.5 litros', 'MXN')).toBe(41.5);
    expect(parseQuantity('45,230 km', 'MXN', true)).toBe(45230);
    expect(parseQuantity('45230km', 'MXN', true)).toBe(45230);
    expect(parseQuantity('17 viajes', 'MXN', true)).toBe(17);
    expect(parseQuantity('45.230 km', 'EUR', true)).toBe(45230);
    expect(parseQuantity('treinta', 'MXN')).toBeNull();
  });

  it('horas legibles', () => {
    expect(formatHours(8)).toBe('8 h');
    expect(formatHours(8.5)).toBe('8 h 30 min');
    expect(formatHours(56.5)).toBe('56 h 30 min');
    expect(formatHours(0.75)).toBe('45 min');
  });
});

describe('dos apps a la vez', () => {
  it('las horas cuentan una vez y por plataforma solo se da lo que se puede saber', () => {
    const both = makeTx({
      kind: 'income', categoryId: 'viajes', amount: 1800, date: '2026-10-05',
      shift: { platforms: [{ platform: 'Uber', amount: 1200, trips: 14 }, { platform: 'DiDi', amount: 600, trips: 7 }], hours: 9 },
    });
    const soloDiDi = shift('2026-10-06', 700, 'DiDi', 5, 9);
    const s = driverStats([both, soloDiDi], { start: '2026-10-05', end: '2026-10-11' });
    expect(s).toMatchObject({ income: 2500, hours: 14, trips: 30 });
    expect(s.perHour).toBe(178.57);
    // Uber solo se usó junto con DiDi: por viaje sí, por hora no.
    expect(s.platforms.find((p) => p.platform === 'Uber')).toMatchObject({ income: 1200, trips: 14, perTrip: 85.71, perHour: null, hours: 0 });
    // DiDi también se usó acompañada un día: tampoco por hora.
    expect(s.platforms.find((p) => p.platform === 'DiDi')).toMatchObject({ income: 1300, trips: 16, perHour: null, shifts: 2 });
  });
});

describe('bimestrales', () => {
  const luz = { frequency: 'bimonthly' as const, day: 18, startDate: '2026-10-01' };

  it('un mes sí y otro no, desde el mes de inicio', () => {
    expect(['2026-10-18', '2026-11-18', '2026-12-18', '2027-01-18', '2027-02-18'].map((k) => occursOn(luz, fromKey(k))))
      .toEqual([true, false, true, false, true]);
    expect(dueDates(recurring({ ...luz, lastApplied: null }), '2027-03-01')).toEqual(['2026-10-18', '2026-12-18', '2027-02-18']);
    expect(nextOccurrence(luz, '2026-10-19')).toBe('2026-12-18');
    expect(describeFrequency(luz)).toBe('Cada dos meses, el día 18');
    expect(describeFrequencyShort(luz)).toBe('El 18, cada 2 meses');
    expect(monthlyEquivalent({ frequency: 'bimonthly', amount: 680 })).toBe(340);
  });

  it('el día 31 en meses cortos cae en el último día', () => {
    expect(occursOn({ frequency: 'bimonthly', day: 31, startDate: '2026-12-01' }, fromKey('2027-02-28'))).toBe(true);
  });
});

describe('categorías por uso', () => {
  it('las más usadas en los últimos 90 días van primero', () => {
    const cats = categoriesFor(['worker']).filter((c) => c.kind === 'expense');
    const txs = [
      ...[1, 2, 3].map((d) => makeTx({ categoryId: 'transporte', date: `2026-10-0${d}` })),
      ...[1, 2].map((d) => makeTx({ categoryId: 'comida', date: `2026-10-0${d}` })),
      ...[1, 2, 3, 4, 5].map((d) => makeTx({ categoryId: 'ropa', date: `2026-0${d}-01` })), // hace más de 90 días
    ];
    const sorted = sortByUse(cats, txs, '2026-10-06').map((c) => c.id);
    expect(sorted.slice(0, 2)).toEqual(['transporte', 'comida']);
    // El resto, en su orden de siempre.
    expect(sorted.slice(2)).toEqual(cats.map((c) => c.id).filter((id) => id !== 'transporte' && id !== 'comida'));
  });
});

describe('gastos fijos y suscripciones', () => {
  it('reconoce los servicios por su nombre, como sea que se escriba', () => {
    expect(knownService('Netflix')?.name).toBe('Netflix');
    expect(knownService('netflix premium')?.name).toBe('Netflix');
    expect(knownService('Disney Plus')?.name).toBe('Disney+');
    expect(knownService('HBO')?.name).toBe('HBO Max');
    expect(knownService('Max')?.name).toBe('HBO Max');
    expect(knownService('PS Plus')?.name).toBe('PlayStation Plus');
    expect(knownService('Spotify Familiar')?.name).toBe('Spotify');
    // Lo que solo se le parece, no.
    for (const name of ['Maxi despensa', 'Primer pago', 'Renta', 'Uber', 'Melissa', '  ']) expect(knownService(name)).toBeNull();
  });

  it('cuánto se llevan este mes: lo ya cobrado, lo que falta y lo que empieza después', () => {
    const list = [
      recurring({ id: 'a', name: 'Renta', amount: 5000, day: 1 }),
      recurring({ id: 'b', name: 'Netflix', amount: 219, categoryId: 'suscripciones', day: 20 }),
      // Creado el 5 para el día 2: este mes ya no toca, empieza en noviembre.
      recurring({ id: 'c', name: 'Spotify', amount: 129, categoryId: 'suscripciones', day: 2, startDate: '2026-10-05' }),
      recurring({ id: 'd', kind: 'income', name: 'Sueldo', amount: 9000, categoryId: 'sueldo', frequency: 'biweekly', day: 0 }),
      // Los lunes: 5, 12, 19 y 26 de octubre.
      recurring({ id: 'e', name: 'Renta del auto', amount: 2500, categoryId: 'renta-auto', frequency: 'weekly', day: 0 }),
    ];
    expect(fixedSummary(list, '2026-10-06')).toEqual({
      month: 15219, paid: 7500, pending: 7719, perMonth: 16181.33, perYear: 194176, subscriptions: 348,
    });
    expect(fixedSummary([], '2026-10-06')).toEqual({ month: 0, paid: 0, pending: 0, perMonth: 0, perYear: 0, subscriptions: 0 });
  });

  it('en el orden en que se cobran, y cuándo, en corto', () => {
    const list = [recurring({ id: 'a', name: 'Renta', day: 1 }), recurring({ id: 'b', name: 'Netflix', day: 8 }), recurring({ id: 'c', name: 'Agua', day: 8 })];
    expect(byNextCharge(list, '2026-10-06').map((x) => [x.recurring.name, x.date])).toEqual([
      ['Agua', '2026-10-08'], ['Netflix', '2026-10-08'], ['Renta', '2026-11-01'],
    ]);
    expect(describeWhen('2026-10-07', '2026-10-06')).toBe('mañana');
    expect(describeWhen('2026-10-09', '2026-10-06')).toBe('en 3 días');
    expect(describeWhen('2026-10-20', '2026-10-06')).toBe('el 20 oct');
    expect(yearlyEquivalent({ frequency: 'biweekly', amount: 6000 })).toBe(144000);
    expect(yearlyEquivalent({ frequency: 'bimonthly', amount: 450 })).toBe(2700);
  });

  it('el conductor también tiene renta, servicios y suscripciones', () => {
    expect(categoriesFor(['driver']).map((c) => c.id)).toEqual(expect.arrayContaining(['renta', 'servicios', 'suscripciones']));
  });

  it('elegir Netflix sin tener "Suscripciones" la añade en su sitio', () => {
    const before = categoriesFor(['driver']).filter((c) => c.id !== 'suscripciones');
    const after = withCatalogCategory(before, 'suscripciones');
    const ids = after.map((c) => c.id);
    expect(ids.indexOf('suscripciones')).toBe(ids.indexOf('otros-gastos') - 1);
    expect(withCatalogCategory(after, 'suscripciones')).toBe(after);
    expect(withCatalogCategory(before, 'custom-x')).toBe(before);
  });
});

describe('jornadas: el dinero cuenta cuando llega', () => {
  const payouts = { Uber: 0 };
  // Sábado 10 de octubre: Uber (paga el lunes) e inDrive (en efectivo).
  const saturday = makeTx({
    id: 's', kind: 'income', categoryId: 'viajes', date: '2026-10-10', amount: 1600,
    shift: { hours: 8, platforms: [{ platform: 'Uber', amount: 1200, trips: 14 }, { platform: 'inDrive', amount: 400, trips: 5 }] },
  });
  const cash = (today: string, t = saturday) =>
    cashFlow([t], payouts, today).map((x) => [x.date, x.amount]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  it('Uber paga el lunes siguiente a la jornada; lo demás, al momento', () => {
    expect(payoutDate('2026-10-10', 0)).toBe('2026-10-12');
    expect(payoutDate('2026-10-12', 0)).toBe('2026-10-19'); // la del lunes, al lunes siguiente
    expect(payoutDate('2026-10-10', undefined)).toBe('2026-10-10');
  });

  it('hasta el lunes, lo de Uber va por cobrar y no cuenta en el balance', () => {
    expect(cash('2026-10-11')).toEqual([['2026-10-10', 400]]);
    expect(pendingShifts([saturday], payouts, '2026-10-11')).toEqual([
      expect.objectContaining({ amount: 1200, date: '2026-10-12', platforms: ['Uber'] }),
    ]);
    // El lunes llega y cuenta ese día.
    expect(cash('2026-10-12')).toEqual([['2026-10-10', 400], ['2026-10-12', 1200]]);
    expect(pendingShifts([saturday], payouts, '2026-10-12')).toEqual([]);
  });

  it('si se lo pagaron antes, cuenta desde ese día', () => {
    const paid = { ...saturday, shift: { ...saturday.shift!, paidOn: '2026-10-11' } };
    expect(cash('2026-10-11', paid)).toEqual([['2026-10-10', 400], ['2026-10-11', 1200]]);
    expect(pendingShifts([paid], payouts, '2026-10-11')).toEqual([]);
  });
});

describe('fijos con número de pagos', () => {
  const loan = recurring({ name: 'Préstamo', amount: 1250, day: 15, count: 4, startDate: '2026-09-15' });

  it('cuatro meses: sus fechas, cuántos van, cuánto falta y cuándo termina', () => {
    expect(planDates(loan)).toEqual(['2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15']);
    expect(planProgress(loan, '2026-10-06')).toEqual({ count: 4, paid: 1, remaining: 3, owed: 3750, lastDate: '2026-12-15', finished: false });
    expect(nextOccurrence(loan, '2026-11-20')).toBe('2026-12-15');
    expect(nextOccurrence(loan, '2026-12-15')).toBeNull();
    expect(dueDates({ ...loan, lastApplied: '2026-09-15' }, '2027-03-01')).toEqual(['2026-10-15', '2026-11-15', '2026-12-15']);
    expect(planProgress(recurring({}), '2026-10-06')).toBeNull(); // sin fin
  });

  it('dos quincenas desde una fecha: el 15 y el fin de mes que siguen', () => {
    expect(planDates({ frequency: 'biweekly', day: 0, startDate: '2026-10-06', count: 2 })).toEqual(['2026-10-15', '2026-10-31']);
  });

  it('con un total, el último pago ajusta los centavos', () => {
    const r = recurring({ amount: 333.33, total: 1000, count: 3 });
    expect([0, 1, 2].map((i) => paymentAmount(r, i))).toEqual([333.33, 333.33, 333.34]);
  });

  it('liquidado antes de tiempo: ya no toca nada después', () => {
    const settled = { ...loan, endedOn: '2026-10-20' };
    expect(planProgress(settled, '2026-10-20')).toMatchObject({ finished: true, owed: 0 });
    expect(nextOccurrence(settled, '2026-10-20')).toBeNull();
    expect(dueDates({ ...settled, lastApplied: '2026-10-20' }, '2026-12-31')).toEqual([]);
    expect(byNextCharge([settled, recurring({ id: 'r2' })], '2026-10-20').map((x) => x.recurring.id)).toEqual(['r2']);
  });
});

describe('créditos', () => {
  const tv = recurring({ id: 'tv', name: 'Tele', amount: 1000, total: 3000, count: 3, day: 15, startDate: '2026-09-15', creditId: 'c1' });
  const shoes = recurring({ id: 'tenis', name: 'Tenis', amount: 400, total: 2400, count: 6, day: 15, startDate: '2026-10-15', creditId: 'c1' });

  it('el próximo pago suma lo que toca de cada compra, aunque cambie cada mes', () => {
    expect(creditSummary('c1', [tv, shoes, recurring({ id: 'otro' })], '2026-10-06')).toMatchObject({
      next: '2026-10-15', nextAmount: 1400, owed: 4400, lastDate: '2027-03-15',
    });
    // En noviembre se termina la tele: en diciembre ya solo tocan los tenis.
    const december = creditSummary('c1', [tv, shoes], '2026-11-20');
    expect(december).toMatchObject({ next: '2026-12-15', nextAmount: 400 });
    expect(december.finished.map((r) => r.id)).toEqual(['tv']);
  });

  it('fechas de pago desde mañana, y una compra que ya se venía pagando', () => {
    expect(creditDueDates(15, '2026-10-06')).toEqual(['2026-10-15', '2026-11-15']);
    expect(creditDueDates(6, '2026-10-06')).toEqual(['2026-11-06', '2026-12-06']); // lo de hoy no se paga hoy
    expect(creditDueDates(31, '2026-11-06')).toEqual(['2026-11-30', '2026-12-31']);
    expect(startForPaid(15, '2026-10-06', 2)).toBe('2026-08-15'); // pagó agosto y septiembre; sigue octubre
  });
});

describe('abonos y dejar de pagar', () => {
  it('abonos: lo que tocaba y no se abonó, el próximo, lo abonado y lo que falta', () => {
    const loan = recurring({
      id: 'tio', name: 'Préstamo', variable: true, amount: 500, total: 3000, frequency: 'biweekly', day: 0,
      startDate: '2026-09-01', lastApplied: '2026-09-30',
    });
    const paid = [makeTx({ amount: 800, date: '2026-09-15', recurringId: 'tio' }), makeTx({ amount: 400, date: '2026-09-30', recurringId: 'tio' })];
    expect(abonoState(loan, paid, '2026-10-20')).toEqual({ overdue: ['2026-10-15'], next: '2026-10-31', paid: 1200, owed: 1800, suggested: 500 });
    // Si abonó por adelantado (ya cubrió el 31), el próximo es el 15 de noviembre.
    expect(nextOccurrence({ ...loan, lastApplied: '2026-10-31' }, '2026-10-20')).toBe('2026-11-15');
    // Casi pagado: lo sugerido no pasa de lo que falta.
    expect(abonoState(loan, [...paid, makeTx({ amount: 1700, recurringId: 'tio' })], '2026-10-20').suggested).toBe(100);
  });

  it('dejar de pagar: después de su último cobro ya no toca nada', () => {
    const claude = recurring({ name: 'Claude', amount: 400, day: 6, startDate: '2026-06-06', endedOn: '2026-09-06', endKind: 'cancelled' });
    expect(isEnded(claude, '2026-10-06')).toBe(true);
    expect(nextOccurrence(claude, '2026-10-06')).toBeNull();
    // Si el último cobro aún no llega (ya lo pagó este mes), sigue hasta entonces.
    expect(isEnded({ ...claude, endedOn: '2026-11-06' }, '2026-10-06')).toBe(false);
    expect(nextOccurrence({ ...claude, endedOn: '2026-11-06' }, '2026-10-06')).toBe('2026-11-06');
  });
});

describe('lo que viene', () => {
  const rent = recurring({ id: 'renta', amount: 4500, day: 1, startDate: '2026-09-01', lastApplied: '2026-10-06' });
  const salary = recurring({
    id: 'sueldo', kind: 'income', name: 'Sueldo', amount: 6000, categoryId: 'sueldo', frequency: 'biweekly', day: 0,
    startDate: '2026-09-01', lastApplied: '2026-10-06',
  });
  const netflix = recurring({ id: 'nf', name: 'Netflix', amount: 219, categoryId: 'suscripciones', day: 20, startDate: '2026-09-01', lastApplied: '2026-10-06' });
  const phone = recurring({ id: 'cel', name: 'Celular', amount: 1000, total: 3000, count: 3, day: 15, startDate: '2026-10-15', creditId: 'c1' });
  const txs = [makeTx({ amount: 300, date: '2026-10-01' }), makeTx({ amount: 4500, categoryId: 'renta', date: '2026-10-01', recurringId: 'renta' })];

  it('cómo cierra el mes: lo que hay, lo que falta por entrar y salir y el gasto del día a día', () => {
    const o = outlook({ cash: txs, transactions: txs, recurring: [rent, salary, netflix, phone], goals: [], pending: [], today: '2026-10-06' });
    // Hoy: −300 de comida y −4500 de renta. Faltan las dos quincenas, Netflix y la mensualidad del celular.
    // Día a día: 300 en los 7 días desde que empezó a apuntar = 42.86 al día, por 25 días.
    expect(o).toMatchObject({ balance: -4800, incoming: 12000, outgoing: 1219, dailySpend: 42.86, daysLeft: 25, debt: 3000, debtEnds: '2026-12-15' });
    expect(o.projected).toBe(4909.5); // −4800 + 12000 − 1219 − 1071.50
    // Pero lleva 6 días apuntando: aún no es para fiarse del día a día.
    expect(o).toMatchObject({ recordedDays: 6, ready: false });
    expect(o.committed).toBe(5719);
    // Mes a mes: la mensualidad del celular se acaba en diciembre.
    expect(o.months.slice(0, 4).map((m) => [m.key, m.fixed, m.debts])).toEqual([
      ['2026-10', 4719, 1000], ['2026-11', 4719, 1000], ['2026-12', 4719, 1000], ['2027-01', 4719, 0],
    ]);
  });

  it('lo que se debe por abonos se va acabando mes a mes (no se cuenta de más)', () => {
    const loan = recurring({ id: 'tio', name: 'Préstamo', variable: true, amount: 1000, total: 2500, day: 15, startDate: '2026-10-15' });
    const o = outlook({ cash: [], transactions: [], recurring: [loan], goals: [], pending: [], today: '2026-10-06' });
    expect(o.months.slice(0, 4).map((m) => m.debts)).toEqual([1000, 1000, 500, 0]);
    expect(o).toMatchObject({ debt: 2500, outgoing: 1000 });
  });

  it('un solo gasto el primer día no se toma como el gasto de cada día', () => {
    // Llena el tanque (650) el día que empieza a usar la app: 650 / 7 = 92.86 al día por 24 días daría −2,879.
    const gas = [makeTx({ amount: 650, categoryId: 'gasolina', date: '2026-10-07' })];
    const o = outlook({ cash: gas, transactions: gas, recurring: [], goals: [], pending: [], today: '2026-10-07' });
    expect(o).toMatchObject({ balance: -650, recordedDays: 1, ready: false });
    // Una semana después ya se puede calcular.
    expect(outlook({ cash: gas, transactions: gas, recurring: [], goals: [], pending: [], today: '2026-10-13' })).toMatchObject({ recordedDays: 7, ready: true });
  });

  it('lo que se gana suelto también cuenta, y lo de cada app solo si llega antes de fin de mes', () => {
    // Una semana de jornadas (lunes 5 a domingo 11): Uber 7,000 (paga los lunes), inDrive 700 (efectivo).
    const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].map((date) => makeTx({
      kind: 'income', categoryId: 'viajes', date, amount: 1100,
      shift: { hours: 9, platforms: [{ platform: 'Uber', amount: 1000, trips: 12 }, { platform: 'inDrive', amount: 100, trips: 2 }] },
    }));
    const gas = [makeTx({ amount: 1400, categoryId: 'gasolina', date: '2026-10-05' })];
    const all = [...week, ...gas];
    const payouts = { Uber: 0 };
    const today = '2026-10-11';
    const o = outlook({ cash: cashFlow(all, payouts, today), transactions: all, recurring: [], goals: [], pending: pendingShifts(all, payouts, today), today, payouts });
    expect(o).toMatchObject({ recordedDays: 7, ready: true, dailyIncome: 1100, dailySpend: 200, daysLeft: 20 });
    // Faltan 20 días (12 al 31). inDrive llega al momento: 100 × 20. Lo de Uber del 12 al 25 llega a más
    // tardar el lunes 26 (1,000 × 14); lo del 26 al 31 llega el 2 de noviembre.
    expect(o.expectedIncome).toBe(16000);
    // Hoy: 700 de inDrive − 1,400 = −700; por cobrar el lunes 12, 7,000; menos 200 al día × 20.
    expect(o.incoming).toBe(7000);
    expect(o.projected).toBe(18300); // −700 + 7,000 + 16,000 − 4,000
  });

  it('qué parte de lo que entra se llevan los fijos: el promedio de los meses anteriores', () => {
    const income = ['2026-07-15', '2026-08-15', '2026-09-15'].map((date, i) => makeTx({ kind: 'income', categoryId: 'sueldo', amount: 9000 + i * 1500, date }));
    const o = outlook({ cash: income, transactions: income, recurring: [rent], goals: [], pending: [], today: '2026-10-06' });
    expect(o.avgIncome).toBe(10500);
    expect(o.committed).toBe(4500);
  });
});
