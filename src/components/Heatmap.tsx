import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { addDays, DateKey, fromKey, MONTH_LABELS, startOfWeek, toKey, todayKey, WEEKDAY_LABELS, weekdayIndex } from '@/lib/dates';
import { useTheme, withAlpha } from '@/theme';

type Props = {
  counts?: Record<DateKey, number>;
  color: string;
  /** Veces para considerar un día completo (intensidad máxima). */
  target?: number;
  /** Días en que el hábito no toca: se dibujan más tenues. */
  isScheduled?: (date: Date) => boolean;
  /** Número fijo de semanas. Si se omite, se muestran las que quepan en el ancho. */
  weeks?: number;
  /** Tamaño de celda. Al ajustar al ancho es el mínimo: las celdas crecen para llenar la fila. */
  cellSize?: number;
  showMonthLabels?: boolean;
  showWeekdayLabels?: boolean;
  /** Último día que se dibuja (por defecto hoy); los posteriores quedan vacíos. */
  endKey?: DateKey;
};

export type HeatmapCell = { key: DateKey; date: Date; month: number; future: boolean };

const WEEKDAY_LABEL_WIDTH = 16;
const MONTH_LABEL_HEIGHT = 16;
/** Margen (en unidades del dibujo) para que bordes redondeados y el contorno de hoy no se recorten. */
const EDGE = 1;
/** Separación entre celdas, proporcional al tamaño de celda. */
const GAP_RATIO = 0.27;

/** Semanas (de lunes a domingo) terminando en la semana de `today`, de la más antigua a la actual. */
export function buildWeeks(count: number, today: DateKey): HeatmapCell[][] {
  const t = fromKey(today);
  const lastWeek = startOfWeek(t);
  return Array.from({ length: count }, (_, w) => {
    const start = addDays(lastWeek, -7 * (count - 1 - w));
    return Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, d);
      return { key: toKey(date), date, month: date.getMonth(), future: date > t };
    });
  });
}

/** Columna en la que va la etiqueta de cada mes (la que contiene el día 1). */
export function monthLabels(weeks: HeatmapCell[][]): { col: number; label: string }[] {
  const labels: { col: number; label: string }[] = [];
  weeks.forEach((week, col) => {
    const first = week.find((c) => c.date.getDate() === 1);
    if (first) {
      const m = first.date.getMonth();
      labels.push({ col, label: m === 0 ? `${MONTH_LABELS[m]} ${String(first.date.getFullYear()).slice(2)}` : MONTH_LABELS[m] });
    }
  });
  return labels;
}

type Segment = { x1: number; y1: number; x2: number; y2: number };

/**
 * Tramos de la línea escalonada que separa los meses: entre dos celdas vecinas
 * (horizontal o vertical) de meses distintos. Coordenadas en celdas; el trazo va por el hueco.
 */
export function monthBoundaries(weeks: HeatmapCell[][]): Segment[] {
  const segments: Segment[] = [];
  weeks.forEach((week, c) => {
    week.forEach((cell, d) => {
      if (cell.future) return;
      const left = weeks[c - 1]?.[d];
      if (left && left.month !== cell.month) segments.push({ x1: c, y1: d, x2: c, y2: d + 1 });
      const above = week[d - 1];
      if (above && above.month !== cell.month) segments.push({ x1: c, y1: d, x2: c + 1, y2: d });
    });
  });
  return segments;
}

/** Color de una celda según el progreso del día (0 = vacío, 1 = completo). */
export function cellColor(color: string, emptyAlpha: string, progress: number, scheduled: boolean): string {
  if (progress <= 0) return scheduled ? color + emptyAlpha : withAlpha(color, 0.07);
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
  weeks: fixedWeeks,
  cellSize = 11,
  showMonthLabels = false,
  showWeekdayLabels = false,
  endKey,
}: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState<number | null>(null);
  const today = todayKey();
  const end = endKey ?? today;
  const labelWidth = showWeekdayLabels ? WEEKDAY_LABEL_WIDTH : 0;

  // Tamaño de celda y número de semanas: fijo, o el máximo que quepa llenando todo el ancho.
  const { count, size } = useMemo(() => {
    if (fixedWeeks != null) return { count: fixedWeeks, size: cellSize };
    const available = (width ?? 0) - labelWidth - 2 * EDGE;
    // Sin medir aún (o con ancho 0 mientras la vista está oculta) no dibujamos nada.
    if (available < cellSize) return { count: 0, size: cellSize };
    const n = Math.max(1, Math.floor((available + cellSize * GAP_RATIO) / (cellSize * (1 + GAP_RATIO))));
    return { count: n, size: available / (n + (n - 1) * GAP_RATIO) };
  }, [fixedWeeks, width, labelWidth, cellSize]);
  const gap = size * GAP_RATIO;
  const step = size + gap;

  const weeks = useMemo(() => buildWeeks(count, end), [count, end]);

  // Agrupamos las celdas por color: un solo <Path> por color en vez de cientos de vistas.
  const paths = useMemo(() => {
    const byColor = new Map<string, string[]>();
    const r = Math.max(1.5, size * 0.25);
    weeks.forEach((week, c) =>
      week.forEach((cell, d) => {
        if (cell.future) return;
        const scheduled = isScheduled ? isScheduled(cell.date) : true;
        const fill = cellColor(color, theme.emptyAlpha, (counts?.[cell.key] ?? 0) / target, scheduled);
        const list = byColor.get(fill) ?? [];
        list.push(roundedRect(c * step, d * step, size, r));
        byColor.set(fill, list);
      }),
    );
    return [...byColor.entries()].map(([fill, rects]) => ({ fill, d: rects.join('') }));
  }, [weeks, counts, color, target, isScheduled, theme.emptyAlpha, size, step]);

  const boundary = useMemo(
    () =>
      monthBoundaries(weeks)
        // El trazo va por el centro del hueco; así los tramos se unen justo en las esquinas.
        .map((s) => `M${s.x1 * step - gap / 2} ${s.y1 * step - gap / 2}L${s.x2 * step - gap / 2} ${s.y2 * step - gap / 2}`)
        .join(''),
    [weeks, step, gap],
  );

  // Si termina hoy, hoy está en la última semana, en la fila de su día.
  const todayPos = count > 0 && end === today ? { c: count - 1, d: weekdayIndex(fromKey(today)) } : null;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    // Ancho 0 = vista oculta: conservamos la última medida para no redibujar al volver a mostrarla.
    if (w > 0 && w !== width) setWidth(w);
  };

  const gridWidth = Math.max(0, count * step - gap);
  const gridHeight = 7 * step - gap;
  const radius = Math.max(1.5, size * 0.25);
  const viewWidth = gridWidth + 2 * EDGE;
  const viewHeight = gridHeight + 2 * EDGE;
  const fit = fixedWeeks == null;

  return (
    <View onLayout={fixedWeeks == null ? onLayout : undefined}>
      {showMonthLabels && (
        <View style={{ height: MONTH_LABEL_HEIGHT, marginLeft: labelWidth + EDGE, width: gridWidth }}>
          {monthLabels(weeks).map(({ col, label }) => (
            <Text key={col} numberOfLines={1} style={[styles.monthLabel, { left: col * step, color: theme.muted }]}>
              {label}
            </Text>
          ))}
        </View>
      )}
      <View style={[styles.row, { minHeight: viewHeight }]}>
        {showWeekdayLabels && (
          <View style={{ width: labelWidth, paddingTop: EDGE }}>
            {WEEKDAY_LABELS.map((label, i) => (
              <Text
                key={label}
                style={[styles.weekdayLabel, { color: theme.muted, height: size, marginBottom: gap, lineHeight: size }]}
              >
                {i % 2 === 0 ? label : ''}
              </Text>
            ))}
          </View>
        )}
        {count > 0 && (
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
            {boundary ? <Path d={boundary} stroke={theme.border} strokeWidth={0.75} fill="none" /> : null}
            {todayPos && (
              <Rect
                x={todayPos.c * step + 0.75}
                y={todayPos.d * step + 0.75}
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

/** Leyenda "Menos ▢▢▢▢ Más" para hábitos con varias repeticiones al día. */
export function HeatmapLegend({ color }: { color: string }) {
  const theme = useTheme();
  const levels = [0, 0.33, 0.66, 1];
  return (
    <View style={[styles.row, styles.legend]}>
      <Text style={[styles.legendText, { color: theme.muted }]}>Menos</Text>
      {levels.map((l) => (
        <View key={l} style={[styles.legendCell, { backgroundColor: cellColor(color, theme.emptyAlpha, l, true) }]} />
      ))}
      <Text style={[styles.legendText, { color: theme.muted }]}>Más</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  monthLabel: { position: 'absolute', top: 0, fontSize: 10, width: 44 },
  weekdayLabel: { fontSize: 9 },
  legend: { alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  legendText: { fontSize: 11 },
  legendCell: { width: 11, height: 11, borderRadius: 3 },
});
