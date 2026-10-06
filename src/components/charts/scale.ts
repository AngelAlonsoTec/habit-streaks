/** Redondea hacia arriba a un número "limpio" para el eje: 1, 2, 2.5, 5 o 10 por potencia de 10 (1,970 → 2,000). */
export function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value - 1e-9)!;
  return step * power;
}
