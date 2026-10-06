import { fixedSummary, fuelEfficiency, periodRange, periodTotals, savedAmount, Transaction } from '@/lib/finance';

import { useFinance } from '@/store/finance';

import { loadFinanceDemo } from '../financeDemo';

const TODAY = '2026-10-06';
const store = () => useFinance.getState();

/** Fechas (e importes) en que se apuntó un fijo, por su nombre. */
const charges = (name: string) =>
  store().transactions.filter((t) => t.recurringId && t.note === name).sort((a, b) => a.date.localeCompare(b.date));

beforeAll(() => {
  // Lo que hubiera antes se borra.
  store().setProfiles(['student']);
  store().addTransaction({ kind: 'expense', amount: 50, categoryId: 'comida', date: TODAY, note: 'De antes', shift: null, fuel: null });
  loadFinanceDemo(TODAY);
});

describe('datos de ejemplo: cuatro meses apuntados día a día', () => {
  it('empieza el 1 de junio, con perfil de trabajador y conductor, y nada de lo de antes', () => {
    const { profiles, transactions } = store();
    expect(profiles).toEqual(['worker', 'driver']);
    expect(transactions.some((t) => t.note === 'De antes')).toBe(false);
    expect(transactions.every((t) => t.date >= '2026-06-01' && t.date <= TODAY)).toBe(true);
    expect(transactions.length).toBeGreaterThan(250);
  });

  it('cada fijo se apuntó una vez en cada fecha que tocaba', () => {
    const seen = new Set<string>();
    for (const t of store().transactions.filter((x) => x.recurringId)) {
      const key = `${t.recurringId}|${t.date}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    const dates = (name: string) => charges(name).map((t) => t.date);
    expect(dates('Renta')).toEqual(['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01']);
    expect(dates('Sueldo')).toEqual([
      '2026-06-15', '2026-06-30', '2026-07-15', '2026-07-31', '2026-08-15', '2026-08-31', '2026-09-15', '2026-09-30',
    ]);
    // Bimestrales: la luz desde junio, el agua desde julio.
    expect(dates('Luz')).toEqual(['2026-06-18', '2026-08-18']);
    expect(dates('Agua')).toEqual(['2026-07-25', '2026-09-25']);
  });

  it('los cambios en los fijos: HBO Max desde agosto, Spotify cancelado, Netflix más caro', () => {
    expect(charges('HBO Max').map((t) => t.date)).toEqual(['2026-08-03', '2026-09-03', '2026-10-03']);
    expect(charges('Spotify').map((t) => t.date)).toEqual(['2026-06-03', '2026-07-03', '2026-08-03']);
    expect(store().recurring.some((r) => r.name === 'Spotify')).toBe(false);
    expect(charges('Netflix').map((t) => t.amount)).toEqual([219, 219, 219, 249]);
  });

  it('en la semana de viaje no abrió la app: al volver se apuntaron los fijos y lo del viaje, con su fecha', () => {
    const trip = store().transactions.filter((t) => t.date >= '2026-08-10' && t.date <= '2026-08-16');
    expect(trip.map((t) => t.note).sort()).toEqual(
      ['Autobús a Veracruz', 'Comidas del viaje', 'Hotel en Veracruz', 'Paseo en lancha', 'Plan del celular', 'Sueldo'],
    );
    expect(charges('Plan del celular').map((t) => t.date)).toContain('2026-08-12');
    // En quincena estaba fuera: ese día no apartó para sus metas.
    const deposits = store().goals.flatMap((g) => g.deposits.map((d) => d.date));
    expect(deposits).not.toContain('2026-08-15');
  });

  it('los errores corregidos no dejan rastro', () => {
    const { transactions } = store();
    expect(transactions.some((t) => t.amount === 1200 && t.note === 'Tacos')).toBe(false);
    expect(transactions.filter((t) => t.date === '2026-07-09' && t.note === 'Tacos' && t.amount === 120)).toHaveLength(1);
    expect(transactions.filter((t) => t.date === '2026-09-13' && t.categoryId === 'super')).toHaveLength(1);
  });

  it('jornadas de Uber, DiDi e inDrive con horas y viajes', () => {
    const shifts = store().transactions.filter((t): t is Transaction & { shift: NonNullable<Transaction['shift']> } => t.shift != null);
    expect(new Set(shifts.flatMap((t) => t.shift.platforms.map((p) => p.platform)))).toEqual(new Set(['Uber', 'DiDi', 'inDrive']));
    expect(shifts.every((t) => t.shift.hours && t.shift.platforms.every((p) => p.trips))).toBe(true);
    expect(shifts.every((t) => t.amount === t.shift.platforms.reduce((s, p) => s + p.amount, 0))).toBe(true);
  });

  it('gasolina: el kilometraje sube carga tras carga y el rendimiento sale el real', () => {
    const fills = store().transactions.filter((t) => t.fuel).sort((a, b) => a.date.localeCompare(b.date));
    const odometers = fills.map((t) => t.fuel!.odometer!);
    expect(odometers).toEqual([...odometers].sort((a, b) => a - b));
    expect(fills.some((t) => !t.fuel!.fullTank)).toBe(true);
    const efficiency = fuelEfficiency(store().transactions, TODAY);
    expect(efficiency?.estimated).toBe(false);
    expect(efficiency?.kmPerLiter).toBeCloseTo(11.4, 0);
  });

  it('metas: abonos en quincena y un retiro para las balatas', () => {
    const [emergency, holidays] = store().goals;
    expect(savedAmount(holidays)).toBe(4200);
    expect(savedAmount(emergency)).toBe(4100);
    expect(emergency.deposits).toContainEqual(expect.objectContaining({ date: '2026-09-06', amount: -1500 }));
  });

  it('el mes del viaje acabó en rojo y los fijos de octubre van a medias', () => {
    const { transactions, goals, recurring } = store();
    const august = periodTotals(transactions, goals, periodRange('month', -2, TODAY));
    expect(august.balance).toBeLessThan(0);
    const june = periodTotals(transactions, goals, periodRange('month', -4, TODAY));
    expect(june.balance).toBeGreaterThan(0);
    expect(fixedSummary(recurring, TODAY)).toMatchObject({ paid: 6328, pending: 1667, subscriptions: 398 });
    expect(store().budgets).toEqual({ comida: 2800, super: 3800, ocio: 900 });
  });

  it('sale igual cada vez', () => {
    const strip = () => store().transactions.map(({ id: _id, createdAt: _c, recurringId, ...t }) => ({ ...t, fixed: recurringId != null }));
    const before = strip();
    loadFinanceDemo(TODAY);
    expect(strip()).toEqual(before);
  });
});
