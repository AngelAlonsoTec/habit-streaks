import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FinanceCategory, knownService } from '@/lib/finance';
import { CurrencyCode, currencyInfo } from '@/lib/money';
import { CHART_OTHER, chartColor, IconName, inkOn, useTheme } from '@/theme';

/** Panel inferior. El contenido se monta solo mientras está abierto (cada apertura empieza de cero). */
export function SheetModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {open && (
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar">
            <Pressable style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
              {children}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

export function SheetHeader({ icon, color, title, subtitle, onClose }: {
  icon: IconName;
  color: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <View style={[styles.headerIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={19} color="#FFFFFF" />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.headerSubtitle, { color: theme.muted }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
        <Ionicons name="close" size={24} color={theme.muted} />
      </Pressable>
    </View>
  );
}

type AmountInputProps = Omit<TextInputProps, 'style' | 'keyboardType'> & {
  currency: CurrencyCode;
  /** Tamaño grande para el importe principal de un formulario. */
  large?: boolean;
};

/** Campo de importe con el símbolo de la moneda delante (o detrás, como en "12 €"). */
export function AmountInput({ currency, large, ...props }: AmountInputProps) {
  const theme = useTheme();
  const { symbol, symbolAfter } = currencyInfo(currency);
  const symbolText = (
    <Text style={[large ? styles.symbolLarge : styles.symbol, { color: theme.muted }]}>{symbol}</Text>
  );
  return (
    <View style={[styles.amountRow, { backgroundColor: theme.surface }, large && styles.amountRowLarge]}>
      {!symbolAfter && symbolText}
      <TextInput
        placeholder="0"
        placeholderTextColor={theme.muted}
        keyboardType="decimal-pad"
        returnKeyType="done"
        {...props}
        style={[large ? styles.amountLarge : styles.amount, { color: theme.text }]}
      />
      {symbolAfter && symbolText}
    </View>
  );
}

/** Campo numérico corto con su unidad detrás (litros, km, horas). */
export function NumberField({ unit, integer, keyboardType, ...props }: Omit<TextInputProps, 'style'> & { unit: string; integer?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.amountRow, styles.numberRow, { backgroundColor: theme.surface }]}>
      <TextInput
        placeholderTextColor={theme.muted}
        keyboardType={keyboardType ?? (integer ? 'number-pad' : 'decimal-pad')}
        returnKeyType="done"
        {...props}
        style={[styles.number, { color: theme.text }]}
      />
      <Text style={[styles.unit, { color: theme.muted }]}>{unit}</Text>
    </View>
  );
}

export function PrimaryButton({ label, color, onPress, disabled, icon }: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.primary, { backgroundColor: color, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}
    >
      {icon && <Ionicons name={icon} size={19} color={inkOn(color)} />}
      <Text style={[styles.primaryText, { color: inkOn(color) }]}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({ label, icon, color, onPress, accessibilityLabel }: {
  label: string;
  icon?: IconName;
  color?: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const fg = color ?? theme.text;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.textButton, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}
    >
      {icon && <Ionicons name={icon} size={16} color={fg} />}
      <Text style={[styles.textButtonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Barra de progreso de 0 a 1 (se recorta a 1: lo que sobra se cuenta en el texto). */
export function ProgressBar({ progress, color, track, style }: { progress: number; color: string; track: string; style?: ViewStyle }) {
  return (
    <View style={[styles.track, { backgroundColor: track }, style]}>
      <View style={[styles.fill, { width: `${Math.min(Math.max(progress, 0), 1) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Icono redondo de una categoría o meta. */
export function IconBadge({ icon, color, size = 38 }: { icon: IconName; color: string; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: color }]}>
      <Ionicons name={icon} size={size * 0.5} color={inkOn(color)} />
    </View>
  );
}

/**
 * Insignia de un pago: si el nombre es de un servicio conocido (Netflix, Spotify…), su inicial con su
 * color; si no, el icono de su categoría.
 */
export function PaymentBadge({ name, category, size = 38 }: { name: string; category: FinanceCategory | undefined; size?: number }) {
  const theme = useTheme();
  const service = knownService(name);
  if (!service) {
    return <IconBadge icon={category?.icon ?? 'repeat'} color={chartColor(category?.color ?? CHART_OTHER, theme)} size={size} />;
  }
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: service.color }]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.mono, { color: inkOn(service.color), fontSize: size * (service.mono.length > 1 ? 0.36 : 0.46) }]}
      >
        {service.mono}
      </Text>
    </View>
  );
}

const inputReset = Platform.select({ web: { outlineWidth: 0 } });

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18, paddingHorizontal: 20, maxHeight: '92%', gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSubtitle: { fontSize: 13, marginTop: 1 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 14 },
  amountRowLarge: { borderRadius: 18, paddingHorizontal: 18 },
  symbol: { fontSize: 18, fontWeight: '700' },
  symbolLarge: { fontSize: 30, fontWeight: '800' },
  // minWidth 0: en web un TextInput no encoge por debajo de su ancho natural y desborda la fila.
  amount: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: '700', paddingVertical: 12, ...inputReset },
  amountLarge: { flex: 1, minWidth: 0, fontSize: 34, fontWeight: '800', paddingVertical: 14, fontVariant: ['tabular-nums'], ...inputReset },
  numberRow: { flex: 1 },
  number: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '700', paddingVertical: 11, ...inputReset },
  unit: { fontSize: 14, fontWeight: '600' },
  primary: { flexDirection: 'row', gap: 8, borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '800' },
  textButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
  },
  textButtonText: { fontSize: 14, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  mono: { fontWeight: '900', letterSpacing: -0.3 },
});
