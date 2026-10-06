export type CurrencyCode = 'MXN' | 'USD' | 'EUR' | 'COP' | 'ARS' | 'CLP' | 'PEN';

type CurrencyInfo = {
  code: CurrencyCode;
  label: string;
  locale: string;
  decimal: '.' | ',';
  /** Símbolo para los campos de importe; `symbolAfter` lo pone detrás ("12 €"). */
  symbol: string;
  symbolAfter?: boolean;
};

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'MXN', label: 'Peso mexicano', locale: 'es-MX', decimal: '.', symbol: '$' },
  { code: 'USD', label: 'Dólar', locale: 'es-US', decimal: '.', symbol: '$' },
  { code: 'EUR', label: 'Euro', locale: 'es-ES', decimal: ',', symbol: '€', symbolAfter: true },
  { code: 'COP', label: 'Peso colombiano', locale: 'es-CO', decimal: ',', symbol: '$' },
  { code: 'ARS', label: 'Peso argentino', locale: 'es-AR', decimal: ',', symbol: '$' },
  { code: 'CLP', label: 'Peso chileno', locale: 'es-CL', decimal: ',', symbol: '$' },
  { code: 'PEN', label: 'Sol', locale: 'es-PE', decimal: '.', symbol: 'S/' },
];

export const DEFAULT_CURRENCY: CurrencyCode = 'MXN';

/** Tope de un importe (evita que un dedo de más descuadre todas las cuentas). */
export const MAX_MONEY = 100_000_000;

export function currencyInfo(code: CurrencyCode): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(code: CurrencyCode, cents: boolean): Intl.NumberFormat {
  const key = `${code}-${cents}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currencyInfo(code).locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: 2,
    });
    formatters.set(key, f);
  }
  return f;
}

/**
 * Importe con el formato de su moneda: "$1,250", "$45.50", "1250,50 €". Los centavos solo
 * aparecen si los hay. Con `sign`, los positivos llevan "+" (para ingresos en una lista).
 */
export function formatMoney(n: number, code: CurrencyCode, options: { sign?: boolean } = {}): string {
  const value = roundMoney(n);
  const abs = Math.abs(value);
  const text = formatter(code, !Number.isInteger(abs)).format(abs);
  if (value < 0) return `−${text}`;
  return options.sign && value > 0 ? `+${text}` : text;
}

/** Importe redondeado a unidades, para cifras orientativas ("unos $1,800 al mes"). */
export function formatMoneyRounded(n: number, code: CurrencyCode): string {
  return formatMoney(Math.round(n), code);
}

const numberFormatters = new Map<string, Intl.NumberFormat>();

/** Número con la convención de la moneda (litros, km, horas): "45,230" con pesos, "45.230" con euros. */
export function formatNumber(n: number, code: CurrencyCode, maxDecimals = 2): string {
  const key = `${code}-${maxDecimals}`;
  let f = numberFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currencyInfo(code).locale, { maximumFractionDigits: maxDecimals });
    numberFormatters.set(key, f);
  }
  return f.format(n);
}

const groupPattern = (sep: string) => new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`);

/**
 * Lee un importe escrito a mano. Acepta el símbolo de la moneda, espacios y separadores de miles
 * de cualquiera de las dos convenciones ("1,250.50", "1.250,50", "$1,500", "2,5"). Si es ambiguo,
 * decide la convención de la moneda: con pesos mexicanos "1,500" son mil quinientos y "1.5" uno y medio.
 */
export function parseMoney(text: string, code: CurrencyCode, allowZero = false): number | null {
  const decimal = currencyInfo(code).decimal;
  const group = decimal === '.' ? ',' : '.';
  const s = text
    .trim()
    .replace(/^\+/, '')
    .replace(/[$€\s ]/g, '')
    .replace(/^(S\/|MXN|USD|EUR|COP|ARS|CLP|PEN)|(MXN|USD|EUR|COP|ARS|CLP|PEN|pesos?|soles?|euros?|d[oó]lares?)$/gi, '');
  if (!/^[\d.,]+$/.test(s)) return null;

  let normalized: string;
  if (s.includes('.') && s.includes(',')) {
    // Con los dos, el último es el decimal.
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const thousands = dec === '.' ? ',' : '.';
    const parts = s.split(dec);
    if (parts.length !== 2 || !(groupPattern(thousands).test(parts[0]) || /^\d+$/.test(parts[0]))) return null;
    normalized = `${parts[0].split(thousands).join('')}.${parts[1]}`;
  } else if (s.includes('.') || s.includes(',')) {
    const sep = s.includes('.') ? '.' : ',';
    const parts = s.split(sep);
    const grouped = groupPattern(sep).test(s);
    if (grouped && (sep === group || parts.length > 2)) normalized = parts.join('');
    else if (parts.length === 2) normalized = `${parts[0]}.${parts[1]}`;
    else return null;
  } else {
    normalized = s;
  }

  if (!/^(\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const n = roundMoney(Number(normalized));
  return (n > 0 || (allowZero && n === 0)) && n <= MAX_MONEY ? n : null;
}

/** Texto para precargar un campo de importe al editar ("1250.5" con pesos, "1250,5" con euros). */
export function moneyInputText(n: number, code: CurrencyCode): string {
  const text = String(roundMoney(n));
  return currencyInfo(code).decimal === ',' ? text.replace('.', ',') : text;
}
