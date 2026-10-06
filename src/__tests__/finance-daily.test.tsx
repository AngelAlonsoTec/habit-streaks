/**
 * El día a día de verdad, con la app en la mano: una semana de un conductor de Uber y DiDi,
 * un mes de un trabajador de quincena y dos meses de una estudiante con mesada y beca.
 * Los resultados se comparan con cuentas hechas a mano (en los comentarios).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';

import type { DateKey } from '@/lib/dates';
import { driverStats, fuelEfficiency, periodRange, periodTotals, totalsByCategory, Transaction } from '@/lib/finance';
import { chunkedStorage } from '@/lib/storage';
import { useFinance } from '@/store/finance';
import { useHabits } from '@/store/habits';

const APP_DIR = path.resolve(__dirname, '../app');
const finance = () => useFinance.getState();
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
/** Los chips llevan su nombre como etiqueta (el resumen de detrás también dice "Comida"). */
const tap = (label: string) => fireEvent.press(screen.getByLabelText(label));
/** Fijos apuntados, por fecha. */
const fixedLog = () => finance().transactions.filter((t) => t.recurringId).sort((a, b) => a.date.localeCompare(b.date));

const at = (key: DateKey, hour = 12, minute = 0) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute);
};

/** Abre la app ese día a esa hora (como quien la abre desde el teléfono). */
function openApp(key: DateKey, hour: number, url = '/finance') {
  jest.setSystemTime(at(key, hour));
  return renderRouter(APP_DIR, { initialUrl: url });
}

const spend = (date: DateKey, amount: number, categoryId: string, note = '') =>
  finance().addTransaction({ kind: 'expense', amount, categoryId, date, note, shift: null, fuel: null });

const fuel = (date: DateKey, amount: number, liters: number, odometer: number, fullTank = false) =>
  finance().addTransaction({ kind: 'expense', amount, categoryId: 'gasolina', date, note: '', shift: null, fuel: { liters, odometer, fullTank } });

const shift = (date: DateKey, hours: number, ...platforms: [string, number, number][]) =>
  finance().addTransaction({
    kind: 'income', amount: 1, categoryId: 'viajes', date, note: '', fuel: null,
    shift: { hours, platforms: platforms.map(([platform, amount, trips]) => ({ platform, amount, trips })) },
  });

/** Los días de un mes que cumplen una condición (por día de la semana: 0 = domingo). */
const daysOf = (year: number, month: number, test: (weekday: number, day: number) => boolean): DateKey[] => {
  const out: DateKey[] = [];
  for (let d = 1; d <= new Date(year, month, 0).getDate(); d++) {
    if (test(new Date(year, month - 1, d).getDay(), d)) out.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
};

beforeEach(async () => {
  jest.useFakeTimers({ now: at('2026-10-04', 20), advanceTimers: true });
  await AsyncStorage.clear();
  useHabits.setState({ habits: [], completions: {}, customCategories: [], settings: { showHeatmaps: true, compactTipSeen: true }, hasHydrated: true });
  finance().resetFinance();
  useFinance.setState({ hasHydrated: true });
});
afterEach(() => jest.useRealTimers());

describe('conductor: una semana con Uber y DiDi (lunes 5 a domingo 11 de octubre)', () => {
  it('cuadra lo ganado, lo gastado en el auto, lo que deja por hora y el rendimiento', async () => {
    // Domingo por la noche: se configura y apunta la renta semanal del auto (se paga los lunes).
    finance().setProfiles(['driver']);
    finance().addRecurring(
      { kind: 'expense', name: 'Renta del auto', amount: 2800, categoryId: 'renta-auto', frequency: 'weekly', day: 0 },
      '2026-10-04',
    );

    // Lunes 7:00: abre la app y la renta ya está apuntada.
    let app = openApp('2026-10-05', 7);
    expect(await screen.findByLabelText('Balance: −$2,800')).toBeTruthy();

    // Llena el tanque antes de salir (escribe como lo escribe la gente).
    fireEvent.press(screen.getByLabelText('Registrar gasolina'));
    await screen.findByLabelText('Litros');
    type('Importe', '$900');
    type('Litros', '37.5 lts');
    type('Kilometraje', '52,100 km');
    fireEvent.press(screen.getByText('Guardar carga'));
    await waitFor(() => expect(screen).toHavePathname('/finance'));

    // Por la noche: trabajó con Uber y DiDi abiertas a la vez, 10 horas en total.
    fireEvent.press(screen.getByLabelText('Registrar jornada'));
    await screen.findByLabelText('Ganancia en Uber');
    tap('DiDi');
    type('Ganancia en Uber', '1,350');
    type('Viajes en Uber', '16 viajes');
    type('Ganancia en DiDi', '620');
    type('Viajes en DiDi', '8');
    type('Horas conectado', '10');
    expect(screen.getByText('Total de la jornada: $1,970')).toBeTruthy();
    // 1970 / 10 h = $197 por hora; 1970 / 24 viajes = $82.08 por viaje.
    expect(screen.getByText('$197 por hora · $82.08 por viaje')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar jornada'));
    await waitFor(() => expect(screen).toHavePathname('/finance'));

    fireEvent.press(screen.getByLabelText('Registrar gasto'));
    await screen.findByLabelText('Importe');
    type('Importe', '120');
    tap('Comida');
    fireEvent.press(screen.getByText('Guardar gasto'));
    await waitFor(() => expect(screen).toHavePathname('/finance'));
    app.unmount();

    // Martes a sábado (lo mismo que apuntaría cada noche): jornadas, cargas parciales de "póngale 300", comida…
    shift('2026-10-06', 9, ['Uber', 1180, 14], ['DiDi', 450, 6]);
    fuel('2026-10-06', 300, 12.24, 52330);
    spend('2026-10-06', 95, 'comida');
    shift('2026-10-07', 9.5, ['Uber', 1420, 17]);
    fuel('2026-10-07', 300, 12.24, 52560);
    spend('2026-10-07', 80, 'lavado');
    spend('2026-10-07', 65, 'casetas');
    spend('2026-10-07', 110, 'comida');
    shift('2026-10-08', 10, ['Uber', 900, 11], ['DiDi', 700, 9], ['inDrive', 250, 3]);
    fuel('2026-10-08', 400, 16.33, 52820);
    spend('2026-10-08', 130, 'comida');
    shift('2026-10-09', 11, ['Uber', 1650, 19], ['DiDi', 300, 4]);
    fuel('2026-10-09', 300, 12.24, 53010);
    spend('2026-10-09', 140, 'comida');
    shift('2026-10-10', 7, ['DiDi', 980, 12]);
    fuel('2026-10-10', 1000, 40.82, 53180, true);
    spend('2026-10-10', 100, 'comida');

    // Domingo de descanso: revisa cómo le fue en la semana.
    app = openApp('2026-10-11', 21);
    // Ganado: 1970 + 1630 + 1420 + 1850 + 1950 + 980 = 9800.
    // Auto: renta 2800 + gasolina 3200 + lavado 80 + casetas 65 = 6145. Comida: 695.
    expect(await screen.findByLabelText('Balance: $2,960')).toBeTruthy(); // 9800 − 6145 − 695
    expect(screen.getByLabelText('Ganado en viajes: $9,800')).toBeTruthy();
    expect(screen.getByLabelText('Gastos del auto: −$6,145')).toBeTruthy();
    expect(screen.getByLabelText('Te dejó: $3,655')).toBeTruthy();
    // 56 h 30 min trabajadas (no 92: las horas con dos apps cuentan una vez) y 119 viajes.
    expect(screen.getByLabelText('Neto por hora: $64.69')).toBeTruthy(); // 3655 / 56.5
    expect(screen.getByLabelText('Bruto por hora: $173.45')).toBeTruthy(); // 9800 / 56.5
    expect(screen.getByLabelText('Por viaje: $82.35')).toBeTruthy(); // 9800 / 119
    // Por app: Uber y DiDi se usaron juntas, así que se comparan por viaje (por hora no se puede saber).
    expect(screen.getByText('77 viajes · $84.42/viaje')).toBeTruthy(); // Uber: 6500 / 77
    expect(screen.getByText('39 viajes · $78.21/viaje')).toBeTruthy(); // DiDi: 3050 / 39
    expect(screen.getByText('3 viajes · $83.33/viaje')).toBeTruthy(); // inDrive
    // Rendimiento exacto entre las dos cargas llenas: 1080 km / 93.87 l = 11.5 km/l; 2300 / 1080 = $2.13 por km.
    expect(screen.getByLabelText('Rendimiento: 11.5 km/l')).toBeTruthy();
    expect(screen.getByLabelText('Costo por km: $2.13')).toBeTruthy();

    // En movimientos, la jornada de dos apps se lee de un vistazo.
    fireEvent.press(screen.getByText('Movimientos'));
    expect(await screen.findByText('Uber + DiDi · 10 h · 24 viajes')).toBeTruthy();
    app.unmount();

    // Lunes siguiente: la renta se apunta una sola vez aunque abra la app varias veces.
    for (const hour of [6, 13, 22]) openApp('2026-10-12', hour).unmount();
    expect(finance().transactions.filter((t) => t.categoryId === 'renta-auto').map((t) => t.date)).toEqual(['2026-10-05', '2026-10-12']);
  });

  it('se va dos semanas de vacaciones: al volver, las rentas pendientes están en su fecha', async () => {
    finance().setProfiles(['driver']);
    finance().addRecurring(
      { kind: 'expense', name: 'Renta del auto', amount: 2800, categoryId: 'renta-auto', frequency: 'weekly', day: 0 },
      '2026-10-04',
    );
    openApp('2026-10-05', 8).unmount();
    // No abre la app hasta el lunes 26.
    openApp('2026-10-26', 9);
    await screen.findByText('Esta semana');
    expect(finance().transactions.map((t) => t.date)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  });

  it('nadie escribe perfecto: entiende "8:30", "8h", unidades y avisa de lo que no entiende', async () => {
    finance().setProfiles(['driver']);
    openApp('2026-10-05', 22, '/finance/entry?mode=shift');
    await screen.findByLabelText('Ganancia en Uber');
    type('Ganancia en Uber', '$1,200');
    for (const [text, perHour] of [['8:30', '$141.18'], ['8h', '$150'], ['8 h 30 min', '$141.18'], ['9.5', '$126.32']]) {
      type('Horas conectado', text);
      expect(screen.getByText(`${perHour} por hora`)).toBeTruthy();
    }
    type('Horas conectado', 'ocho horas');
    expect(screen.getByText(/No entiendo las horas/)).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar jornada'));
    expect(finance().transactions).toHaveLength(0);
    // Corregido, se guarda.
    type('Horas conectado', '8:30');
    fireEvent.press(screen.getByText('Guardar jornada'));
    await waitFor(() => expect(finance().transactions[0]?.shift?.hours).toBe(8.5));
  });

  it('quien siempre carga "300 pesos" sin llenar también ve su rendimiento (aproximado)', async () => {
    finance().setProfiles(['driver']);
    [0, 1, 2, 3, 4].forEach((i) => fuel(`2026-10-0${i + 5}`, 300, 12.24, 60000 + i * 140));
    openApp('2026-10-09', 21);
    // 560 km entre la primera y la última; 4 cargas × 12.24 l después de la primera → 11.4 km/l.
    expect(await screen.findByLabelText('Rendimiento aprox.: ≈ 11.4 km/l')).toBeTruthy();
    expect(screen.getByText(/Aproximado con tus últimas 5 cargas \(560 km\)/)).toBeTruthy();
  });
});

describe('trabajador: un mes de quincena (octubre de 2026)', () => {
  const LUNCH = 120;

  function setupWorker() {
    finance().setProfiles(['worker']);
    const fixed = (name: string, amount: number, categoryId: string, frequency: 'biweekly' | 'monthly' | 'bimonthly', day: number, kind: 'income' | 'expense' = 'expense', startDate?: DateKey) =>
      finance().addRecurring({ kind, name, amount, categoryId, frequency, day }, '2026-09-30', startDate);
    fixed('Sueldo', 10500, 'sueldo', 'biweekly', 0, 'income');
    fixed('Renta', 5500, 'renta', 'monthly', 1);
    fixed('Internet', 499, 'servicios', 'monthly', 10);
    fixed('Netflix', 219, 'suscripciones', 'monthly', 20);
    fixed('Luz', 680, 'servicios', 'bimonthly', 18, 'expense', '2026-10-01'); // el recibo llega en octubre
    finance().setBudget('comida', 3000);
    finance().setBudget('ocio', 2000);
    // El último día de septiembre ya cobró la quincena (se apunta en septiembre, no cuenta en octubre).
    finance().applyRecurring('2026-09-30');
  }

  /** El gasto de todos los días: pasaje y comida entre semana, súper y cine en sábado, comida familiar en domingo. */
  function dailyLife(untilDay: number) {
    for (const d of daysOf(2026, 10, (w, day) => day <= untilDay && w >= 1 && w <= 5)) {
      spend(d, 24, 'transporte');
      spend(d, LUNCH, 'comida', 'Comida del trabajo');
    }
    for (const d of daysOf(2026, 10, (w, day) => day <= untilDay && w === 6)) {
      spend(d, 1150, 'super');
      spend(d, 350, 'ocio', 'Cine');
    }
    for (const d of daysOf(2026, 10, (w, day) => day <= untilDay && w === 0)) spend(d, 220, 'comida', 'Comida familiar');
  }

  it('los fijos caen en su fecha aunque abra la app en días sueltos, y el presupuesto avisa a tiempo', async () => {
    setupWorker();
    // Abre la app solo algunos días del mes.
    for (const day of ['2026-10-02', '2026-10-05', '2026-10-09', '2026-10-16']) openApp(day, 19).unmount();
    dailyLife(21);
    expect(fixedLog().map((t) => `${t.date} ${t.note}`)).toEqual([
      '2026-09-30 Sueldo', '2026-10-01 Renta', '2026-10-10 Internet', '2026-10-15 Sueldo',
    ]);

    // Miércoles 21: comida lleva 15 días de trabajo × 120 + 3 domingos × 220 = 2460 de 3000 (82 %).
    openApp('2026-10-21', 20);
    expect(await screen.findByText('Comida: llevas el 82 % del presupuesto')).toBeTruthy();
    expect(fixedLog().map((t) => t.note)).toEqual(
      ['Sueldo', 'Renta', 'Internet', 'Sueldo', 'Luz', 'Netflix'],
    );

    // Al apuntar la comida de hoy ya ve que se acerca al tope, y "Comida" sale primero por ser lo que más usa.
    fireEvent.press(screen.getByLabelText('Registrar gasto'));
    await screen.findByLabelText('Importe');
    const chips = screen.getAllByLabelText(/^(Comida|Transporte|Súper|Ocio|Renta|Servicios)$/).map((n) => n.props.accessibilityLabel);
    expect(chips.slice(0, 2)).toEqual(['Comida', 'Transporte']);
    type('Importe', '135');
    tap('Comida');
    expect(screen.getByText('Con este gasto llevarías $2,595 de $3,000 en Comida este mes (87 %).')).toBeTruthy();
  });

  it('a fin de mes el balance cuadra con las cuentas a mano, y en noviembre compara con octubre', async () => {
    setupWorker();
    dailyLife(31);
    spend('2026-10-16', 899, 'ropa', 'Tenis');
    spend('2026-10-22', 450, 'salud', 'Farmacia');

    openApp('2026-10-31', 22);
    // Ingresos: 2 quincenas × 10,500 = 21,000.
    // Gastos: renta 5500 + internet 499 + netflix 219 + luz 680 + pasaje 22 × 24 + comida (22 × 120 + 4 × 220)
    //         + súper 5 × 1150 + cine 5 × 350 + tenis 899 + farmacia 450 = 19,795.
    expect(await screen.findByLabelText('Balance: $1,205')).toBeTruthy();
    const october = periodRange('month', 0, '2026-10-31');
    expect(periodTotals(finance().transactions, [], october)).toMatchObject({ income: 21000, expense: 19795 });
    expect(screen.getByText('Comida: te pasaste $520 del presupuesto')).toBeTruthy(); // 3520 de 3000
    expect(screen.getByText('Ocio: llevas el 88 % del presupuesto')).toBeTruthy(); // 1750 de 2000
    // Lo que más se llevó el mes, en orden.
    expect(totalsByCategory(finance().transactions, 'expense', october).slice(0, 3).map((c) => c.categoryId))
      .toEqual(['super', 'renta', 'comida']);

    openApp('2026-11-03', 8);
    expect(await screen.findByText('En el mes anterior gastaste $19,795 en total.')).toBeTruthy();
    expect(screen.getByLabelText('Balance: −$5,500')).toBeTruthy(); // la renta del 1 de noviembre
  });
});

describe('estudiante: mesada, beca bimestral y una meta para el celular', () => {
  it('dos meses y medio de vida escolar', async () => {
    finance().setProfiles(['student']);
    finance().addRecurring({ kind: 'income', name: 'Mesada', amount: 600, categoryId: 'mesada', frequency: 'weekly', day: 0 }, '2026-10-04');
    finance().addRecurring(
      { kind: 'income', name: 'Beca Benito Juárez', amount: 1900, categoryId: 'beca', frequency: 'bimonthly', day: 20 },
      '2026-10-04',
    );
    const goalId = finance().addGoal({ name: 'Celular nuevo', icon: 'phone-portrait', color: '#3B82F6', target: 4500, dueDate: '2027-01-31' })!;

    // Cada lunes abre la app, le cae la mesada y aparta 250 para el celular. Entre semana: pasaje, comida y copias.
    const mondays: DateKey[] = [...daysOf(2026, 10, (w) => w === 1), ...daysOf(2026, 11, (w) => w === 1), ...daysOf(2026, 12, (w, d) => w === 1 && d <= 21)];
    for (const monday of mondays) {
      act(() => {
        jest.setSystemTime(at(monday, 8));
        finance().applyRecurring(monday);
        finance().addDeposit(goalId, 250, monday);
      });
    }
    for (const [y, m] of [[2026, 10], [2026, 11], [2026, 12]]) {
      for (const d of daysOf(y, m, (w, day) => w >= 1 && w <= 5 && !(m === 12 && day > 21))) {
        spend(d, 18, 'transporte');
        spend(d, 45, 'comida');
      }
      for (const d of daysOf(y, m, (w, day) => w === 3 && !(m === 12 && day > 21))) spend(d, 60, 'escuela', 'Copias');
    }

    // Mesada los 12 lunes; la beca el 20 de octubre y el 20 de diciembre (en noviembre no toca).
    const incomes = finance().transactions.filter((t) => t.kind === 'income');
    expect(incomes.filter((t) => t.categoryId === 'mesada')).toHaveLength(12);
    expect(incomes.filter((t) => t.categoryId === 'beca').map((t) => t.date)).toEqual(['2026-10-20', '2026-12-20']);

    // Octubre: 4 mesadas + beca = 4300; gastos: 22 días × 63 + 4 miércoles × 60 = 1626; apartó 4 × 250 = 1000.
    expect(periodTotals(finance().transactions, finance().goals, periodRange('month', 0, '2026-10-31')))
      .toEqual({ income: 4300, expense: 1626, saved: 1000, balance: 1674 });

    // Lunes 21 de diciembre: lleva 3000 de 4500; faltan 1500 y quedan 6 semanas, con la de hoy ya pagada → 300 por semana.
    openApp('2026-12-21', 9);
    fireEvent.press(await screen.findByText('Planes'));
    expect(await screen.findByLabelText('$3,000 de $4,500 · 66 %')).toBeTruthy();
    expect(screen.getByText('Aparta $300 a la semana hasta el 31 ene 2027')).toBeTruthy();
    expect(screen.getByText('El 20, cada 2 meses · próximo 20 feb 2027')).toBeTruthy();
  });
});

describe('con el teléfono de por medio', () => {
  it('la medianoche pasa con Finanzas abierta: el gasto va al día nuevo', async () => {
    finance().setProfiles(['worker']);
    jest.setSystemTime(at('2026-10-05', 23, 58));
    renderRouter(APP_DIR, { initialUrl: '/finance' });
    await screen.findByText('Octubre');
    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000); // 00:03 del martes
    });
    fireEvent.press(screen.getByLabelText('Registrar gasto'));
    await screen.findByLabelText('Importe');
    type('Importe', '60');
    tap('Comida');
    fireEvent.press(screen.getByText('Guardar gasto'));
    await waitFor(() => expect(finance().transactions[0]?.date).toBe('2026-10-06'));
  });

  it('tres años de uso intenso: se guarda en trozos, se vuelve a leer completo y las cuentas siguen siendo rápidas', async () => {
    finance().setProfiles(['driver', 'worker']);
    const start = new Date(2023, 9, 1);
    const transactions: Transaction[] = [];
    for (let d = 0; d < 365 * 3; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      for (let k = 0; k < 8; k++) {
        transactions.push({
          id: `00000000-0000-4000-8000-${String(d * 8 + k).padStart(12, '0')}`,
          kind: k === 0 ? ('income' as const) : ('expense' as const),
          amount: 50 + k * 10,
          categoryId: k === 0 ? 'viajes' : 'comida',
          date: key,
          note: k % 2 ? 'tacos con los compas 🌮' : '',
          shift: k === 0 ? { platforms: [{ platform: 'Uber', amount: 50, trips: 3 }], hours: 2 } : null,
          fuel: null,
          recurringId: null,
          createdAt: date.toISOString(),
        });
      }
    }
    // Sin nada montado en pantalla (no hace falta act).
    useFinance.setState({ transactions });

    // Se guarda en varias entradas, todas lejos del límite de ~2 MB de Android.
    // La escritura es asíncrona: se espera a que aparezca la cabecera de los trozos.
    for (let i = 0; i < 100 && !(await AsyncStorage.getItem('finance-store'))?.startsWith('__chunks:'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(await AsyncStorage.getItem('finance-store')).toMatch(/^__chunks:\d+$/);
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('finance-store#'));
    const sizes = await Promise.all(keys.map(async (k) => (await AsyncStorage.getItem(k))!.length));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(400_000);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeGreaterThan(1_500_000);

    // Al reabrir la app (un almacenamiento nuevo, sin nada en memoria) se recupera todo, emojis incluidos.
    const reopened = JSON.parse((await chunkedStorage().getItem('finance-store'))!);
    expect(reopened.state.transactions).toHaveLength(8760);
    expect(reopened.state.transactions[1].note).toBe('tacos con los compas 🌮');

    // Las cuentas de una pantalla con 8,760 movimientos tardan milisegundos.
    const t0 = process.hrtime.bigint();
    const month = periodRange('month', 0, '2026-09-15');
    periodTotals(finance().transactions, [], month);
    totalsByCategory(finance().transactions, 'expense', month);
    driverStats(finance().transactions, month);
    fuelEfficiency(finance().transactions, month.end);
    expect(Number(process.hrtime.bigint() - t0) / 1e6).toBeLessThan(200);
  });
});
