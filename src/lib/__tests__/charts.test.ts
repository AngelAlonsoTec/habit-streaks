import { niceCeil } from '@/components/charts/scale';
import { balanceSeries, dailyFlow, rangeDays, shiftDays, topSlices } from '@/lib/finance';
import { migrateFinance } from '@/store/finance';
import { makeTx } from '@/testing/fixtures';
import { chartColor, inkOn, slotColor, Theme } from '@/theme';

const week = { start: '2026-10-05', end: '2026-10-11' };

describe('series para las gráficas', () => {
  it('días del periodo, con los días sin nada en cero', () => {
    expect(rangeDays(week)).toHaveLength(7);
    const flow = dailyFlow([
      makeTx({ amount: 120, date: '2026-10-05' }),
      makeTx({ amount: 30.5, date: '2026-10-05' }),
      makeTx({ kind: 'income', categoryId: 'sueldo', amount: 900, date: '2026-10-07' }),
      makeTx({ amount: 999, date: '2026-10-12' }), // fuera
    ], week);
    expect(flow.map((d) => [d.income, d.expense])).toEqual([[0, 150.5], [0, 0], [900, 0], [0, 0], [0, 0], [0, 0], [0, 0]]);
  });

  it('el balance acumulado llega hasta hoy y descuenta lo apartado', () => {
    const txs = [
      makeTx({ kind: 'income', categoryId: 'sueldo', amount: 1000, date: '2026-10-05' }),
      makeTx({ amount: 300, date: '2026-10-06' }),
    ];
    const goals = [{
      id: 'g', name: 'Viaje', icon: 'airplane' as const, color: '#3B82F6', target: 5000, dueDate: null,
      deposits: [{ id: 'd', date: '2026-10-07', amount: 200 }], achievedOn: null, createdAt: '',
    }];
    expect(balanceSeries(txs, goals, week, '2026-10-07')).toEqual([1000, 700, 500]);
    expect(balanceSeries(txs, goals, week, '2026-10-20')).toHaveLength(7); // ya terminó
    expect(balanceSeries(txs, goals, week, '2026-10-01')).toEqual([]); // aún no empieza
  });

  it('lo que dejó cada app cada día', () => {
    const days = shiftDays([
      makeTx({ kind: 'income', categoryId: 'viajes', amount: 1970, date: '2026-10-05', shift: { hours: 10, platforms: [{ platform: 'Uber', amount: 1350, trips: 16 }, { platform: 'DiDi', amount: 620, trips: 8 }] } }),
      makeTx({ kind: 'income', categoryId: 'viajes', amount: 300, date: '2026-10-05', shift: { hours: 2, platforms: [{ platform: 'Uber', amount: 300, trips: 4 }] } }),
    ], week);
    expect(days[0].byPlatform).toEqual({ Uber: 1650, DiDi: 620 });
    expect(days[1].byPlatform).toEqual({});
  });

  it('la dona: 4 categorías y el resto en "Otros"', () => {
    const totals = [5, 4, 3, 2, 1.5, 1].map((amount, i) => ({ categoryId: `c${i}`, amount, count: 1 }));
    expect(topSlices(totals)).toEqual([
      { categoryId: 'c0', amount: 5 }, { categoryId: 'c1', amount: 4 }, { categoryId: 'c2', amount: 3 },
      { categoryId: 'c3', amount: 2 }, { categoryId: null, amount: 2.5 },
    ]);
    expect(topSlices(totals.slice(0, 3))).toHaveLength(3);
  });

  it('topes del eje redondos', () => {
    expect([0, 7, 1970, 2001, 2600, 45000, 0.3].map(niceCeil)).toEqual([0, 10, 2000, 2500, 5000, 50000, 0.5]);
  });
});

describe('colores', () => {
  const light = { dark: false } as Theme;
  const dark = { dark: true } as Theme;

  it('cada color de la paleta tiene su paso para el modo oscuro', () => {
    expect(chartColor('#2A78D6', light)).toBe('#2A78D6');
    expect(chartColor('#2a78d6', dark)).toBe('#3987E5');
    expect(chartColor('#123456', dark)).toBe('#123456');
    expect(slotColor(1, light)).toBe('#EB6834');
    expect(slotColor(20, light)).toBe('#8A8F98');
  });

  it('icono en tinta sobre los colores claros y en blanco sobre los oscuros', () => {
    expect(inkOn('#EDA100')).toBe('#111827');
    expect(inkOn('#1BAF7A')).toBe('#111827');
    expect(inkOn('#4A3AA7')).toBe('#FFFFFF');
    expect(inkOn('#1F883D')).toBe('#FFFFFF');
  });

  it('los datos guardados antes toman los colores nuevos del catálogo; las categorías propias no cambian', () => {
    const migrated = migrateFinance({
      categories: [
        { id: 'comida', name: 'Comida', icon: 'restaurant', color: '#F97316', kind: 'expense' },
        { id: 'custom-1', name: 'Mascota', icon: 'pricetag', color: '#64748B', kind: 'expense' },
      ],
    }, 1);
    expect(migrated.categories.map((c) => c.color)).toEqual(['#EB6834', '#64748B']);
  });
});
