import { RefObject, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui';
import { useTheme } from '@/theme';

type Props = {
  visible: boolean;
  initial: string;
  color: string;
  onCancel: () => void;
  onConfirm: (time: string) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const PRESETS = ['07:00', '08:00', '12:00', '15:00', '18:00', '20:00', '21:00', '22:00'];
const ITEM_HEIGHT = 40;
const pad = (n: number) => String(n).padStart(2, '0');

export function TimePickerModal({ visible, ...props }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      {/* Se monta de nuevo en cada apertura para partir de la hora inicial. */}
      {visible && <PickerSheet {...props} />}
    </Modal>
  );
}

function PickerSheet({ initial, color, onCancel, onConfirm }: Omit<Props, 'visible'>) {
  const theme = useTheme();
  const [hour, setHour] = useState(() => Number(initial.split(':')[0]));
  const [minute, setMinute] = useState(() => (Math.round(Number(initial.split(':')[1]) / 5) * 5) % 60);
  const hourList = useRef<ScrollView>(null);
  const minuteList = useRef<ScrollView>(null);

  const scrollTo = (list: ScrollView | null, index: number) =>
    list?.scrollTo({ y: Math.max(0, (index - 2) * ITEM_HEIGHT), animated: false });

  const applyPreset = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    setHour(h);
    setMinute(m);
    scrollTo(hourList.current, h);
    scrollTo(minuteList.current, m / 5);
  };

  const column = (
    values: number[],
    selected: number,
    onSelect: (v: number) => void,
    ref: RefObject<ScrollView | null>,
    label: string,
  ) => (
    <ScrollView
      ref={ref}
      style={[styles.column, { backgroundColor: theme.surface }]}
      showsVerticalScrollIndicator={false}
      onLayout={() => scrollTo(ref.current, values.indexOf(selected))}
    >
      {values.map((v) => {
        const isSel = v === selected;
        return (
          <Pressable
            key={v}
            onPress={() => onSelect(v)}
            accessibilityLabel={`${label} ${pad(v)}`}
            accessibilityState={{ selected: isSel }}
            style={[styles.item, isSel && { backgroundColor: color }]}
          >
            <Text style={[styles.itemText, { color: isSel ? '#FFFFFF' : theme.text }, isSel && styles.bold]}>{pad(v)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <Pressable style={styles.backdrop} onPress={onCancel}>
      <Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={() => {}}>
        <Text style={[styles.title, { color: theme.muted }]}>Hora del recordatorio</Text>
        <Text style={[styles.preview, { color: theme.text }]}>
          {pad(hour)}:{pad(minute)}
        </Text>

        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <Chip key={p} label={p} color={color} selected={p === `${pad(hour)}:${pad(minute)}`} onPress={() => applyPreset(p)} />
          ))}
        </View>

        <View style={styles.columns}>
          {column(HOURS, hour, setHour, hourList, 'Hora')}
          <Text style={[styles.colon, { color: theme.text }]}>:</Text>
          {column(MINUTES, minute, setMinute, minuteList, 'Minuto')}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={onCancel} style={[styles.button, { backgroundColor: theme.surface }]}>
            <Text style={[styles.buttonText, { color: theme.text }]}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={() => onConfirm(`${pad(hour)}:${pad(minute)}`)}
            style={[styles.button, { backgroundColor: color }]}
          >
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Guardar hora</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 14 },
  title: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  preview: { fontSize: 44, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  columns: { flexDirection: 'row', alignItems: 'center', gap: 10, height: ITEM_HEIGHT * 5 },
  column: { flex: 1, height: ITEM_HEIGHT * 5, borderRadius: 14 },
  colon: { fontSize: 28, fontWeight: '800' },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: 10, marginHorizontal: 6 },
  itemText: { fontSize: 18, fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
