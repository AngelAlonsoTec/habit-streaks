import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

type Props<T> = {
  items: T[];
  /** Tamaño mínimo de cada elemento; se agrandan para que cada fila ocupe todo el ancho. */
  minItemSize: number;
  gap?: number;
  /** Columnas fijas (el tamaño se calcula para llenar el ancho). */
  columns?: number;
  /** Si se indica, solo se muestran estas filas. */
  maxRows?: number;
  keyOf: (item: T) => string;
  renderItem: (item: T, size: number) => ReactNode;
};

/** Cuadrícula de elementos cuadrados que siempre llena el ancho, sin huecos al final de la fila. */
export function FitGrid<T>({ items, minItemSize, gap = 10, columns: fixedColumns, maxRows, keyOf, renderItem }: Props<T>) {
  const [width, setWidth] = useState(0);
  const columns = !width ? 0 : fixedColumns ?? Math.max(1, Math.floor((width + gap) / (minItemSize + gap)));
  const size = columns ? (width - gap * (columns - 1)) / columns : minItemSize;
  const visible = maxRows && columns ? items.slice(0, maxRows * columns) : items;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  return (
    <View onLayout={onLayout} style={[styles.grid, { gap }]}>
      {columns > 0 &&
        visible.map((item) => (
          <View key={keyOf(item)} style={{ width: size, height: size }}>
            {renderItem(item, size)}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
