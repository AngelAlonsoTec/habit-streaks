import { goalColor } from '@/components/finance/GoalSheet';
import { addDays, DateKey, fromKey, toKey, weekdayIndex } from '@/lib/dates';
import { RecurringInput } from '@/lib/finance';
import { roundMoney } from '@/lib/money';

import { useFinance } from '@/store/finance';

export type DemoReport = { from: DateKey; to: DateKey; transactions: number; recurring: number; goals: number };

/** Números al azar con semilla: el ejemplo sale igual cada vez. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simula unos meses de uso real de Finanzas: alguien con sueldo quincenal que además maneja para Uber
 * y DiDi los fines de semana. Todo pasa por las mismas acciones que usan las pantallas, en el orden
 * en que lo haría una persona: configura sus fijos y metas el primer día y luego, cada día, abre la
 * app (se apuntan los fijos), registra lo que gastó, sus jornadas y sus cargas de gasolina, abona a
 * sus metas en quincena, corrige errores, se va de viaje una semana sin abrirla y al volver apunta
 * lo del viaje con su fecha. Borra lo que hubiera en Finanzas; los hábitos no se tocan.
 */
export function loadFinanceDemo(today: DateKey, months = 4): DemoReport {
  const store = () => useFinance.getState();
  const rand = seeded(2026);
  const chance = (p: number) => rand() < p;
  /** Un importe como se apunta a mano: redondo a `step`. */
  const between = (min: number, max: number, step = 1) => Math.round((min + rand() * (max - min)) / step) * step;
  const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)];

  const t = fromKey(today);
  const first = new Date(t.getFullYear(), t.getMonth() - months, 1);
  const from = toKey(first);
  /** Día `day` del mes `offset` contado desde el primero del ejemplo. */
  const monthDay = (offset: number, day: number) => toKey(new Date(first.getFullYear(), first.getMonth() + offset, day));
  const isLastDay = (d: Date) => addDays(d, 1).getDate() === 1;

  // Lo que hacen los formularios al guardar.
  const spend = (date: DateKey, categoryId: string, amount: number, note = '') =>
    store().addTransaction({ kind: 'expense', amount, categoryId, date, note, shift: null, fuel: null });
  const earn = (date: DateKey, categoryId: string, amount: number, note = '') =>
    store().addTransaction({ kind: 'income', amount, categoryId, date, note, shift: null, fuel: null });
  const drive = (date: DateKey, hours: number, platforms: [string, number, number][]) =>
    store().addTransaction({
      kind: 'income',
      amount: platforms.reduce((s, [, amount]) => s + amount, 0),
      categoryId: 'viajes',
      date,
      note: '',
      shift: { platforms: platforms.map(([platform, amount, trips]) => ({ platform, amount, trips })), hours },
      fuel: null,
    });
  const refuel = (date: DateKey, liters: number, price: number, odometer: number, fullTank: boolean) =>
    store().addTransaction({
      kind: 'expense', amount: roundMoney(liters * price), categoryId: 'gasolina', date, note: '', shift: null,
      fuel: { liters, odometer, fullTank },
    });
  // Como el formulario de fijos: al crear uno se apunta en el momento si hoy toca.
  const fixed = (input: Omit<RecurringInput, 'kind'> & { kind?: RecurringInput['kind'] }, date: DateKey, startDate?: DateKey) => {
    const id = store().addRecurring({ kind: 'expense', ...input }, date, startDate);
    store().applyRecurring(date);
    return id!;
  };

  // ---------- El primer día: perfil, fijos, presupuestos y metas ----------
  store().resetFinance();
  store().setProfiles(['worker', 'driver']);

  fixed({ kind: 'income', name: 'Sueldo', amount: 6200, categoryId: 'sueldo', frequency: 'biweekly', day: 0 }, from);
  fixed({ name: 'Renta', amount: 4500, categoryId: 'renta', frequency: 'monthly', day: 1 }, from);
  fixed({ name: 'Smart Fit', amount: 529, categoryId: 'salud', frequency: 'monthly', day: 2 }, from);
  const spotify = fixed({ name: 'Spotify', amount: 129, categoryId: 'suscripciones', frequency: 'monthly', day: 3 }, from);
  fixed({ name: 'Seguro del auto', amount: 1150, categoryId: 'seguro-auto', frequency: 'monthly', day: 5 }, from);
  fixed({ name: 'Internet', amount: 499, categoryId: 'servicios', frequency: 'monthly', day: 8 }, from);
  fixed({ name: 'Plan del celular', amount: 299, categoryId: 'celular', frequency: 'monthly', day: 12 }, from);
  // La luz llega este mes y el agua el que viene (un mes sí y otro no).
  fixed({ name: 'Luz', amount: 620, categoryId: 'servicios', frequency: 'bimonthly', day: 18 }, from);
  fixed({ name: 'Agua', amount: 280, categoryId: 'servicios', frequency: 'bimonthly', day: 25 }, from, monthDay(1, 1));
  const netflix = fixed({ name: 'Netflix', amount: 219, categoryId: 'suscripciones', frequency: 'monthly', day: 20 }, from);

  store().setBudget('comida', 2800);
  store().setBudget('super', 3200);
  store().setBudget('ocio', 900);

  const goal = (name: string, icon: 'shield-checkmark' | 'airplane', target: number, dueDate: DateKey) =>
    store().addGoal({ name, icon, color: goalColor(icon), target, dueDate })!;
  const emergency = goal('Fondo de emergencia', 'shield-checkmark', 20000, toKey(new Date(t.getFullYear(), t.getMonth() + 7, 0)));
  const holidays = goal('Vacaciones de diciembre', 'airplane', 9000, toKey(new Date(t.getFullYear(), t.getMonth() + 2, 15)));

  // ---------- Día a día ----------
  let odometer = 48230;
  /** Litros gastados desde la última vez que llenó el tanque, y los que cargó entre tanto. */
  let used = 18;
  let partial = 0;
  let washWeek = false;
  const away = { start: monthDay(2, 10), end: monthDay(2, 16) };
  const back = monthDay(2, 17);

  for (let d = first, day = 0; toKey(d) <= today; d = addDays(d, 1), day++) {
    const date = toKey(d);
    const weekday = weekdayIndex(d);
    const weekend = weekday >= 5;
    // Ese día la despensa se apunta dos veces por error (abajo).
    const doubleEntry = date === monthDay(3, 13);
    // De viaje: no abre la app (los fijos de esos días se apuntan al volver).
    if (date >= away.start && date <= away.end) continue;

    store().applyRecurring(date);

    // Quincena: aparta para sus metas.
    if (d.getDate() === 15 || isLastDay(d)) {
      store().addDeposit(emergency, 800, date);
      store().addDeposit(holidays, 600, date);
    }

    // Gasolina: llena el tanque antes de que se acabe; a fin de mes, a veces solo pone $300.
    const price = Math.round((24.19 + day * 0.004 + (rand() - 0.5) * 0.12) * 100) / 100;
    if (used >= 30 || (weekday === 5 && used >= 20)) {
      refuel(date, Math.round((used - partial) * 100) / 100, price, odometer, true);
      used = 0;
      partial = 0;
    } else if (d.getDate() >= 24 && d.getDate() <= 30 && weekday === 0 && used >= 12) {
      const liters = Math.round((300 / price) * 100) / 100;
      refuel(date, liters, price, odometer, false);
      partial += liters;
    }

    let km = 0;
    if (!weekend) {
      km += between(22, 30); // al trabajo y de regreso
      if (chance(0.75)) spend(date, 'comida', between(70, 145, 5), pick(['Comida corrida', 'Tacos', 'Torta', 'Comida en el trabajo', '']));
      if (chance(0.25)) spend(date, 'comida', between(35, 65, 5), 'Café');
      if (weekday === 2 && chance(0.4)) spend(date, 'super', between(120, 260, 5), 'Tienda');
    }
    // Viernes en la noche, a veces unas horas en DiDi.
    if (weekday === 4 && chance(0.5)) {
      const hours = pick([3, 3.5, 4]);
      drive(date, hours, [['DiDi', between(380, 620, 10), between(6, 9)]]);
      km += Math.round(hours * 20);
    }
    if (weekday === 4 && chance(0.3)) spend(date, 'ocio', between(250, 480, 10), 'Cena con amigos');
    // Sábado: el día fuerte, Uber y otra app.
    if (weekday === 5) {
      const hours = pick([7, 7.5, 8, 8.5, 9]);
      const other = chance(0.2) ? 'inDrive' : 'DiDi';
      drive(date, hours, [['Uber', between(900, 1450, 10), between(13, 19)], [other, between(280, 650, 10), between(5, 9)]]);
      km += Math.round(hours * 21);
      washWeek = !washWeek;
      if (washWeek) spend(date, 'lavado', 90, 'Lavado');
      if (chance(0.25)) spend(date, 'ocio', between(150, 320, 10), pick(['Cine', 'Fútbol', 'Billar']));
    }
    // Domingo: casi siempre unas horas de Uber, y la despensa.
    if (weekday === 6) {
      if (chance(0.85)) {
        const hours = pick([4.5, 5, 5.5, 6]);
        drive(date, hours, [['Uber', between(550, 950, 10), between(8, 13)]]);
        km += Math.round(hours * 21);
      }
      if (!doubleEntry && chance(0.9)) spend(date, 'super', between(620, 1000, 5), 'Despensa');
    }
    if (weekend) {
      if (chance(0.8)) spend(date, 'comida', between(85, 160, 5), 'Comida en la calle');
      if (km > 100 && chance(0.2)) spend(date, 'casetas', between(45, 115, 5), pick(['Caseta', 'Estacionamiento']));
      if (km === 0) km += between(10, 25);
    }
    if (d.getDate() === 9 && chance(0.7)) spend(date, 'salud', between(160, 420, 10), 'Farmacia');

    // Lo que pasó en días concretos.
    if (date === monthDay(0, 22)) spend(date, 'ropa', 899, 'Tenis');
    // El súper se le pasó el primer mes: sube el presupuesto.
    if (date === monthDay(1, 1)) store().setBudget('super', 3800);
    if (date === monthDay(1, 9)) {
      // Escribió 1200 en vez de 120 y lo corrigió.
      const typo = spend(date, 'comida', 1200, 'Tacos');
      if (typo) store().updateTransaction(typo, { amount: 120 });
    }
    if (date === monthDay(1, 18)) {
      spend(date, 'mantenimiento', 1150, 'Cambio de aceite');
      spend(date, 'transporte', 95, 'Uber al trabajo');
    }
    if (date === monthDay(2, 0)) earn(date, 'bonos', 1500, 'Bono de productividad');
    if (date === monthDay(2, 3)) fixed({ name: 'HBO Max', amount: 149, categoryId: 'suscripciones', frequency: 'monthly', day: 3 }, date);
    if (date === back) {
      // Vuelve del viaje y apunta lo que gastó, cada cosa con su día.
      spend(away.start, 'transporte', 1180, 'Autobús a Veracruz');
      spend(monthDay(2, 11), 'otros-gastos', 2400, 'Hotel en Veracruz');
      spend(monthDay(2, 13), 'comida', 1350, 'Comidas del viaje');
      spend(monthDay(2, 14), 'ocio', 600, 'Paseo en lancha');
    }
    if (date === monthDay(2, 23)) earn(date, 'ventas', 2300, 'Vendí la bici');
    if (date === monthDay(2, 27)) spend(date, 'ropa', 349, 'Playera');
    if (date === monthDay(3, 2)) store().deleteRecurring(spotify); // canceló Spotify
    if (date === monthDay(3, 6)) {
      // Las balatas no esperan: las paga con parte del fondo de emergencia.
      spend(date, 'mantenimiento', 1850, 'Balatas');
      store().addDeposit(emergency, -1500, date);
    }
    if (doubleEntry) {
      // Apuntó la despensa dos veces y borró una.
      spend(date, 'super', 845, 'Despensa');
      const twice = spend(date, 'super', 845, 'Despensa');
      if (twice) store().deleteTransaction(twice);
    }
    if (date === monthDay(3, 15)) store().updateRecurring(netflix, { amount: 249 }); // subió de precio

    odometer += km;
    used += km / (11.4 + (rand() - 0.5) * 0.6);
  }

  const { transactions, recurring, goals } = store();
  return { from, to: today, transactions: transactions.length, recurring: recurring.length, goals: goals.length };
}
