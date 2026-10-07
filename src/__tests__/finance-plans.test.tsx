/**
 * Lo nuevo de Finanzas en la vida real, con el reloj avanzando y la app en la mano:
 * - Carlos maneja con Uber (le paga los lunes), DiDi (los martes) e inDrive (efectivo).
 * - Mariana cobra por quincena y tiene Netflix, Claude, unos lentes en 2 quincenas, un préstamo de
 *   4 meses y un celular a 12 meses en Coppel; de octubre a febrero.
 * - Rosa le paga a su comadre un préstamo con abonos: cada quincena lo que puede.
 * - Ana abre la app por primera vez y crea un hábito desde las sugerencias.
 * Los resultados se comparan con cuentas hechas a mano (en los comentarios).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';
import { Alert, AlertButton } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { FitGrid } from '@/components/FitGrid';
import type { DateKey } from '@/lib/dates';
import { useFinance } from '@/store/finance';
import { useHabits } from '@/store/habits';

const APP_DIR = path.resolve(__dirname, '../app');
const finance = () => useFinance.getState();
const habits = () => useHabits.getState();
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
const tap = (label: string) => fireEvent.press(screen.getByLabelText(label));
/** Lo apuntado de un fijo (por su nombre), por fecha. */
const paymentsOf = (name: string) => {
  const r = finance().recurring.find((x) => x.name === name)!;
  return finance().transactions.filter((t) => t.recurringId === r.id).sort((a, b) => a.date.localeCompare(b.date));
};

/** Las cuadrículas se dibujan al saber su ancho (en el teléfono lo da la pantalla; aquí, a mano). */
const showGrids = () =>
  screen.UNSAFE_getAllByType(FitGrid).forEach((grid) =>
    fireEvent(grid.children[0] as ReactTestInstance, 'layout', { nativeEvent: { layout: { width: 340, height: 300, x: 0, y: 0 } } }));

const at = (key: DateKey, hour = 12) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
};

/** Abre la app ese día a esa hora (como quien la abre desde el teléfono). */
function openApp(key: DateKey, hour: number, url = '/finance') {
  jest.setSystemTime(at(key, hour));
  return renderRouter(APP_DIR, { initialUrl: url });
}

const spend = (date: DateKey, amount: number, categoryId: string, note = '') =>
  finance().addTransaction({ kind: 'expense', amount, categoryId, date, note, shift: null, fuel: null });

const fuel = (date: DateKey, amount: number, liters: number, odometer: number) =>
  finance().addTransaction({ kind: 'expense', amount, categoryId: 'gasolina', date, note: '', shift: null, fuel: { liters, odometer, fullTank: false } });

const shift = (date: DateKey, hours: number, ...platforms: [string, number, number][]) =>
  finance().addTransaction({
    kind: 'income', amount: 1, categoryId: 'viajes', date, note: '', fuel: null,
    shift: { hours, platforms: platforms.map(([platform, amount, trips]) => ({ platform, amount, trips })) },
  });

beforeEach(async () => {
  jest.useFakeTimers({ now: at('2026-10-04', 20), advanceTimers: true });
  await AsyncStorage.clear();
  useHabits.setState({ habits: [], completions: {}, customCategories: [], settings: { showHeatmaps: true, compactTipSeen: true }, hasHydrated: true });
  finance().resetFinance();
  useFinance.setState({ hasHydrated: true });
  // Confirma los diálogos (Liquidar…).
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.[1].onPress?.());
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Carlos, conductor: cada app le paga en su día (semana del lunes 5 al domingo 11 de octubre)', () => {
  it('lo de Uber y DiDi va «por cobrar» hasta su día de pago; lo de inDrive entra al momento', async () => {
    finance().setProfiles(['driver']);

    // Domingo 4 por la noche: le dice a la app que DiDi le deposita los martes (Uber ya viene en lunes).
    let app = openApp('2026-10-04', 21, '/finance/settings');
    expect(await screen.findByLabelText('Cuándo paga Uber: Cada lunes')).toBeTruthy();
    expect(screen.getByLabelText('Cuándo paga inDrive: Al momento')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Cuándo paga DiDi: Al momento'));
    fireEvent.press(await screen.findByText('Cada martes'));
    expect(await screen.findByLabelText('Cuándo paga DiDi: Cada martes')).toBeTruthy();
    app.unmount();

    // Lunes 5 en la noche: apunta su jornada con Uber e inDrive.
    fuel('2026-10-05', 500, 20.4, 52100);
    spend('2026-10-05', 100, 'comida');
    app = openApp('2026-10-05', 22);
    fireEvent.press(await screen.findByLabelText('Registrar jornada'));
    await screen.findByLabelText('Ganancia en Uber');
    tap('inDrive');
    type('Ganancia en Uber', '1,350');
    type('Viajes en Uber', '16');
    type('Ganancia en inDrive', '400');
    type('Viajes en inDrive', '5');
    type('Horas conectado', '9');
    // Antes de guardar ya sabe cuándo le llega.
    expect(screen.getByText(/^Uber te lo paga el lunes 12: hasta entonces se ve aparte del balance/)).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar jornada'));
    await waitFor(() => expect(screen).toHavePathname('/finance'));
    // inDrive (efectivo) ya está: 400 − 500 de gasolina − 100 de comida = −200. Lo de Uber, aparte.
    expect(await screen.findByLabelText('Balance: −$200')).toBeTruthy();
    expect(screen.getByLabelText('Por cobrar: $1,350')).toBeTruthy();
    expect(screen.getByText('(+$1,350 por cobrar · llega el lunes 12)')).toBeTruthy();
    app.unmount();

    // Martes a jueves.
    shift('2026-10-06', 9, ['Uber', 1180, 14], ['DiDi', 450, 6]);
    spend('2026-10-06', 100, 'comida');
    shift('2026-10-07', 9.5, ['Uber', 1420, 17]);
    fuel('2026-10-07', 400, 16.3, 52480);
    spend('2026-10-07', 100, 'comida');
    shift('2026-10-08', 8, ['Uber', 900, 11], ['inDrive', 250, 3]);
    spend('2026-10-08', 100, 'comida');

    // Jueves 8 en la noche: retiró lo del miércoles al momento (cobro instantáneo) y lo marca.
    app = openApp('2026-10-08', 23);
    // Efectivo: 400 + 250 = 650; gastos: 500 + 400 de gasolina y 4 × 100 de comida = 1,300.
    expect(await screen.findByLabelText('Balance: −$650')).toBeTruthy();
    // Uber 1,350 + 1,180 + 1,420 + 900 = 4,850, y DiDi 450.
    fireEvent.press(screen.getByLabelText('Por cobrar: $5,300'));
    // Lunes, miércoles y jueves llegan el lunes; el martes, cada app en su día.
    expect(await screen.findAllByText('Llega el lunes 12')).toHaveLength(3);
    expect(screen.getByText('Uber llega el lunes 12; DiDi, el martes 13')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ya me pagaron: Ayer'));
    // −650 + 1,420 = 770; por cobrar, 5,300 − 1,420.
    expect(await screen.findByLabelText('Balance: $770')).toBeTruthy();
    expect(screen.getByLabelText('Por cobrar: $3,880')).toBeTruthy();
    app.unmount();

    // Viernes y sábado; el domingo descansa.
    shift('2026-10-09', 10, ['Uber', 1600, 19], ['inDrive', 300, 4]);
    fuel('2026-10-09', 450, 18.4, 52900);
    spend('2026-10-09', 100, 'comida');
    shift('2026-10-10', 11, ['Uber', 1850, 21], ['DiDi', 500, 6]);

    // Domingo 11 en la noche: revisa cómo le fue.
    app = openApp('2026-10-11', 21);
    // Efectivo: inDrive 950 + el miércoles 1,420 = 2,370; gastos: gasolina 1,350 + comida 500 = 1,850.
    expect(await screen.findByLabelText('Balance: $520')).toBeTruthy();
    // Uber: 1,350 + 1,180 + 900 + 1,600 + 1,850 = 6,880 (sin el miércoles); DiDi: 450 + 500 = 950.
    expect(screen.getByLabelText('Por cobrar: $7,830')).toBeTruthy();
    // Manejando cuenta lo trabajado (por día de jornada), cobrado o no: 8,300 + 950 + 950.
    expect(screen.getByText('$10,200')).toBeTruthy();
    expect(screen.getByText('−$1,350')).toBeTruthy();
    expect(screen.getByText('$8,850')).toBeTruthy();
    expect(screen.getByText('De lo ganado, $7,830 aún no te lo pagan: llega entre el lunes 12 y el martes 13.')).toBeTruthy();

    // Con las flechas va de día en día; el día elegido queda marcado aunque no tenga número en el eje.
    const back = () => fireEvent.press(screen.getAllByLabelText('Día anterior')[0]);
    back();
    expect(await screen.findByText('Hoy · sin jornada')).toBeTruthy();
    back();
    expect(screen.getByText('Ayer · Uber $1,850 · DiDi $500')).toBeTruthy();
    back();
    expect(screen.getByText('Viernes 9 · Uber $1,600 · inDrive $300')).toBeTruthy();
    expect(screen.getByLabelText('Viernes 9: Uber $1,600, inDrive $300').props.accessibilityState).toMatchObject({ selected: true });
    app.unmount();

    // Lunes 12: Uber le deposita la semana (menos lo que ya retiró). La semana nueva empieza con eso.
    app = openApp('2026-10-12', 9);
    expect(await screen.findByLabelText('Balance: $6,880')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Por cobrar: $950'));
    // Lo de DiDi del martes y del sábado.
    expect(await screen.findAllByText('Llega el martes 13')).toHaveLength(2);
    app.unmount();

    // Martes 13: llega lo de DiDi y ya no queda nada por cobrar.
    app = openApp('2026-10-13', 9);
    expect(await screen.findByLabelText('Balance: $7,830')).toBeTruthy();
    expect(screen.queryByLabelText(/^Por cobrar/)).toBeNull();
    app.unmount();
  });
});

describe('Mariana, de quincena: suscripciones, plazos y un crédito (octubre a febrero)', () => {
  it('cada fijo se apunta en su fecha, los plazos terminan solos y lo que deja se queda', async () => {
    finance().setProfiles(['worker']);
    finance().addRecurring({ kind: 'income', name: 'Sueldo', amount: 7500, categoryId: 'sueldo', frequency: 'biweekly', day: 0 }, '2026-10-06');

    // Martes 6 de octubre: da de alta sus pagos desde Planes.
    let app = openApp('2026-10-06', 13);
    fireEvent.press(await screen.findByText('Planes'));
    const newFixed = async () => {
      fireEvent.press(screen.getByLabelText('Nuevo gasto fijo'));
      await screen.findByText('Nuevo gasto fijo');
    };

    // Netflix: de un toque (nombre y categoría), se cobra el 20.
    await newFixed();
    tap('Netflix');
    type('Importe del fijo', '249');
    fireEvent.press(screen.getByText('Elegir día'));
    tap('Elegir 2026-10-20');
    expect(screen.getByText('Primer registro: 20 oct')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear fijo'));
    expect(await screen.findByLabelText(/^Fijo Netflix/)).toBeTruthy();

    // Claude: no está en la lista; lo escribe y elige la categoría. Se cobra hoy.
    await newFixed();
    type('Nombre del fijo', 'Claude');
    tap('Suscripciones');
    type('Importe del fijo', '370');
    expect(screen.getByText('Hoy toca: se registrará en cuanto lo guardes.')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear fijo'));
    await waitFor(() => expect(paymentsOf('Claude').map((t) => t.date)).toEqual(['2026-10-06']));

    // Unos lentes en 2 quincenas.
    await newFixed();
    type('Nombre del fijo', 'Lentes');
    tap('Salud');
    type('Importe del fijo', '1100');
    fireEvent.press(screen.getByText('Quincenal'));
    fireEvent.press(screen.getByText('Un número de pagos'));
    fireEvent.press(screen.getByLabelText('Menos: Número de pagos'));
    fireEvent.press(screen.getByLabelText('Menos: Número de pagos'));
    expect(screen.getByText('2 pagos de $1,100 · el último, 31 oct · en total $2,200')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear fijo'));
    expect(await screen.findByText('Pago 1 de 2 · se cobra el 15 oct')).toBeTruthy();

    // Un préstamo de la caja de ahorro: 4 meses, el día 30.
    await newFixed();
    type('Nombre del fijo', 'Préstamo de la caja');
    tap('Otros gastos');
    type('Importe del fijo', '1,250');
    fireEvent.press(screen.getByText('Elegir día'));
    tap('Elegir 2026-10-30');
    fireEvent.press(screen.getByText('Un número de pagos'));
    expect(screen.getByText('4 pagos de $1,250 · el último, 30 ene 2027 · en total $5,000')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear fijo'));
    expect(await screen.findByText('Pago 1 de 4 · se cobra el 30 oct')).toBeTruthy();

    // Coppel: se paga el 25. Hoy sacó un celular a 12 meses.
    fireEvent.press(screen.getByLabelText('Nuevo crédito'));
    await screen.findByText('Nuevo crédito');
    fireEvent.press(screen.getByText('Coppel'));
    showGrids();
    tap('Día 25');
    fireEvent.press(screen.getByText('Crear crédito'));
    fireEvent.press(await screen.findByLabelText('Agregar compra a Coppel'));
    await screen.findByText('Compra con Coppel');
    type('Qué compraste', 'Celular');
    type('Monto de la compra', '6000');
    fireEvent.press(screen.getByText('12 meses'));
    fireEvent.press(screen.getAllByLabelText('Celular').at(-1)!);
    expect(screen.getByText('12 pagos de $500 · terminas el 25 sep 2027.')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Agregar compra').at(-1)!);
    expect(await screen.findByLabelText('Próximo pago de Coppel: $500, el 25 oct')).toBeTruthy();

    // Lo que viene en octubre: dos quincenas; Netflix 249 + lentes 2,200 + caja 1,250 + Coppel 500.
    fireEvent.press(screen.getByText('Resumen'));
    expect(await screen.findByLabelText('Lo que aún te entra: +$15,000')).toBeTruthy();
    expect(screen.getByLabelText('Fijos, mensualidades y abonos: −$4,199')).toBeTruthy();
    // Lo que debe: lentes 2,200 + caja 5,000 + celular 6,000.
    expect(screen.getByText(/^Debes \$13,200 entre mensualidades, compras a meses y abonos; lo que tiene fecha lo terminas el 25 sep 2027/)).toBeTruthy();
    app.unmount();

    // Domingo 1 de noviembre: todo octubre quedó apuntado en su fecha.
    app = openApp('2026-11-01', 9);
    fireEvent.press(await screen.findByText('Planes'));
    expect(paymentsOf('Sueldo').map((t) => t.date)).toEqual(['2026-10-15', '2026-10-31']);
    expect(paymentsOf('Netflix').map((t) => t.date)).toEqual(['2026-10-20']);
    expect(paymentsOf('Lentes').map((t) => t.date)).toEqual(['2026-10-15', '2026-10-31']);
    expect(paymentsOf('Préstamo de la caja').map((t) => t.date)).toEqual(['2026-10-30']);
    expect(paymentsOf('Celular').map((t) => t.date)).toEqual(['2026-10-25']);
    // Los lentes ya se pagaron; el préstamo va en el 2.
    expect(screen.getByText('Terminó el 31 oct · pagaste $2,200 en 2 pagos')).toBeTruthy();
    expect(screen.getByText('Pago 2 de 4 · se cobra el 30 nov')).toBeTruthy();
    expect(screen.getByLabelText('Compra Celular: 1 de 12, faltan $5,500')).toBeTruthy();
    app.unmount();

    // Jueves 10 de diciembre: cancela Claude (el último cobro fue el 6).
    app = openApp('2026-12-10', 20);
    fireEvent.press(await screen.findByText('Planes'));
    fireEvent.press(screen.getByLabelText(/^Fijo Claude/));
    fireEvent.press(await screen.findByText('Ya no lo pago'));
    // Octubre, noviembre y diciembre: 3 × 370.
    expect(await screen.findByText('Se queda lo que pagaste: $1,110 en 3 cobros.')).toBeTruthy();
    fireEvent.press(screen.getByText('Dejar de pagarlo'));
    expect(await screen.findByText('Lo dejaste de pagar el 6 dic · pagaste $1,110 en 3 pagos')).toBeTruthy();
    app.unmount();

    // Sábado 16 de enero: con el aguinaldo liquida el celular (lleva 3 de 12).
    app = openApp('2027-01-16', 11);
    fireEvent.press(await screen.findByText('Planes'));
    expect(paymentsOf('Claude')).toHaveLength(3); // el 6 de enero ya no se cobró
    fireEvent.press(screen.getByLabelText('Compra Celular: 3 de 12, faltan $4,500'));
    fireEvent.press(await screen.findByText('Liquidar ($4,500)'));
    expect(await screen.findByText('Liquidadas: Celular.')).toBeTruthy();
    expect(screen.getByText('Sin compras por pagar.')).toBeTruthy();
    expect(paymentsOf('Celular').map((t) => t.amount)).toEqual([500, 500, 500, 4500]);
    app.unmount();

    // Lunes 1 de febrero: el préstamo de la caja terminó solo el 30 de enero.
    app = openApp('2027-02-01', 9);
    fireEvent.press(await screen.findByText('Planes'));
    expect(screen.getByText('Terminó el 30 ene · pagaste $5,000 en 4 pagos')).toBeTruthy();
    expect(paymentsOf('Préstamo de la caja')).toHaveLength(4);
    expect(paymentsOf('Netflix')).toHaveLength(4); // octubre a enero; sigue
    expect(paymentsOf('Sueldo')).toHaveLength(8);
    app.unmount();

    // Febrero solo trae sueldo y Netflix: nada de lo terminado vuelve a cobrarse.
    app = openApp('2027-02-28', 21);
    await screen.findByText('Planes');
    expect(paymentsOf('Préstamo de la caja')).toHaveLength(4);
    expect(paymentsOf('Lentes')).toHaveLength(2);
    expect(paymentsOf('Claude')).toHaveLength(3);
    expect(paymentsOf('Celular')).toHaveLength(4);
    expect(paymentsOf('Netflix').at(-1)!.date).toBe('2027-02-20');
    expect(paymentsOf('Sueldo').at(-1)!.date).toBe('2027-02-28');
    app.unmount();
  });

  it('apunta lo del veterinario con una categoría nueva, y la próxima vez ya está en la lista', async () => {
    finance().setProfiles(['worker']);
    let app = openApp('2026-10-06', 19);
    fireEvent.press(await screen.findByLabelText('Registrar gasto'));
    await screen.findByLabelText('Importe');
    type('Importe', '650');
    fireEvent.press(screen.getByText('Nueva categoría'));
    fireEvent.changeText(screen.getByPlaceholderText('Nombre de la categoría'), 'Mascotas');
    fireEvent.press(screen.getAllByText('Añadir').at(-1)!);
    // Queda elegida y la lista se cierra.
    expect(await screen.findByLabelText('Categoría: Mascotas. Cambiar')).toBeTruthy();
    type('Nota', 'Vacuna del Firulais');
    fireEvent.press(screen.getByText('Guardar gasto'));
    await waitFor(() => expect(screen).toHavePathname('/finance'));
    app.unmount();

    app = openApp('2026-10-20', 19);
    fireEvent.press(await screen.findByLabelText('Registrar gasto'));
    await screen.findByLabelText('Importe');
    type('Importe', '380');
    tap('Mascotas');
    fireEvent.press(screen.getByText('Guardar gasto'));
    await waitFor(() => expect(screen).toHavePathname('/finance'));
    const mascotas = finance().categories.find((c) => c.name === 'Mascotas')!;
    expect(finance().transactions.filter((t) => t.categoryId === mascotas.id).map((t) => t.amount)).toEqual([650, 380]);
    app.unmount();
  });
});

describe('Rosa: le paga a su comadre $6,000 con abonos quincenales (lo que puede cada vez)', () => {
  it('le avisa cuándo toca, acepta abonos distintos, saltarse uno, y lo da por liquidado', async () => {
    finance().setProfiles(['worker']);
    const name = 'Préstamo de mi comadre';
    const alert = () => screen.queryByText(new RegExp(`^Toca abonar a ${name}`));

    // Martes 6 de octubre: lo da de alta.
    let app = openApp('2026-10-06', 13);
    fireEvent.press(await screen.findByText('Planes'));
    fireEvent.press(screen.getByLabelText('Nuevo gasto fijo'));
    await screen.findByText('Nuevo gasto fijo');
    type('Nombre del fijo', name);
    tap('Otros gastos');
    fireEvent.press(screen.getByText('Varía (abonos)'));
    type('Abono sugerido', '1000');
    fireEvent.press(screen.getByText('Quincenal'));
    fireEvent.press(screen.getByText('Hasta pagar un total'));
    type('Total que debes', '6,000');
    expect(screen.getByText('Primer abono: 15 oct')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear fijo'));
    expect(await screen.findByText('Debes $6,000 de $6,000')).toBeTruthy();
    app.unmount();

    // Jueves 15: toca abonar; solo junta 700.
    app = openApp('2026-10-15', 20);
    expect(await screen.findByText(`Toca abonar a ${name} hoy: $1,000`)).toBeTruthy();
    fireEvent.press(alert()!);
    await screen.findByText(`Abonar a ${name}`);
    expect(screen.getByText('Debes $6,000')).toBeTruthy();
    expect(screen.getByDisplayValue('1000')).toBeTruthy(); // lo sugerido, ya escrito
    type('Importe del abono', '700');
    expect(screen.getByText('Después de este abono debes $5,300.')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar abono'));
    await waitFor(() => expect(alert()).toBeNull());
    app.unmount();

    // Lunes 2 de noviembre: el del 31 no lo pagó; avisa que está pendiente. Esta vez no abona.
    app = openApp('2026-11-02', 10);
    expect(await screen.findByText(`Toca abonar a ${name} (desde el 31 oct): $1,000`)).toBeTruthy();
    fireEvent.press(alert()!);
    fireEvent.press(await screen.findByText('Esta vez no abono'));
    await waitFor(() => expect(alert()).toBeNull());
    fireEvent.press(screen.getByText('Planes'));
    expect(await screen.findByText('Abonos · el próximo el 15 nov')).toBeTruthy();
    expect(screen.getByText('Debes $5,300 de $6,000')).toBeTruthy();
    app.unmount();

    // Lunes 16: el domingo le dio 1,500 y lo apunta hoy con fecha de ayer.
    app = openApp('2026-11-16', 9);
    fireEvent.press(await screen.findByText(`Toca abonar a ${name} (desde el 15 nov): $1,000`));
    await screen.findByText(`Abonar a ${name}`);
    type('Importe del abono', '1,500');
    fireEvent.press(screen.getByText('Ayer'));
    fireEvent.press(screen.getByText('Guardar abono'));
    await waitFor(() => expect(alert()).toBeNull());
    // Lo que viene ya cuenta solo lo que falta.
    expect(screen.getByText(/^Debes \$3,800 entre mensualidades, compras a meses y abonos/)).toBeTruthy();
    app.unmount();

    // Lunes 30: abona 1,800 a tiempo.
    app = openApp('2026-11-30', 19);
    fireEvent.press(await screen.findByText(`Toca abonar a ${name} hoy: $1,000`));
    await screen.findByText(`Abonar a ${name}`);
    type('Importe del abono', '1,800');
    fireEvent.press(screen.getByText('Guardar abono'));
    await waitFor(() => expect(alert()).toBeNull());
    app.unmount();

    // Martes 15 de diciembre: paga los 2,000 que faltan y queda liquidado.
    app = openApp('2026-12-15', 18);
    fireEvent.press(await screen.findByText(`Toca abonar a ${name} hoy: $1,000`));
    await screen.findByText(`Abonar a ${name}`);
    expect(screen.getByText('Debes $2,000')).toBeTruthy();
    type('Importe del abono', '2,000');
    expect(screen.getByText('¡Con este abono lo liquidas!')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar abono'));
    await waitFor(() => expect(alert()).toBeNull());
    fireEvent.press(screen.getByText('Planes'));
    expect(await screen.findByText('Liquidado el 15 dic · pagaste $6,000 en 4 pagos')).toBeTruthy();
    expect(paymentsOf(name).map((t) => [t.date, t.amount])).toEqual([
      ['2026-10-15', 700], ['2026-11-15', 1500], ['2026-11-30', 1800], ['2026-12-15', 2000],
    ]);
    app.unmount();

    // En enero ya no avisa nada.
    app = openApp('2027-01-15', 12);
    await screen.findByText('Resumen');
    expect(alert()).toBeNull();
    app.unmount();
  });
});

describe('Ana abre la app por primera vez', () => {
  it('ve el logo, elige una sugerencia de la segunda fila y crea su hábito', async () => {
    const app = openApp('2026-10-06', 21, '/');
    expect(await screen.findByText('Empieza tu primer hábito')).toBeTruthy();
    fireEvent.press(screen.getByText('Crear hábito'));
    await screen.findByText('Sugerencias');
    // Doce sugerencias en dos filas que se deslizan de lado.
    expect(screen.getAllByTestId('chip-row')).toHaveLength(2);
    fireEvent.press(screen.getByText('Registrar gastos'));
    expect(screen.getByDisplayValue('Registrar gastos')).toBeTruthy();
    expect(screen.queryByText('Sugerencias')).toBeNull();
    const next = () => fireEvent.press(screen.getByText('Siguiente'));
    next();
    next();
    next();
    fireEvent.press(screen.getAllByText('Crear hábito').at(-1)!);
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(habits().habits).toEqual([expect.objectContaining({ name: 'Registrar gastos', categories: ['finanzas'], reminders: ['22:00'] })]);
    app.unmount();
  });
});
