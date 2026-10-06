import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  labels: { key: string; text: string; selected: boolean }[];
  /** Margen izquierdo de las columnas (donde van los topes del eje). */
  gutter: number;
  gap: number;
};

const LABEL_WIDTH = 28;

/**
 * Etiquetas del eje centradas bajo cada columna. Van posicionadas aparte para que "10" o "25"
 * quepan aunque la columna del mes mida 8 px (dentro de ella se cortarían).
 */
export function AxisLabels({ labels, gutter, gap }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const n = labels.length;
  const column = n ? (width - gutter - gap * (n - 1)) / n : 0;

  return (
    <View onLayout={onLayout} style={styles.row}>
      {width > 0 &&
        labels.map((l, i) =>
          l.text ? (
            <Text
              key={l.key}
              numberOfLines={1}
              style={[
                styles.label,
                { left: gutter + i * (column + gap) + column / 2 - LABEL_WIDTH / 2, color: l.selected ? theme.text : theme.muted },
                l.selected && styles.bold,
              ]}
            >
              {l.text}
            </Text>
          ) : null,
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 16, marginTop: 6 },
  label: { position: 'absolute', top: 0, width: LABEL_WIDTH, fontSize: 10.5, textAlign: 'center', fontWeight: '600' },
  bold: { fontWeight: '800' },
});
