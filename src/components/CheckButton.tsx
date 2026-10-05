import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { ProgressRing } from '@/components/ProgressRing';
import { useTheme } from '@/theme';

type Props = {
  count: number;
  target: number;
  color: string;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  /** Hábito cuantitativo: el anillo muestra el progreso y un "+" (la cantidad va en el texto de la tarjeta). */
  quantity?: boolean;
};

export function CheckButton({ count, target, color, onPress, onLongPress, accessibilityLabel, size = 46, quantity }: Props) {
  const theme = useTheme();
  const done = count >= target;
  const [scale] = useState(() => new Animated.Value(1));
  const wasDone = useRef(done);

  // Pequeño "rebote" al completar.
  useEffect(() => {
    if (done && !wasDone.current) {
      scale.setValue(0.8);
      Animated.spring(scale, { toValue: 1, friction: 3, tension: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    }
    wasDone.current = done;
  }, [done, scale]);

  const tint = color + theme.emptyAlpha;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ checked: done }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={
        quantity ? 'Toca para registrar una cantidad.' : target > 1 ? 'Toca para sumar una vez. Mantén pulsado para reiniciar.' : undefined
      }
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {quantity && !done ? (
          <ProgressRing size={size} strokeWidth={4} progress={count / target} color={color} trackColor={tint}>
            <Ionicons name="add" size={size * 0.5} color={color} />
          </ProgressRing>
        ) : target > 1 && !done ? (
          <ProgressRing size={size} strokeWidth={4} progress={count / target} color={color} trackColor={tint}>
            <Text style={[styles.count, { color: count > 0 ? color : theme.muted }]}>
              {count}/{target}
            </Text>
          </ProgressRing>
        ) : (
          <Animated.View
            style={[
              styles.box,
              { width: size, height: size, borderRadius: size * 0.3, backgroundColor: done ? color : tint },
            ]}
          >
            <Ionicons name="checkmark" size={size * 0.55} color={done ? '#FFFFFF' : color} />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 13, fontWeight: '800' },
});
