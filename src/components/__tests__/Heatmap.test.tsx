import { buildWeeks, cellColor, monthBoundaries, monthLabels } from '../Heatmap';

describe('buildWeeks', () => {
  const weeks = buildWeeks(53, '2026-09-25'); // viernes

  it('genera semanas continuas de lunes a domingo', () => {
    expect(weeks).toHaveLength(53);
    const keys = weeks.flat().map((c) => c.key);
    expect(new Set(keys).size).toBe(53 * 7);
    expect(keys[0]).toBe('2025-09-22');
    expect(weeks[52][0].key).toBe('2026-09-21');
  });

  it('marca los días futuros de la semana actual', () => {
    expect(weeks[52][4]).toMatchObject({ key: '2026-09-25', future: false });
    expect(weeks[52][5].future).toBe(true);
  });
});

describe('monthLabels', () => {
  it('pone cada mes en la columna de su día 1 e indica el año en enero', () => {
    const labels = monthLabels(buildWeeks(53, '2026-09-25'));
    expect(labels.map((l) => l.label)).toEqual([
      'Oct', 'Nov', 'Dic', 'Ene 26', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep',
    ]);
    const sep = labels.find((l) => l.label === 'Sep')!;
    expect(buildWeeks(53, '2026-09-25')[sep.col].some((c) => c.key === '2026-09-01')).toBe(true);
  });
});

describe('monthBoundaries', () => {
  it('dibuja una línea escalonada entre agosto y septiembre de 2026', () => {
    // Semanas del 24/8 y del 31/8: el 1/9 es martes.
    const weeks = buildWeeks(2, '2026-09-06');
    const segs = monthBoundaries(weeks);
    // Tramo horizontal sobre el martes 1/9 (entre lunes 31/8 y martes 1/9, misma columna).
    expect(segs).toContainEqual({ x1: 1, y1: 1, x2: 2, y2: 1 });
    // Tramos verticales entre la semana anterior (agosto) y los días de septiembre.
    for (let d = 1; d < 7; d++) expect(segs).toContainEqual({ x1: 1, y1: d, x2: 1, y2: d + 1 });
    // El lunes 31/8 sigue en agosto: sin línea a su izquierda.
    expect(segs).not.toContainEqual({ x1: 1, y1: 0, x2: 1, y2: 1 });
    expect(segs).toHaveLength(7);
  });

  it('no dibuja líneas junto a días futuros', () => {
    const segs = monthBoundaries(buildWeeks(2, '2026-08-31'));
    expect(segs).toHaveLength(0);
  });
});

describe('cellColor', () => {
  it('intensidad según el progreso', () => {
    expect(cellColor('#3B82F6', '24', 1, true)).toBe('#3B82F6');
    expect(cellColor('#3B82F6', '24', 0, true)).toBe('#3B82F624');
    expect(cellColor('#3B82F6', '24', 0, false)).toBe('#3B82F612'); // descanso, más tenue
    expect(cellColor('#3B82F6', '24', 0.5, true)).toMatch(/^#3B82F6[0-9a-f]{2}$/);
  });
});
