import { buildMonths, cellColor, fitMonths, layoutUnits, monthStart } from '../Heatmap';

describe('buildMonths', () => {
  // Del sábado 15/8 al lunes 5/10/2026.
  const months = buildMonths('2026-08-15', '2026-10-05');

  it('un bloque por mes, con el año solo en enero', () => {
    expect(months.map((m) => m.label)).toEqual(['Ago', 'Sep', 'Oct']);
    expect(buildMonths('2026-12-20', '2027-01-03').map((m) => m.label)).toEqual(['Dic', 'Ene 27']);
  });

  it('cada columna es una semana de lunes a domingo, sin días de otros meses', () => {
    const [aug, sep, oct] = months;
    // Agosto empieza en el 15 (sábado): la primera semana solo tiene sábado y domingo.
    expect(aug.columns[0].map((c) => c?.key ?? null)).toEqual([null, null, null, null, null, '2026-08-15', '2026-08-16']);
    // El 1/9 es martes: el lunes 31/8 pertenece a agosto, no a septiembre.
    expect(sep.columns[0][0]).toBeNull();
    expect(sep.columns[0][1]?.key).toBe('2026-09-01');
    expect(aug.columns.at(-1)![0]?.key).toBe('2026-08-31');
    expect(sep.columns).toHaveLength(5);
    // Octubre se corta en el último día pedido (lunes 5).
    expect(oct.columns).toHaveLength(2);
    expect(oct.columns[1].map((c) => c?.key ?? null)).toEqual(['2026-10-05', null, null, null, null, null, null]);
  });

  it('todos los días del rango aparecen una sola vez', () => {
    const keys = months.flatMap((m) => m.columns.flat()).filter((c) => c != null).map((c) => c!.key);
    expect(keys).toHaveLength(52); // 17 de agosto + 30 de septiembre + 5 de octubre
    expect(new Set(keys).size).toBe(52);
  });
});

describe('monthStart', () => {
  it('día 1 del mes, n meses atrás, cruzando años', () => {
    expect(monthStart('2026-10-05', 0)).toBe('2026-10-01');
    expect(monthStart('2026-10-05', 11)).toBe('2025-11-01');
  });
});

describe('ajuste al ancho', () => {
  it('el ancho cuenta columnas, huecos entre semanas y un hueco mayor entre meses', () => {
    const one = buildMonths('2026-09-01', '2026-09-30'); // 5 columnas
    const two = buildMonths('2026-08-01', '2026-09-30'); // 6 + 5 columnas
    expect(layoutUnits(one)).toBeCloseTo(5 + 4 * 0.27);
    expect(layoutUnits(two)).toBeCloseTo(11 + 9 * 0.27 + 0.95);
  });

  it('muestra los meses completos que caben y siempre al menos el actual', () => {
    const fitted = fitMonths(300, 10, '2026-10-05');
    expect(fitted[0].columns.flat().find((c) => c)?.key).toMatch(/-01$/);
    expect(fitted.at(-1)!.label).toBe('Oct');
    expect(layoutUnits(fitted) * 10).toBeLessThanOrEqual(300);
    expect(layoutUnits(fitMonths(310, 10, '2026-10-05'))).toBeGreaterThanOrEqual(layoutUnits(fitted));
    expect(fitMonths(5, 10, '2026-10-05').map((m) => m.label)).toEqual(['Oct']);
  });
});

describe('cellColor', () => {
  it('intensidad según el progreso', () => {
    expect(cellColor('#3B82F6', '24', 1, true)).toBe('#3B82F6');
    expect(cellColor('#3B82F6', '24', 0, true)).toBe('#3B82F624');
    expect(cellColor('#3B82F6', '24', 0, false)).toBe('#3B82F612'); // descanso, más tenue
    expect(cellColor('#3B82F6', '24', 0.5, true)).toMatch(/^#3B82F6[0-9a-f]{2}$/);
  });

  it('límite superado: color de peligro', () => {
    expect(cellColor('#3B82F6', '24', -1, true, '#CF222E')).toBe('#CF222E');
  });
});
