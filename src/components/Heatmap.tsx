import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { addDays, DateKey, fromKey, MONTH_LABELS, startOfWeek, toKey, WEEKDAY_LABELS, weekdayIndex } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { useTheme, withAlpha } from '@/theme';

type Props = {
  counts?: Record<DateKey, number>;
  color: string;
  /** Veces para considerar un día completo (intensidad máxima). */
  target?: number;
  /** Días en que el hábito no toca: se dibujan más tenues. */
  isScheduled?: (date: Date) => boolean;
  /** Nivel de cada día (0-1, o -1 si se pasó del límite). Por defecto, registrado / `target`. */
  level?: (date: Date, count: number) => number;
  /** Primer día que se dibuja. Si se omite, se muestran los meses completos que quepan en el ancho. */
  startKey?: DateKey;
  /** Tamaño de celda. Al ajustar al ancho es el mínimo: las celdas crecen para llenar la fila. */
  cellSize?: number;
  showMonthLabels?: boolean;
  showWeekdayLabels?: boolean;
  /** Último día que se dibuja (por defecto hoy). */
  endKey?: DateKey;
};

export type HeatmapCell = { key: DateKey; date: Date };

/** Un mes: sus semanas como columnas (lunes a domingo), con null en los días de otros meses o fuera del rango. */
export type MonthBlock = { key: string; label: string; columns: (HeatmapCell | null)[][] };

const WEEKDAY_LABEL_WIDTH = 16;
const MONTH_LABEL_HEIGHT = 16;
/** Ancho de la caja de cada etiqueta de mes. */
const MONTH_LABEL_WIDTH = 44;
/** Margen (en unidades del dibujo) para que bordes redondeados y el contorno de hoy no se recorten. */
const EDGE = 1;
/** Separación entre celdas, proporcional al tamaño de celda. */
const GAP_RATIO = 0.27;
/** Separación entre meses: un hueco claro en lugar de una línea divisoria. */
const MONTH_GAP_RATIO = 0.95;
/** Grosor del contorno de los días con el límite superado, proporcional a la celda. */
const OVER_STROKE_RATIO = 0.16;
/** Tope de meses al ajustar al ancho (pantallas muy anchas). */
const MAX_FIT_MONTHS = 24;

/** "Oct"; en enero, con el año ("Ene 27") para ubicar el cambio de año. */
function monthLabel(first: Date): string {
  const m = first.getMonth();
  return m === 0 ? `${MONTH_LABELS[m]} ${String(first.getFullYear()).slice(2)}` : MONTH_LABELS[m];
}

/** Meses entre `start` y `end` (incluidos), cada uno como un bloque de semanas. */
export function buildMonths(start: DateKey, end: DateKey): MonthBlock[] {
  const s = fromKey(start);
  const e = fromKey(end);
  const blocks: MonthBlock[] = [];
  for (let m = new Date(s.getFullYear(), s.getMonth(), 1); m <= e; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    const from = m < s ? s : m;
    const to = last > e ? e : last;
    const columns: (HeatmapCell | null)[][] = [];
    for (let w = startOfWeek(from); w <= to; w = addDays(w, 7)) {
      columns.push(
        Array.from({ length: 7 }, (_, d) => {
          const date = addDays(w, d);
          return date < from || date > to ? null : { key: toKey(date), date };
        }),
      );
    }
    blocks.push({ key: toKey(m), label: monthLabel(m), columns });
  }
  return blocks;
}

/** Día 1 del mes que está `back` meses antes del de `end`. */
export function monthStart(end: DateKey, back: number): DateKey {
  const e = fromKey(end);
  return toKey(new Date(e.getFullYear(), e.getMonth() - back, 1));
}

/** Ancho de los bloques medido en tamaños de celda: columnas, huecos entre semanas y huecos entre meses. */
export function layoutUnits(blocks: MonthBlock[]): number {
  const cols = blocks.reduce((n, b) => n + b.columns.length, 0);
  return cols + (cols - blocks.length) * GAP_RATIO + Math.max(0, blocks.length - 1) * MONTH_GAP_RATIO;
}

/** Los meses completos (más el actual) que caben en `available` con celdas de al menos `minCell`. */
export function fitMonths(available: number, minCell: number, end: DateKey): MonthBlock[] {
  let best = buildMonths(monthStart(end, 0), end);
  for (let back = 1; back < MAX_FIT_MONTHS; back++) {
    const blocks = buildMonths(monthStart(end, back), end);
    if (layoutUnits(blocks) * minCell > available) break;
    best = blocks;
  }
  return best;
}

/** Color de una celda según el progreso del día (0 = vacío, 1 = completo, negativo = límite superado). */
export function cellColor(color: string, emptyAlpha: string, progress: number, scheduled: boolean, danger = color): string {
  if (progress < 0) return danger;
  if (progress === 0) return scheduled ? color + emptyAlpha : withAlpha(color, 0.07);
  if (progress >= 1) return color;
  return withAlpha(color, 0.3 + 0.45 * progress);
}

function roundedRect(x: number, y: number, s: number, r: number): string {
  const e = s - 2 * r;
  return `M${x + r} ${y}h${e}a${r} ${r} 0 0 1 ${r} ${r}v${e}a${r} ${r} 0 0 1 ${-r} ${r}h${-e}a${r} ${r} 0 0 1 ${-r} ${-r}v${-e}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
}

export const Heatmap = memo(function Heatmap({
  counts,
  color,
  target = 1,
  isScheduled,
  level,
  startKey,
  cellSize = 11,
  showMonthLabels = false,
  showWeekdayLabels = false,
  endKey,
}: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState<number | null>(null);
  const today = useToday();
  const end = endKey ?? today;
  const labelWidth = showWeekdayLabels ? WEEKDAY_LABEL_WIDTH : 0;
  const fit = startKey == null;

  // Meses y tamaño de celda: fijos, o los meses que quepan llenando todo el ancho.
  const { blocks, size } = useMemo(() => {
    if (!fit) return { blocks: buildMonths(startKey, end), size: cellSize };
    const available = (width ?? 0) - labelWidth - 2 * EDGE;
    // Sin medir aún (o con ancho 0 mientras la vista está oculta) no dibujamos nada.
    if (available < cellSize) return { blocks: [], size: cellSize };
    const fitted = fitMonths(available, cellSize, end);
    return { blocks: fitted, size: available / layoutUnits(fitted) };
  }, [fit, startKey, end, width, labelWidth, cellSize]);
  const gap = size * GAP_RATIO;
  const step = size + gap;
  const monthGap = size * MONTH_GAP_RATIO;

  // Posición horizontal de cada mes: sus semanas seguidas y un hueco más ancho antes del siguiente.
  const offsets = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < blocks.length; i++) {
      out.push(i === 0 ? 0 : out[i - 1] + blocks[i - 1].columns.length * step - gap + monthGap);
    }
    return out;
  }, [blocks, step, gap, monthGap]);

  // Agrupamos las celdas por color: un solo <Path> por color en vez de cientos de vistas.
  // Los días en que se superó el límite van aparte: contorno rojo hueco, distinguible con cualquier color.
  const { paths, over, todayOver } = useMemo(() => {
    const byColor = new Map<string, string[]>();
    const overRects: string[] = [];
    let isTodayOver = false;
    const r = Math.max(1.5, size * 0.25);
    const inset = OVER_STROKE_RATIO * size / 2;
    blocks.forEach((block, b) =>
      block.columns.forEach((column, c) =>
        column.forEach((cell, d) => {
          if (!cell) return;
          const scheduled = isScheduled ? isScheduled(cell.date) : true;
          const count = counts?.[cell.key] ?? 0;
          const progress = level ? level(cell.date, count) : count / target;
          if (progress < 0) {
            overRects.push(roundedRect(offsets[b] + c * step + inset, d * step + inset, size - 2 * inset, Math.max(1, r - inset)));
            if (cell.key === today) isTodayOver = true;
            return;
          }
          const fill = cellColor(color, theme.emptyAlpha, progress, scheduled);
          const list = byColor.get(fill) ?? [];
          list.push(roundedRect(offsets[b] + c * step, d * step, size, r));
          byColor.set(fill, list);
        }),
      ),
    );
    return {
      paths: [...byColor.entries()].map(([fill, rects]) => ({ fill, d: rects.join('') })),
      over: overRects.join(''),
      todayOver: isTodayOver,
    };
  }, [blocks, offsets, counts, color, target, isScheduled, level, theme.emptyAlpha, today, size, step]);

  const lastBlock = blocks.length - 1;
  // Si termina hoy, hoy está en la última columna del último mes, en la fila de su día.
  const todayPos =
    blocks.length > 0 && end === today && !todayOver
      ? { x: offsets[lastBlock] + (blocks[lastBlock].columns.length - 1) * step, y: weekdayIndex(fromKey(today)) * step }
      : null;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    // Ancho 0 = vista oculta: conservamos la última medida para no redibujar al volver a mostrarla.
    if (w > 0 && w !== width) setWidth(w);
  };

  const gridWidth = blocks.length ? offsets[lastBlock] + blocks[lastBlock].columns.length * step - gap : 0;
  const gridHeight = 7 * step - gap;
  const radius = Math.max(1.5, size * 0.25);
  const viewWidth = gridWidth + 2 * EDGE;
  const viewHeight = gridHeight + 2 * EDGE;

  return (
    <View onLayout={fit ? onLayout : undefined}>
      {showMonthLabels && blocks.length > 0 && (
        <View style={{ height: MONTH_LABEL_HEIGHT, marginLeft: labelWidth + EDGE, width: gridWidth }}>
          {blocks.map((block, b) => {
            const blockWidth = block.columns.length * step - gap;
            // Un mes recién empezado ocupa muy poco: su etiqueta se alinea a su borde derecho.
            const narrow = b === lastBlock && b > 0 && blockWidth < 26;
            return (
              <Text
                key={block.key}
                numberOfLines={1}
                style={[
                  styles.monthLabel,
                  { color: theme.muted },
                  narrow
                    ? { left: offsets[b] + blockWidth - MONTH_LABEL_WIDTH, textAlign: 'right' }
                    : { left: offsets[b] },
                ]}
              >
                {block.label}
              </Text>
            );
          })}
        </View>
      )}
      <View style={[styles.row, { minHeight: viewHeight }]}>
        {showWeekdayLabels && <WeekdayLabels cellSize={size} />}
        {blocks.length > 0 && (
          // Al ajustar al ancho, el SVG ocupa el 100 % real y el viewBox escala el dibujo: si Android
          // redondea el ancho distinto a nuestra medida, el dibujo encoge un poco en vez de cortarse.
          <Svg
            style={fit ? styles.flex : undefined}
            width={fit ? '100%' : viewWidth}
            height={viewHeight}
            viewBox={`${-EDGE} ${-EDGE} ${viewWidth} ${viewHeight}`}
            preserveAspectRatio="xMinYMin meet"
          >
            {paths.map((p) => (
              <Path key={p.fill} d={p.d} fill={p.fill} />
            ))}
            {over ? <Path d={over} fill="none" stroke={theme.danger} strokeWidth={OVER_STROKE_RATIO * size} /> : null}
            {todayPos && (
              <Rect
                x={todayPos.x + 0.75}
                y={todayPos.y + 0.75}
                width={size - 1.5}
                height={size - 1.5}
                rx={radius}
                fill="none"
                stroke={theme.text}
                strokeWidth={1.5}
              />
            )}
          </Svg>
        )}
      </View>
    </View>
  );
});

/**
 * Letras de los días (L, X, V, D) alineadas con las filas del heatmap. Se exporta para dejarlas fijas
 * fuera de un ScrollView horizontal (`withMonthLabels` deja el hueco de la fila de meses).
 */
export function WeekdayLabels({ cellSize, withMonthLabels = false }: { cellSize: number; withMonthLabels?: boolean }) {
  const theme = useTheme();
  const gap = cellSize * GAP_RATIO;
  return (
    <View style={{ width: WEEKDAY_LABEL_WIDTH, paddingTop: EDGE + (withMonthLabels ? MONTH_LABEL_HEIGHT : 0) }}>
      {WEEKDAY_LABELS.map((label, i) => (
        <Text
          key={label}
          style={[styles.weekdayLabel, { color: theme.muted, height: cellSize, marginBottom: gap, lineHeight: cellSize }]}
        >
          {i % 2 === 0 ? label : ''}
        </Text>
      ))}
    </View>
  );
}

/**
 * Leyenda "Menos ▢▢▢▢ Más" para hábitos con varias repeticiones al día. Al dejar un hábito
 * (`limit`), "Superado ■ ▢▢▢ Limpio": rojo si se pasó y más lleno cuanto más lejos del límite.
 */
export function HeatmapLegend({ color, limit }: { color: string; limit?: number }) {
  const theme = useTheme();
  const quit = limit != null;
  const levels = !quit ? [0, 0.33, 0.66, 1] : limit === 0 ? [-1, 1] : [-1, 0.33, 0.66, 1];
  return (
    <View style={[styles.row, styles.legend]}>
      <Text style={[styles.legendText, { color: theme.muted }]}>{quit ? (limit === 0 ? 'Recaída' : 'Superado') : 'Menos'}</Text>
      {levels.map((l) => (
        <View
          key={l}
          style={[
            styles.legendCell,
            l < 0
              ? { borderWidth: 2, borderColor: theme.danger }
              : { backgroundColor: cellColor(color, theme.emptyAlpha, l, true) },
          ]}
        />
      ))}
      <Text style={[styles.legendText, { color: theme.muted }]}>{quit ? 'Limpio' : 'Más'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  monthLabel: { position: 'absolute', top: 0, fontSize: 10, fontWeight: '600', width: MONTH_LABEL_WIDTH },
  weekdayLabel: { fontSize: 9 },
  legend: { alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  legendText: { fontSize: 11 },
  legendCell: { width: 11, height: 11, borderRadius: 3 },
});
