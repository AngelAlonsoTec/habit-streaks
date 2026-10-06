import { formatMoney, formatNumber, moneyInputText, parseMoney } from '../money';

describe('formatMoney', () => {
  it('pesos con separador de miles y centavos solo si los hay', () => {
    expect(formatMoney(1250, 'MXN')).toBe('$1,250');
    expect(formatMoney(45.5, 'MXN')).toBe('$45.50');
    expect(formatMoney(0, 'MXN')).toBe('$0');
    expect(formatMoney(1_234_567.891, 'MXN')).toBe('$1,234,567.89');
  });

  it('negativos con signo menos y positivos con + si se pide', () => {
    expect(formatMoney(-300, 'MXN')).toBe('−$300');
    expect(formatMoney(1450, 'MXN', { sign: true })).toBe('+$1,450');
    expect(formatMoney(0, 'MXN', { sign: true })).toBe('$0');
  });

  it('otras monedas con su convención', () => {
    expect(formatMoney(1250.5, 'EUR')).toMatch(/^1250,50\s€$/);
    expect(formatMoney(12345, 'EUR')).toMatch(/^12\.345\s€$/);
    expect(formatMoney(80, 'PEN')).toMatch(/^S\/\s80$/);
  });

  it('redondea los céntimos sueltos de las sumas en coma flotante', () => {
    expect(formatMoney(0.1 + 0.2, 'MXN')).toBe('$0.30');
    expect(formatMoney(19.999, 'MXN')).toBe('$20');
  });
});

describe('parseMoney', () => {
  it.each([
    ['250', 250],
    ['$1,500', 1500],
    ['1,250.50', 1250.5],
    ['1.5', 1.5],
    ['2,5', 2.5],
    ['.5', 0.5],
    ['1,234,567', 1_234_567],
    ['1.234,50', 1234.5],
    ['12.345.678', 12_345_678],
    ['+80', 80],
    ['80 pesos', 80],
    ['MXN 80', 80],
    [' $ 99.90 ', 99.9],
  ])('con pesos mexicanos lee %p como %p', (text, expected) => {
    expect(parseMoney(text, 'MXN')).toBe(expected);
  });

  it.each(['', '0', '-5', 'abc', '1e3', '1,2,3', '12..5', '$', '100000001', 'abc12'])('rechaza %p', (text) => {
    expect(parseMoney(text, 'MXN')).toBeNull();
  });

  it('el cero solo si se permite', () => {
    expect(parseMoney('0', 'MXN', true)).toBe(0);
  });

  it('con euros, el punto separa miles y la coma decimales', () => {
    expect(parseMoney('1.500', 'EUR')).toBe(1500);
    expect(parseMoney('1,5', 'EUR')).toBe(1.5);
    expect(parseMoney('1.234,56 €', 'EUR')).toBe(1234.56);
    // Sin ambigüedad (un solo punto que no agrupa miles) se entiende como decimal.
    expect(parseMoney('2.5', 'EUR')).toBe(2.5);
  });

  it('lo que se precarga al editar se vuelve a leer igual', () => {
    for (const n of [1250.5, 0.75, 1_000_000, 45]) {
      expect(parseMoney(moneyInputText(n, 'MXN'), 'MXN')).toBe(n);
      expect(parseMoney(moneyInputText(n, 'EUR'), 'EUR')).toBe(n);
    }
    expect(moneyInputText(1250.5, 'EUR')).toBe('1250,5');
  });
});

describe('formatNumber', () => {
  it('litros y kilómetros con la convención de la moneda', () => {
    expect(formatNumber(45230, 'MXN', 0)).toBe('45,230');
    expect(formatNumber(33.5, 'MXN')).toBe('33.5');
    expect(formatNumber(33.5, 'EUR')).toBe('33,5');
  });
});
