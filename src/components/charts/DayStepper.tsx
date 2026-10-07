import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconName, useTheme } from '@/theme';

type Props = {
  /** Los días que se pueden elegir, en orden. */
  keys: string[];
  selected: string | null;
  onSelect: (key: string) => void;
  /** El detalle del día elegido (va entre los dos botones). */
  children: ReactNode;
};

/**
 * Botones para ir al día anterior o al siguiente de una gráfica: con el dedo cuesta atinarle a
 * una barra de 8 px. Sin día elegido, "anterior" empieza por el último y "siguiente" por el primero.
 */
export function DayStepper({ keys, selected, onSelect, children }: Props) {
  const index = selected ? keys.indexOf(selected) : -1;
  const last = keys.length - 1;
  return (
    <View style={styles.row}>
      <StepButton
        icon="chevron-back"
        label="Día anterior"
        disabled={!keys.length || index === 0}
        onPress={() => onSelect(keys[index < 0 ? last : index - 1])}
      />
      <View style={styles.flex}>{children}</View>
      <StepButton
        icon="chevron-forward"
        label="Día siguiente"
        disabled={!keys.length || index === last}
        onPress={() => onSelect(keys[index < 0 ? 0 : index + 1])}
      />
    </View>
  );
}

function StepButton({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.surface, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  button: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
