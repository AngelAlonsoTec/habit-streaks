import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Franja suave detrás de la columna elegida, a todo lo alto: marca el día aunque no tenga barra.
 * Ocupa hasta la mitad del hueco con las vecinas para no taparles las barras.
 */
export function SelectedBand({ gap }: { gap: number }) {
  const theme = useTheme();
  return (
    // Se monta ya con su fondo (Android pierde las esquinas si una vista lo gana después).
    <View
      collapsable={false}
      style={[styles.band, { left: -gap / 2, right: -gap / 2, backgroundColor: theme.surface }]}
    />
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, bottom: 0, borderRadius: 6, pointerEvents: 'none' },
});
