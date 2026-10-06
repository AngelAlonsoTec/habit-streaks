import { categoriesFor } from '@/lib/finance';

import { migrateFinance, useFinance } from '../finance';

const store = () => useFinance.getState();

beforeEach(() => {
  store().resetFinance();
  store().setProfiles(['worker']);
});

const expense = (o: Partial<Parameters<ReturnType<typeof store>['addTransaction']>[0]> = {}) =>
  store().addTransaction({ kind: 'expense', amount: 100, categoryId: 'comida', date: '2026-10-06', note: '', shift: null, fuel: null, ...o });

describe('perfiles', () => {
  it('elegir perfiles añade sus categorías y las plataformas por defecto', () => {
    expect(store().categories.map((c) => c.id)).toContain('sueldo');
    store().setProfiles(['worker', 'driver']);
    expect(store().categories.map((c) => c.id)).toEqual(expect.arrayContaining(['sueldo', 'viajes', 'mantenimiento']));
    expect(store().platforms).toEqual(['Uber', 'DiDi', 'inDrive']);
  });

  it('quitar un perfil no borra sus categorías (pueden tener movimientos)', () => {
    store().setProfiles(['worker', 'driver']);
    store().setProfiles(['worker']);
    expect(store().profiles).toEqual(['worker']);
    expect(store().categories.map((c) => c.id)).toContain('viajes');
  });

  it('no se queda sin perfiles', () => {
    store().setProfiles([]);
    expect(store().profiles).toEqual(['worker']);
  });
});

describe('movimientos', () => {
  it('limpia lo que se guarda: nota, importe y datos que no aplican', () => {
    const id = expense({
      amount: 99.999,
      note: '   tacos   ',
      shift: { platforms: [{ platform: 'Uber', amount: 100, trips: 2 }], hours: 3 }, // un gasto de comida no es una jornada
      fuel: { liters: 20, odometer: 100, fullTank: true },
    });
    expect(store().transactions.find((t) => t.id === id)).toMatchObject({ amount: 100, note: 'tacos', shift: null, fuel: null });
  });

  it('una categoría que no existe o de otro tipo acaba en "Otros"', () => {
    const a = expense({ categoryId: 'no-existe' });
    const b = expense({ categoryId: 'sueldo' }); // es de ingresos
    expect(store().transactions.filter((t) => [a, b].includes(t.id)).map((t) => t.categoryId)).toEqual(['otros-gastos', 'otros-gastos']);
  });

  it('una jornada guarda cada plataforma, las horas una vez y viajes redondeados', () => {
    store().setProfiles(['driver']);
    const id = store().addTransaction({
      kind: 'income', amount: 1, categoryId: 'viajes', date: '2026-10-06', note: '',
      shift: {
        platforms: [
          { platform: '  DiDi ', amount: 600, trips: 7.6 },
          { platform: 'Uber', amount: 1200.5, trips: null },
          { platform: 'didi', amount: 50, trips: 1 }, // repetida
          { platform: 'inDrive', amount: 0, trips: 3 }, // sin importe
        ],
        hours: 30,
      },
      fuel: null,
    });
    const t = store().transactions.find((x) => x.id === id)!;
    expect(t.shift).toEqual({
      platforms: [{ platform: 'DiDi', amount: 600, trips: 8 }, { platform: 'Uber', amount: 1200.5, trips: null }],
      hours: 24,
    });
    // El importe es la suma de las plataformas, no lo que venga escrito aparte.
    expect(t.amount).toBe(1800.5);
  });

  it('una carga de gasolina sin litros ni kilometraje sigue siendo válida', () => {
    const id = expense({ categoryId: 'gasolina', amount: 500, fuel: { liters: null, odometer: null, fullTank: false } });
    expect(store().transactions.find((t) => t.id === id)?.fuel).toEqual({ liters: null, odometer: null, fullTank: false });
  });

  it('importes inválidos no se guardan', () => {
    expect(expense({ amount: 0 })).toBeNull();
    expect(expense({ amount: Number.NaN })).toBeNull();
    expect(store().transactions).toHaveLength(0);
  });

  it('editar y borrar', () => {
    const id = expense()!;
    store().updateTransaction(id, { amount: 250, categoryId: 'ocio' });
    expect(store().transactions[0]).toMatchObject({ amount: 250, categoryId: 'ocio' });
    store().deleteTransaction(id);
    expect(store().transactions).toHaveLength(0);
  });
});

describe('categorías propias y plataformas', () => {
  it('no se duplican y al borrarlas sus movimientos, fijos y presupuesto se reubican', () => {
    const id = store().addCategory('Mascota', 'expense')!;
    expect(store().addCategory('  mascota ', 'expense')).toBe(id);
    expense({ categoryId: id });
    store().addRecurring({ kind: 'expense', name: 'Croquetas', amount: 400, categoryId: id, frequency: 'monthly', day: 1 }, '2026-10-06');
    store().setBudget(id, 800);

    store().deleteCategory(id);
    expect(store().categories.some((c) => c.id === id)).toBe(false);
    expect(store().transactions[0].categoryId).toBe('otros-gastos');
    expect(store().recurring[0].categoryId).toBe('otros-gastos');
    expect(store().budgets[id]).toBeUndefined();
  });

  it('las del catálogo no se pueden borrar', () => {
    store().deleteCategory('comida');
    expect(store().categories.some((c) => c.id === 'comida')).toBe(true);
  });

  it('plataformas sin duplicados (ignorando mayúsculas)', () => {
    expect(store().addPlatform(' cabify ')).toBe('cabify');
    expect(store().addPlatform('Cabify')).toBe('cabify');
    expect(store().addPlatform('uber')).toBe('Uber');
    expect(store().addPlatform('   ')).toBeNull();
    store().removePlatform('DiDi');
    expect(store().platforms).toEqual(['Uber', 'inDrive', 'cabify']);
  });
});

describe('presupuestos', () => {
  it('se ponen, se cambian y se quitan', () => {
    store().setBudget('comida', 3000);
    store().setBudget('comida', 2500);
    expect(store().budgets).toEqual({ comida: 2500 });
    store().setBudget('comida', null);
    expect(store().budgets).toEqual({});
    store().setBudget('ocio', 0);
    expect(store().budgets).toEqual({});
  });
});

describe('fijos', () => {
  const rent = { kind: 'expense' as const, name: 'Renta', amount: 5000, categoryId: 'renta', frequency: 'monthly' as const, day: 1 };

  it('se apuntan solos el día que tocan, una sola vez aunque se abra la app varias veces', () => {
    store().addRecurring({ ...rent, day: 6 }, '2026-10-06');
    expect(store().applyRecurring('2026-10-06')).toBe(1);
    expect(store().applyRecurring('2026-10-06')).toBe(0);
    expect(store().transactions).toEqual([
      expect.objectContaining({ amount: 5000, categoryId: 'renta', date: '2026-10-06', note: 'Renta', recurringId: store().recurring[0].id }),
    ]);
  });

  it('si no abriste la app en meses, se ponen al día con su fecha', () => {
    store().addRecurring(rent, '2026-07-15');
    store().applyRecurring('2026-07-15');
    expect(store().applyRecurring('2026-10-06')).toBe(3);
    expect(store().transactions.map((t) => t.date)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
  });

  it('si el reloj va hacia atrás (cambio de zona) no se repite nada', () => {
    store().addRecurring({ ...rent, frequency: 'weekly', day: 1 }, '2026-10-06');
    store().applyRecurring('2026-10-06');
    store().applyRecurring('2026-10-05');
    store().applyRecurring('2026-10-06');
    expect(store().transactions).toHaveLength(1);
  });

  it('borrar un fijo deja lo ya registrado; editarlo cambia lo que viene', () => {
    store().addRecurring({ ...rent, day: 6 }, '2026-10-06');
    store().applyRecurring('2026-10-06');
    const id = store().recurring[0].id;
    store().updateRecurring(id, { amount: 5500, name: '  ' });
    expect(store().recurring[0]).toMatchObject({ amount: 5500, name: 'Renta' });
    store().applyRecurring('2026-11-06');
    expect(store().transactions.map((t) => t.amount)).toEqual([5000, 5500]);
    store().deleteRecurring(id);
    expect(store().transactions).toHaveLength(2);
    expect(store().applyRecurring('2026-12-06')).toBe(0);
  });

  it('el día se ajusta a su frecuencia y hace falta nombre e importe', () => {
    store().addRecurring({ ...rent, frequency: 'weekly', day: 9 }, '2026-10-06');
    store().addRecurring({ ...rent, day: 45 }, '2026-10-06');
    expect(store().recurring.map((r) => r.day)).toEqual([6, 31]);
    expect(store().addRecurring({ ...rent, name: ' ' }, '2026-10-06')).toBeNull();
    expect(store().addRecurring({ ...rent, amount: 0 }, '2026-10-06')).toBeNull();
  });

  it('agregar Netflix sin tener "Suscripciones" añade la categoría', () => {
    useFinance.setState({ categories: store().categories.filter((c) => c.id !== 'suscripciones') });
    store().addRecurring({ ...rent, name: 'Netflix', amount: 219, categoryId: 'suscripciones', day: 20 }, '2026-10-06');
    expect(store().recurring[0].categoryId).toBe('suscripciones');
    expect(store().categories.map((c) => c.id)).toContain('suscripciones');
  });

  it('con datos de antes, el conductor recibe Renta, Servicios y Suscripciones', () => {
    const old = categoriesFor(['driver']).filter((c) => !['renta', 'servicios', 'suscripciones'].includes(c.id));
    const migrated = migrateFinance({ profiles: ['driver'], categories: old }, 2);
    expect(migrated.categories.map((c) => c.id)).toEqual(categoriesFor(['driver']).map((c) => c.id));
    // Sin perfil (Finanzas sin configurar) no se añade nada.
    expect(migrateFinance({ profiles: [], categories: [] }, 2).categories).toEqual([]);
  });
});

describe('metas de ahorro', () => {
  const create = () => store().addGoal({ name: 'Viaje', icon: 'airplane', color: '#3B82F6', target: 3000, dueDate: null })!;

  it('al llegar al monto queda lograda; si retiras por debajo, deja de estarlo', () => {
    const id = create();
    store().addDeposit(id, 1000, '2026-10-01');
    store().addDeposit(id, 2000, '2026-10-06');
    expect(store().goals[0].achievedOn).toBe('2026-10-06');
    store().addDeposit(id, -500, '2026-10-07');
    expect(store().goals[0].achievedOn).toBeNull();
  });

  it('no se puede retirar más de lo ahorrado', () => {
    const id = create();
    store().addDeposit(id, 800, '2026-10-01');
    store().addDeposit(id, -5000, '2026-10-02');
    expect(store().goals[0].deposits.map((d) => d.amount)).toEqual([800, -800]);
    store().addDeposit(id, -100, '2026-10-03'); // ya no queda nada
    expect(store().goals[0].deposits).toHaveLength(2);
  });

  it('subir el monto por encima de lo ahorrado la vuelve a dejar pendiente', () => {
    const id = create();
    store().addDeposit(id, 3000, '2026-10-01');
    store().updateGoal(id, { target: 5000 });
    expect(store().goals[0]).toMatchObject({ target: 5000, achievedOn: null });
  });

  it('hace falta nombre y monto', () => {
    expect(store().addGoal({ name: '  ', icon: 'gift', color: '#000000', target: 100, dueDate: null })).toBeNull();
    expect(store().addGoal({ name: 'Algo', icon: 'gift', color: '#000000', target: 0, dueDate: null })).toBeNull();
  });
});

it('borrar Finanzas vuelve a la presentación', () => {
  expense();
  store().resetFinance();
  expect(store()).toMatchObject({ profiles: [], transactions: [], budgets: {}, goals: [], recurring: [] });
});
