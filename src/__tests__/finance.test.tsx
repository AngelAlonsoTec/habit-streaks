/**
 * Finanzas de punta a punta, con casos reales: un trabajador que apunta sus gastos, un conductor
 * de app con sus jornadas y cargas de gasolina, fijos que se apuntan solos, metas y presupuestos.
 */
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';
import { Alert, AlertButton, StyleSheet } from 'react-native';

import type { Recurring } from '@/lib/finance';
import { useFinance } from '@/store/finance';
import { useHabits } from '@/store/habits';
import { makeHabit, makeTx } from '@/testing/fixtures';

const APP_DIR = path.resolve(__dirname, '../app');
/** Martes 6 de octubre de 2026, mediodía. */
const NOW = new Date(2026, 9, 6, 12);
const finance = () => useFinance.getState();

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  useHabits.setState({ habits: [], completions: {}, customCategories: [], settings: { showHeatmaps: true, compactTipSeen: true }, hasHydrated: true });
  finance().resetFinance();
  useFinance.setState({ hasHydrated: true });
  // Confirma los diálogos (Eliminar, Borrar todo…).
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.[1].onPress?.());
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Perfil y movimientos antes de montar la app. */
function setup(profiles: Parameters<ReturnType<typeof finance>['setProfiles']>[0], patch: Partial<ReturnType<typeof finance>> = {}) {
  finance().setProfiles(profiles);
  useFinance.setState(patch);
}

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

describe('presentación', () => {
  it('pide al menos un perfil; el conductor empieza viendo la semana', async () => {
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    expect(await screen.findByText('Tus finanzas, claras')).toBeTruthy();
    fireEvent.press(screen.getByText('Empezar'));
    expect(finance().profiles).toEqual([]);

    fireEvent.press(screen.getByLabelText('Conductor de app'));
    fireEvent.press(screen.getByText('Dólar (USD)'));
    fireEvent.press(screen.getByText('Empezar'));

    expect(await screen.findByText('Manejando')).toBeTruthy();
    expect(screen.getByText('Esta semana')).toBeTruthy();
    expect(screen.getByLabelText('Registrar jornada')).toBeTruthy();
    expect(screen.getByLabelText('Registrar gasolina')).toBeTruthy();
    expect(finance().currency).toBe('USD');
  });

  it('un estudiante no ve jornadas ni gasolina, y empieza viendo el mes', async () => {
    setup(['student']);
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    expect(await screen.findByText('Octubre')).toBeTruthy();
    expect(screen.queryByLabelText('Registrar jornada')).toBeNull();
    expect(screen.queryByLabelText('Registrar gasolina')).toBeNull();
    expect(screen.queryByText('Manejando')).toBeNull();
  });
});

describe('movimientos', () => {
  it('un trabajador apunta un gasto escrito "a mano" y se ve en el balance y en la lista', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByLabelText('Registrar gasto'));
    await waitFor(() => expect(screen).toHavePathname('/finance/entry'));

    type('Importe', '$1,250.50');
    // Sin categoría no se puede guardar.
    expect(screen.getByText('Elige una categoría')).toBeTruthy();
    fireEvent.press(screen.getByText('Comida'));
    type('Nota', 'Súper de la semana');
    fireEvent.press(screen.getByText('Guardar gasto'));

    await waitFor(() => expect(screen).toHavePathname('/finance'));
    expect(screen.getByLabelText('Balance: −$1,250.50')).toBeTruthy();
    fireEvent.press(screen.getByText('Movimientos'));
    expect(await screen.findByLabelText('Súper de la semana, −$1,250.50')).toBeTruthy();
    expect(screen.getByText('Hoy')).toBeTruthy();
  });

  it('un importe mal escrito avisa y no deja guardar', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance/entry?kind=expense' });
    await screen.findByLabelText('Importe');
    type('Importe', 'mil pesos');
    fireEvent.press(screen.getByText('Comida'));
    expect(screen.getByText(/Escribe un importe válido/)).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar gasto'));
    expect(finance().transactions).toHaveLength(0);
  });

  it('un gasto de ayer se apunta en su día', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance/entry?kind=expense' });
    await screen.findByLabelText('Importe');
    type('Importe', '80');
    fireEvent.press(screen.getByText('Transporte'));
    fireEvent.press(screen.getByText('Ayer'));
    fireEvent.press(screen.getByText('Guardar gasto'));
    await waitFor(() => expect(finance().transactions).toHaveLength(1));
    expect(finance().transactions[0]).toMatchObject({ date: '2026-10-05', categoryId: 'transporte', amount: 80 });
  });

  it('un ingreso con una categoría nueva', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance/entry?kind=income' });
    await screen.findByLabelText('Importe');
    type('Importe', '600');
    // La lista de categorías está abierta mientras no se elige ninguna; al final, "Nueva categoría".
    fireEvent.press(screen.getByText('Nueva categoría'));
    fireEvent.changeText(screen.getByPlaceholderText('Nombre de la categoría'), 'Clases particulares');
    fireEvent(screen.getByPlaceholderText('Nombre de la categoría'), 'submitEditing');
    // Queda elegida y la lista se cierra: se ve como un campo, con opción a cambiarla.
    expect(screen.getByLabelText('Categoría: Clases particulares. Cambiar')).toBeTruthy();
    expect(screen.queryByText('Sueldo')).toBeNull();
    fireEvent.press(screen.getByText('Guardar ingreso'));
    await waitFor(() => expect(finance().transactions).toHaveLength(1));
    const category = finance().categories.find((c) => c.name === 'Clases particulares');
    expect(category?.kind).toBe('income');
    expect(finance().transactions[0]).toMatchObject({ kind: 'income', categoryId: category?.id });
  });

  it('la categoría se elige de una lista que se cierra al elegir y se vuelve a abrir para cambiarla', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance/entry?kind=expense' });
    await screen.findByLabelText('Importe');
    type('Importe', '95');
    fireEvent.press(screen.getByText('Comida'));
    expect(screen.queryByText('Transporte')).toBeNull();
    fireEvent.press(screen.getByLabelText('Categoría: Comida. Cambiar'));
    fireEvent.press(screen.getByText('Transporte'));
    expect(screen.getByLabelText('Categoría: Transporte. Cambiar')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar gasto'));
    await waitFor(() => expect(finance().transactions[0]).toMatchObject({ categoryId: 'transporte', amount: 95 }));
  });

  it('editar y eliminar un movimiento', async () => {
    setup(['worker'], { transactions: [makeTx({ id: 'x', amount: 300, categoryId: 'ocio', date: '2026-10-03' })] });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Movimientos'));
    fireEvent.press(await screen.findByLabelText('Ocio, −$300'));
    await waitFor(() => expect(screen).toHavePathname('/finance/entry'));
    expect(screen.getByDisplayValue('300')).toBeTruthy();
    type('Importe', '350');
    fireEvent.press(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(finance().transactions[0].amount).toBe(350));

    fireEvent.press(await screen.findByLabelText('Ocio, −$350'));
    fireEvent.press(await screen.findByText('Eliminar movimiento'));
    await waitFor(() => expect(finance().transactions).toHaveLength(0));
  });

  it('un movimiento que ya no existe (enlace viejo) no rompe la pantalla', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance/entry?id=borrado' });
    expect(await screen.findByText('Este movimiento ya no existe.')).toBeTruthy();
  });

  it('periodos: la semana pasada se puede ver, el futuro no', async () => {
    setup(['worker'], { transactions: [makeTx({ amount: 450, date: '2026-09-29' })] });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Semana'));
    expect(screen.getByLabelText('Balance: $0')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Periodo siguiente'));
    expect(screen.getByText('Esta semana')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Periodo anterior'));
    expect(await screen.findByText('Semana pasada')).toBeTruthy();
    expect(screen.getByLabelText('Balance: −$450')).toBeTruthy();
  });
});

describe('presupuestos', () => {
  it('avisa antes de guardar si el gasto se acerca o pasa el presupuesto', async () => {
    setup(['worker'], { budgets: { comida: 1000 }, transactions: [makeTx({ amount: 700, date: '2026-10-02' })] });
    renderRouter(APP_DIR, { initialUrl: '/finance/entry?kind=expense' });
    await screen.findByLabelText('Importe');
    type('Importe', '200');
    fireEvent.press(screen.getByText('Comida'));
    expect(screen.getByText('Con este gasto llevarías $900 de $1,000 en Comida este mes (90 %).')).toBeTruthy();
    type('Importe', '400');
    expect(screen.getByText('Con este gasto te pasarías $100 del presupuesto de Comida.')).toBeTruthy();
  });

  it('el resumen del mes avisa de las categorías cerca del tope', async () => {
    setup(['worker'], {
      budgets: { comida: 1000, ocio: 500 },
      transactions: [makeTx({ amount: 850, date: '2026-10-02' }), makeTx({ categoryId: 'ocio', amount: 650, date: '2026-10-03' })],
    });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    expect(await screen.findByText('Comida: llevas el 85 % del presupuesto')).toBeTruthy();
    expect(screen.getByText('Ocio: te pasaste $150 del presupuesto')).toBeTruthy();
    expect(screen.getByText('Quedan $150')).toBeTruthy();
  });

  it('poner un presupuesto con el promedio de los meses anteriores', async () => {
    setup(['worker'], {
      transactions: [
        makeTx({ categoryId: 'super', amount: 2000, date: '2026-09-10' }),
        makeTx({ categoryId: 'super', amount: 2600, date: '2026-08-10' }),
        makeTx({ categoryId: 'super', amount: 500, date: '2026-10-02' }),
      ],
    });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByLabelText('Súper: $500'));
    fireEvent.press(await screen.findByText('Tu promedio: $2,300'));
    fireEvent.press(screen.getByText('Guardar presupuesto'));
    await waitFor(() => expect(finance().budgets).toEqual({ super: 2300 }));
    expect(await screen.findByLabelText('Súper: $500 de $2,300')).toBeTruthy();
  });
});

describe('conductor de app', () => {
  it('una jornada calcula por hora y por viaje, y repite la última plataforma', async () => {
    setup(['driver'], {
      transactions: [makeTx({
        kind: 'income', categoryId: 'viajes', amount: 900, date: '2026-10-05',
        shift: { platforms: [{ platform: 'DiDi', amount: 900, trips: 10 }], hours: 6 },
      })],
    });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByLabelText('Registrar jornada'));
    await screen.findByLabelText('Ganancia en DiDi');
    type('Ganancia en DiDi', '1450');
    type('Horas conectado', '8:30');
    type('Viajes en DiDi', '17');
    expect(screen.getByText('$170.59 por hora · $85.29 por viaje')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar jornada'));

    await waitFor(() => expect(finance().transactions).toHaveLength(2));
    expect(finance().transactions[1]).toMatchObject({
      amount: 1450,
      shift: { platforms: [{ platform: 'DiDi', amount: 1450, trips: 17 }], hours: 8.5 },
    });
    // Semana: 2350 en 14 h 30 min y 27 viajes.
    expect(await screen.findByText('14 h 30 min · 27 viajes · $162.07/h · $87.04/viaje')).toBeTruthy();
  });

  it('gasolina: avisa si el kilometraje baja y calcula el rendimiento', async () => {
    setup(['driver'], { transactions: [makeTx({ categoryId: 'gasolina', amount: 800, date: '2026-10-01', fuel: { liters: 33.5, odometer: 45230, fullTank: true } })] });
    renderRouter(APP_DIR, { initialUrl: '/finance/entry?mode=fuel' });
    await screen.findByLabelText('Importe');
    type('Importe', '700');
    type('Litros', '29');
    type('Kilometraje', '45,000');
    expect(screen.getByText('Es menos que en tu carga anterior (45,230 km). ¿Está bien escrito?')).toBeTruthy();
    type('Kilometraje', '45,580');
    expect(screen.getByText('Recorriste 350 km desde la carga anterior.')).toBeTruthy();
    expect(screen.getByText('Sale a $24.14 el litro.')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar carga'));

    await waitFor(() => expect(screen).toHavePathname('/finance'));
    expect(await screen.findByText('12.1 km/l')).toBeTruthy();
    expect(screen.getByText('Calculado con 350 km de tus últimas cargas con tanque lleno.')).toBeTruthy();
  });

  it('lo que deja manejar descuenta los gastos del auto, no la comida', async () => {
    setup(['driver'], {
      transactions: [
        makeTx({
          kind: 'income', categoryId: 'viajes', amount: 2000, date: '2026-10-05',
          shift: { platforms: [{ platform: 'Uber', amount: 2000, trips: 20 }], hours: 10 },
        }),
        makeTx({ categoryId: 'gasolina', amount: 500, date: '2026-10-05', fuel: { liters: 20, odometer: null, fullTank: true } }),
        makeTx({ categoryId: 'renta-auto', amount: 1000, date: '2026-10-05' }),
        makeTx({ categoryId: 'comida', amount: 150, date: '2026-10-05' }),
      ],
    });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    expect(await screen.findByText('Te dejó')).toBeTruthy();
    expect(screen.getByLabelText('Te dejó: $500')).toBeTruthy(); // 2000 − 500 − 1000 (la comida no cuenta)
    expect(screen.getByLabelText('Neto por hora: $50')).toBeTruthy();
    expect(screen.getByLabelText('Bruto por hora: $200')).toBeTruthy();
  });
});

describe('fijos y metas', () => {
  const rent: Recurring = {
    id: 'r1', kind: 'expense', name: 'Renta', amount: 5000, categoryId: 'renta', frequency: 'monthly', day: 1,
    startDate: '2026-08-15', lastApplied: '2026-09-01', createdAt: '2026-08-15T12:00:00.000Z',
  };

  it('al abrir Finanzas se apunta lo que tocaba desde la última vez', async () => {
    setup(['worker'], { recurring: [rent] });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    expect(await screen.findByLabelText('Balance: −$5,000')).toBeTruthy();
    expect(finance().transactions).toEqual([expect.objectContaining({ date: '2026-10-01', recurringId: 'r1' })]);
    fireEvent.press(screen.getByText('Movimientos'));
    expect(await screen.findByLabelText('Renta, −$5,000')).toBeTruthy();
    expect(screen.getByLabelText('Fijo')).toBeTruthy();
  });

  it('crear un fijo que toca hoy lo apunta al momento', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Planes'));
    fireEvent.press(screen.getByLabelText('Nuevo gasto fijo'));
    fireEvent.press(await screen.findByText('Internet'));
    type('Importe del fijo', '499');
    expect(screen.getByText('Hoy toca: se registrará en cuanto lo guardes.')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear fijo'));

    await waitFor(() => expect(finance().transactions).toHaveLength(1));
    expect(finance().transactions[0]).toMatchObject({ amount: 499, categoryId: 'servicios', note: 'Internet', date: '2026-10-06' });
    expect(await screen.findByText('El 6 de cada mes · se cobra el 6 nov')).toBeTruthy();
  });

  it('el sueldo quincenal se cobra el 15 y el último día', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Planes'));
    fireEvent.press(screen.getByLabelText('Nuevo ingreso fijo'));
    // "Sueldo" también está en las categorías: el de la sugerencia va primero.
    await screen.findByText('Nuevo ingreso fijo');
    fireEvent.press(screen.getAllByText('Sueldo')[0]);
    type('Importe del fijo', '7500');
    expect(screen.getByText('Primer registro: 15 oct')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear fijo'));
    await waitFor(() => expect(finance().recurring).toHaveLength(1));
    expect(finance().transactions).toHaveLength(0);
    expect(screen.getByText('Unos $15,000 al mes.')).toBeTruthy();

    // Dos semanas después.
    act(() => {
      finance().applyRecurring('2026-10-31');
    });
    expect(finance().transactions.map((t) => t.date)).toEqual(['2026-10-15', '2026-10-31']);
  });

  it('un conductor agrega Netflix desde el Resumen y ve lo que se le va en fijos', async () => {
    setup(['driver']);
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByLabelText('Agregar gasto fijo'));
    await screen.findByText('Nuevo gasto fijo');
    fireEvent.press(screen.getByLabelText('Netflix'));
    type('Importe del fijo', '219');
    // Se cobra hoy (el 6): se apunta en cuanto se guarda.
    expect(screen.getByText('Hoy toca: se registrará en cuanto lo guardes.')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear fijo'));
    await waitFor(() => expect(finance().transactions).toHaveLength(1));
    expect(finance().recurring[0]).toMatchObject({ name: 'Netflix', categoryId: 'suscripciones', frequency: 'monthly', day: 6 });
    expect(finance().transactions[0]).toMatchObject({ amount: 219, categoryId: 'suscripciones', note: 'Netflix', date: '2026-10-06' });

    // En el Resumen: lo de este mes, el próximo cobro y lo que cuestan las suscripciones al año.
    expect(await screen.findByLabelText('Gastos fijos este mes: $219')).toBeTruthy();
    expect(screen.getByText('Ya se pagó todo lo de este mes.')).toBeTruthy();
    expect(screen.getByLabelText('Netflix: $219, el 6 nov')).toBeTruthy();
    expect(screen.getByText(/En suscripciones se te van \$219 al mes: \$2,628 al año/)).toBeTruthy();

    fireEvent.press(screen.getByText('Ver gastos fijos'));
    expect(await screen.findByText('El 6 de cada mes · se cobra el 6 nov')).toBeTruthy();
  });

  it('el Resumen dice cuánto falta de los fijos del mes y qué se cobra primero', async () => {
    const fixed = (id: string, name: string, amount: number, categoryId: string, day: number): Recurring => ({
      ...rent, id, name, amount, categoryId, day, startDate: '2026-09-01', lastApplied: '2026-10-06',
    });
    setup(['worker'], {
      recurring: [rent, fixed('r2', 'Internet', 499, 'servicios', 20), fixed('r3', 'Netflix', 219, 'suscripciones', 8)],
    });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    expect(await screen.findByLabelText('Gastos fijos este mes: $5,718')).toBeTruthy();
    expect(screen.getByText('Ya se pagaron $5,000 · faltan $718')).toBeTruthy();
    const upcoming = screen.getAllByLabelText(/^(Netflix|Internet|Renta): \$[\d,]+, /).map((e) => e.props.accessibilityLabel);
    expect(upcoming).toEqual(['Netflix: $219, en 2 días', 'Internet: $499, el 20 oct', 'Renta: $5,000, el 1 nov']);
  });

  it('al escribir el nombre de un servicio se elige sola su categoría', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Planes'));
    fireEvent.press(screen.getByLabelText('Nuevo gasto fijo'));
    await screen.findByText('Nuevo gasto fijo');
    type('Nombre del fijo', 'Spotify Duo');
    type('Importe del fijo', '179');
    fireEvent.press(screen.getByText('Crear fijo'));
    await waitFor(() => expect(finance().recurring).toHaveLength(1));
    expect(finance().recurring[0]).toMatchObject({ name: 'Spotify Duo', categoryId: 'suscripciones' });
    expect(await screen.findByText('En suscripciones: $179 al mes.')).toBeTruthy();
  });

  it('meta de ahorro: crear, abonar lo del mes y lograrla', async () => {
    setup(['student']);
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Planes'));
    fireEvent.press(screen.getByText('Nueva meta'));
    fireEvent.press(await screen.findByText('Celular nuevo'));
    type('Monto de la meta', '6000');
    fireEvent.press(screen.getByText('En 3 meses'));
    expect(screen.getByText('$2,000 al mes')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear meta'));

    fireEvent.press(await screen.findByLabelText('Abonar a Celular nuevo'));
    fireEvent.press(await screen.findByText('Lo del mes: $2,000'));
    fireEvent.press(screen.getAllByText('Abonar').at(-1)!);
    expect(await screen.findByText('Aparta $2,000 al mes hasta el 6 ene 2027')).toBeTruthy();
    expect(screen.getByText('Ahorro')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Abonar a Celular nuevo'));
    fireEvent.press(await screen.findByText('Lo que falta: $4,000'));
    fireEvent.press(screen.getAllByText('Abonar').at(-1)!);
    expect(await screen.findByText('¡Lograda el 6 oct!')).toBeTruthy();
    expect(screen.queryByLabelText('Abonar a Celular nuevo')).toBeNull();
  });
});

describe('plazos, créditos y jornadas por cobrar', () => {
  it('un préstamo de 4 meses: dice qué pago va y cuándo termina', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Planes'));
    fireEvent.press(screen.getByLabelText('Nuevo gasto fijo'));
    await screen.findByText('Nuevo gasto fijo');
    type('Nombre del fijo', 'Préstamo');
    type('Importe del fijo', '1250');
    fireEvent.press(screen.getAllByText('Otros gastos').at(-1)!);
    fireEvent.press(screen.getByText('Mañana'));
    fireEvent.press(screen.getByText('Un número de pagos'));
    expect(screen.getByText('4 pagos de $1,250 · el último, 7 ene 2027 · en total $5,000')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Más: Número de pagos'));
    expect(screen.getByText('5 pagos de $1,250 · el último, 7 feb 2027 · en total $6,250')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear fijo'));
    expect(await screen.findByText('Pago 1 de 5 · se cobra mañana')).toBeTruthy();
    expect(finance().recurring[0]).toMatchObject({ count: 5, day: 7, startDate: '2026-10-07' });
  });

  it('un crédito con compras a meses: cuánto toca pagar, cuánto debe y liquidar', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Planes'));
    fireEvent.press(screen.getByLabelText('Nuevo crédito'));
    await screen.findByText('Nuevo crédito');
    fireEvent.press(screen.getByText('Coppel'));
    fireEvent.press(screen.getByText('Crear crédito'));
    await waitFor(() => expect(finance().credits).toEqual([expect.objectContaining({ name: 'Coppel', day: 6 })]));

    fireEvent.press(await screen.findByLabelText('Agregar compra a Coppel'));
    await screen.findByText('Compra con Coppel');
    type('Qué compraste', 'Refri');
    type('Monto de la compra', '9000');
    fireEvent.press(screen.getByText('12 meses'));
    fireEvent.press(screen.getAllByText('Otros gastos').at(-1)!);
    // Lo que se compra hoy se empieza a pagar el próximo día de pago.
    expect(screen.getByText('12 pagos de $750 · terminas el 6 oct 2027.')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Agregar compra').at(-1)!);

    expect(await screen.findByLabelText('Próximo pago de Coppel: $750, el 6 nov')).toBeTruthy();
    expect(screen.getByLabelText('Debes $9,000')).toBeTruthy();

    // Lo liquida de una vez.
    fireEvent.press(screen.getByLabelText(/^Compra Refri/));
    fireEvent.press(await screen.findByText('Liquidar ($9,000)'));
    await waitFor(() => expect(finance().transactions).toEqual([expect.objectContaining({ amount: 9000, note: 'Refri (liquidación)' })]));
    expect(await screen.findByText('Liquidadas: Refri.')).toBeTruthy();
  });

  it('lo de Uber va «por cobrar» hasta el lunes, o hasta marcarlo como cobrado', async () => {
    const monday = makeTx({
      kind: 'income', categoryId: 'viajes', date: '2026-10-05', amount: 1600,
      shift: { hours: 8, platforms: [{ platform: 'Uber', amount: 1200, trips: 14 }, { platform: 'inDrive', amount: 400, trips: 5 }] },
    });
    setup(['driver'], { transactions: [monday] });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    // inDrive (efectivo) ya cuenta; lo de Uber llega el lunes 12.
    expect(await screen.findByLabelText('Balance: $400')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Por cobrar: $1,200'));
    expect(await screen.findByText('Llega el lunes 12')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ya me pagaron: Ayer'));
    expect(await screen.findByLabelText('Balance: $1,600')).toBeTruthy();
    expect(screen.queryByLabelText(/^Por cobrar/)).toBeNull();
  });

  it('dejar de pagar una suscripción: lo pagado se queda y se ve en Terminados', async () => {
    setup(['worker'], {
      recurring: [{
        id: 'cl', kind: 'expense', name: 'Claude', amount: 400, categoryId: 'suscripciones', frequency: 'monthly', day: 6,
        startDate: '2026-08-06', lastApplied: '2026-10-06', createdAt: '2026-08-06T12:00:00.000Z',
      }],
      transactions: ['2026-08-06', '2026-09-06', '2026-10-06'].map((date) =>
        makeTx({ amount: 400, categoryId: 'suscripciones', note: 'Claude', date, recurringId: 'cl' })),
    });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Planes'));
    fireEvent.press(screen.getByLabelText(/^Fijo Claude/));
    fireEvent.press(await screen.findByText('Ya no lo pago'));
    expect(await screen.findByText('Se queda lo que pagaste: $1,200 en 3 cobros.')).toBeTruthy();
    fireEvent.press(screen.getByText('Dejar de pagarlo'));
    expect(await screen.findByText(/Lo dejaste de pagar el 6 oct · pagaste \$1,200 en 3 pagos/)).toBeTruthy();
    expect(finance().transactions).toHaveLength(3);
    expect(screen.queryByLabelText(/^Fijo Claude/)).toBeNull();
  });

  it('abonos: fecha fija, importe distinto cada vez, y lo que se debe', async () => {
    setup(['worker']);
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Planes'));
    fireEvent.press(screen.getByLabelText('Nuevo gasto fijo'));
    await screen.findByText('Nuevo gasto fijo');
    type('Nombre del fijo', 'Préstamo de mi tío');
    fireEvent.press(screen.getAllByText('Otros gastos').at(-1)!);
    fireEvent.press(screen.getByText('Varía (abonos)'));
    type('Abono sugerido', '500');
    fireEvent.press(screen.getByText('Quincenal'));
    fireEvent.press(screen.getByText('Hasta pagar un total'));
    type('Total que debes', '3000');
    expect(screen.getByText('Primer abono: 15 oct')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear fijo'));
    expect(await screen.findByText('Abonos · el próximo el 15 oct')).toBeTruthy();
    expect(screen.getByText('Debes $3,000 de $3,000')).toBeTruthy();
    expect(finance().transactions).toEqual([]);

    // Abona antes de la fecha, y más de lo sugerido.
    fireEvent.press(screen.getByLabelText('Abonar a Préstamo de mi tío'));
    await screen.findByText('Abonar a Préstamo de mi tío');
    type('Importe del abono', '800');
    expect(screen.getByText('Después de este abono debes $2,200.')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar abono'));
    expect(await screen.findByText('Debes $2,200 de $3,000')).toBeTruthy();
    expect(screen.getByText('Abonos · el próximo el 31 oct')).toBeTruthy();
  });

  it('el Resumen dice cómo cierra el mes con los fijos, las deudas y el gasto del día a día', async () => {
    const fixed = (r: Partial<Recurring> & Pick<Recurring, 'id' | 'name' | 'amount'>): Recurring => ({
      kind: 'expense', categoryId: 'renta', frequency: 'monthly', day: 1, startDate: '2026-09-01', lastApplied: '2026-10-06',
      createdAt: '2026-09-01T12:00:00.000Z', ...r,
    });
    setup(['worker'], {
      recurring: [
        fixed({ id: 'renta', name: 'Renta', amount: 4500 }),
        fixed({ id: 'sueldo', name: 'Sueldo', amount: 6000, kind: 'income', categoryId: 'sueldo', frequency: 'biweekly', day: 0 }),
        fixed({ id: 'nf', name: 'Netflix', amount: 219, categoryId: 'suscripciones', day: 20 }),
      ],
      transactions: [makeTx({ amount: 300, date: '2026-10-01' }), makeTx({ amount: 4500, categoryId: 'renta', date: '2026-10-01', recurringId: 'renta' })],
    });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    // −4800 de hoy + 12000 de las quincenas − 219 de Netflix − 42.86 al día × 25 días.
    expect(await screen.findByLabelText('Así cierras octubre: $5,909.50')).toBeTruthy();
    expect(screen.getByLabelText('Proyección al cierre del mes: $5,910')).toBeTruthy();
    expect(screen.getByLabelText('Lo que aún te entra: +$12,000')).toBeTruthy();
  });

  it('en el Resumen, las flechas recorren los días', async () => {
    setup(['worker'], { transactions: [makeTx({ amount: 120, date: '2026-10-06' }), makeTx({ amount: 80, date: '2026-10-05' })] });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press((await screen.findAllByLabelText('Día anterior'))[0]);
    expect(await screen.findByText('Hoy · ingresos $0 · gastos $120')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Día anterior'));
    expect(screen.getByText('Ayer · ingresos $0 · gastos $80')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Día siguiente'));
    expect(screen.getByText('Hoy · ingresos $0 · gastos $120')).toBeTruthy();
  });

  it('en Movimientos, los gastos se ven en rojo y los ingresos en verde', async () => {
    setup(['worker'], {
      transactions: [
        makeTx({ amount: 120, note: 'Tacos', date: '2026-10-06' }),
        makeTx({ kind: 'income', categoryId: 'sueldo', amount: 6000, note: 'Quincena', date: '2026-10-06' }),
      ],
    });
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    fireEvent.press(await screen.findByText('Movimientos'));
    await screen.findByLabelText('Tacos, −$120');
    const color = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style).color;
    expect(color('−$120')).toBe('#CF222E');
    expect(color('+$6,000')).toBe('#1F883D');
  });
});

describe('ajustes y pestañas', () => {
  it('añadir un perfil suma sus categorías; borrar Finanzas vuelve a empezar sin tocar los hábitos', async () => {
    setup(['worker']);
    useHabits.setState({ habits: [makeHabit()] });
    renderRouter(APP_DIR, { initialUrl: '/finance/settings' });
    fireEvent.press(await screen.findByLabelText('Conductor de app'));
    expect(finance().profiles).toEqual(['worker', 'driver']);
    expect(finance().categories.map((c) => c.id)).toContain('viajes');
    expect(await screen.findByText('Plataformas')).toBeTruthy();

    // Al menos un perfil.
    fireEvent.press(screen.getByLabelText('Trabajador'));
    fireEvent.press(screen.getByLabelText('Conductor de app'));
    expect(finance().profiles).toEqual(['driver']);

    fireEvent.press(screen.getByText('Borrar todos los datos de Finanzas'));
    await waitFor(() => expect(finance().profiles).toEqual([]));
    expect(useHabits.getState().habits).toHaveLength(1);
  });

  it('con euros los importes se ven y se leen a la europea', async () => {
    setup(['worker'], { currency: 'EUR' });
    renderRouter(APP_DIR, { initialUrl: '/finance/entry?kind=expense' });
    await screen.findByLabelText('Importe');
    type('Importe', '1.234,50');
    fireEvent.press(screen.getByText('Comida'));
    fireEvent.press(screen.getByText('Guardar gasto'));
    await waitFor(() => expect(finance().transactions[0]?.amount).toBe(1234.5));
  });

  it('se pasa de Hábitos a Finanzas con la barra inferior', async () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Empieza tu primer hábito')).toBeTruthy();
    fireEvent.press(screen.getByText('Finanzas'));
    expect(await screen.findByText('Tus finanzas, claras')).toBeTruthy();
    expect(screen).toHavePathname('/finance');
    fireEvent.press(screen.getByText('Hábitos'));
    expect(await screen.findByText('Empieza tu primer hábito')).toBeTruthy();
  });
});
