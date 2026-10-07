import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  /** `hidden`: la etiqueta solo se ve cuando su columna está elegida (en el mes se rotulan 1, 5, 10…). */
  labels: { key: string; text: string; selected: boolean; hidden?: boolean }[];
  /** Margen izquierdo de las columnas (donde van los topes del eje). */
  gutter: number;
  gap: number;
};

const LABEL_WIDTH = 28;
/** Lo que ocupa la pastilla del día elegido: las etiquetas vecinas más cerca que esto se esconden. */
const PILL_ROOM = 24;

/**
 * Etiquetas del eje centradas bajo cada columna. Van posicionadas aparte para que "10" o "25"
 * quepan aunque la columna del mes mida 8 px (dentro de ella se cortarían). La del día elegido va
 * en una pastilla, aunque ese día no se rotule normalmente.
 */
export function AxisLabels({ labels, gutter, gap }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const n = labels.length;
  const column = n ? (width - gutter - gap * (n - 1)) / n : 0;
  const left = (i: number) => gutter + i * (column + gap) + column / 2 - LABEL_WIDTH / 2;
  const chosen = labels.findIndex((l) => l.selected);

  return (
    <View onLayout={onLayout} style={styles.row}>
      {width > 0 &&
        labels.map((l, i) =>
          l.text && !l.hidden && i !== chosen && (chosen < 0 || Math.abs(i - chosen) * (column + gap) >= PILL_ROOM) ? (
            <Text key={l.key} numberOfLines={1} style={[styles.label, { left: left(i), color: theme.muted }]}>
              {l.text}
            </Text>
          ) : null,
        )}
      {width > 0 && chosen >= 0 && labels[chosen].text ? (
        // Siempre montada con su fondo (solo cambia de lugar): en Android, una vista que gana fondo
        // después pierde las esquinas redondas.
        <View collapsable={false} style={[styles.pillBox, { left: left(chosen) }]}>
          <View collapsable={false} style={[styles.pill, { backgroundColor: theme.text }]}>
            <Text numberOfLines={1} style={[styles.pillText, { color: theme.card }]}>
              {labels[chosen].text}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 18, marginTop: 6 },
  label: { position: 'absolute', top: 2, width: LABEL_WIDTH, fontSize: 10.5, textAlign: 'center', fontWeight: '600' },
  pillBox: { position: 'absolute', top: 0, width: LABEL_WIDTH, alignItems: 'center' },
  pill: { minWidth: 20, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 10.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
