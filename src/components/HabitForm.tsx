import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FitGrid } from '@/components/FitGrid';
import { TimePickerModal } from '@/components/TimePickerModal';
import { Chip, SectionTitle, Segmented } from '@/components/ui';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import { WEEKDAY_LABELS } from '@/lib/dates';
import {
  ALL_DAYS, formatAmount, Goal, HabitInput, HabitKind, MAX_AMOUNT, parseAmount, roundAmount, sortTimes, TIME_OF_DAY, TIME_OF_DAY_ORDER,
  TimeOfDay, UNIT_PRESETS, unitPreset,
} from '@/lib/habit';
import { REMINDERS_SUPPORTED, REMINDERS_UNAVAILABLE_MESSAGE, requestReminderPermission } from '@/lib/notifications';
import { HABIT_TEMPLATES, QUIT_TEMPLATES } from '@/lib/templates';
import { MAX_GOAL, MAX_UNIT_LENGTH, useHabits } from '@/store/habits';
import { HABIT_COLORS, HABIT_ICONS, IconName, useTheme } from '@/theme';

type Props = {
  initial?: HabitInput;
  submitLabel: string;
  onSubmit: (input: HabitInput) => void;
};

type Step = { label: string; title: string; subtitle: string; icon: IconName };

const STEPS: Record<HabitKind, Step[]> = {
  build: [
    { label: 'Hábito', title: '¿Qué hábito quieres construir?', subtitle: 'Ponle un nombre corto y elige cómo se verá.', icon: 'create-outline' },
    { label: 'Frecuencia', title: '¿Con qué frecuencia?', subtitle: 'Define tu meta y los días en que toca.', icon: 'flag-outline' },
    { label: 'Horario', title: '¿Cuándo lo harás?', subtitle: 'Agrupa tu día y recibe avisos a la hora que elijas.', icon: 'alarm-outline' },
    { label: 'Categorías', title: '¿Cómo lo clasificas?', subtitle: 'Opcional. Te permite filtrar tus hábitos.', icon: 'pricetags-outline' },
  ],
  quit: [
    { label: 'Hábito', title: '¿Qué hábito quieres dejar?', subtitle: 'Ponle un nombre corto y elige cómo se verá.', icon: 'create-outline' },
    { label: 'Límite', title: '¿Cuál es tu límite?', subtitle: 'Lo máximo que te permites. Con 0 lo dejas del todo.', icon: 'flag-outline' },
    { label: 'Avisos', title: '¿Quieres recordatorios?', subtitle: 'Un aviso a la hora que elijas para mantener tu propósito.', icon: 'alarm-outline' },
    { label: 'Categorías', title: '¿Cómo lo clasificas?', subtitle: 'Opcional. Te permite filtrar tus hábitos.', icon: 'pricetags-outline' },
  ],
};

/** Meta de partida al generar; al dejar, el límite de partida es 0 (dejarlo del todo). */
const DEFAULT_GOAL: Record<HabitKind, Goal> = { build: { period: 'day', count: 1 }, quit: { period: 'day', count: 0 } };

const DAY_PRESETS = [
  { label: 'Todos los días', days: ALL_DAYS },
  { label: 'Entre semana', days: [0, 1, 2, 3, 4] },
  { label: 'Fines de semana', days: [5, 6] },
];

const COLLAPSED_ICON_ROWS = 2;

type Measure = 'count' | 'amount';
const DEFAULT_UNIT = UNIT_PRESETS[0];

export function HabitForm({ initial, submitLabel, onSubmit }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const customCategories = useHabits((s) => s.customCategories);
  const addCategory = useHabits((s) => s.addCategory);
  const isNew = !initial;

  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<HabitKind>(initial?.kind ?? 'build');
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? HABIT_COLORS[0]);
  const [icon, setIcon] = useState(initial?.icon ?? HABIT_ICONS[0]);
  const [categories, setCategories] = useState<string[]>(initial?.categories ?? []);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(initial?.timeOfDay ?? 'anytime');
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? { period: 'day', count: 1 });
  const [measure, setMeasure] = useState<Measure>(initial?.unit != null ? 'amount' : 'count');
  const [unit, setUnit] = useState(initial?.unit ?? DEFAULT_UNIT.unit);
  /** Texto del campo de la meta en cantidades (se edita libremente y se valida al salir). */
  const [amountText, setAmountText] = useState(initial?.unit != null ? formatAmount(initial.goal.count) : '');
  const [editingUnit, setEditingUnit] = useState(false);
  const [days, setDays] = useState<number[]>(initial?.days ?? ALL_DAYS);
  const [reminders, setReminders] = useState<string[]>(initial?.reminders ?? []);
  const [showAllIcons, setShowAllIcons] = useState(!isNew && HABIT_ICONS.indexOf(initial.icon) >= 10);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ index: number | null; time: string } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const quit = kind === 'quit';
  const steps = STEPS[kind];
  const hasName = name.trim().length > 0;
  const isLast = step === steps.length - 1;
  // Al crear, solo se puede saltar a pasos ya visitados; al editar, a cualquiera.
  const [furthest, setFurthest] = useState(isNew ? 0 : steps.length - 1);
  /** Mínimo de la meta: al dejar un hábito el límite puede ser 0. */
  const minCount = quit ? 0 : 1;

  const goTo = (i: number) => {
    if (!hasName) return;
    setStep(i);
    setFurthest((f) => Math.max(f, i));
  };

  const changeKind = (k: HabitKind) => {
    setKind(k);
    setGoal(DEFAULT_GOAL[k]);
    setMeasure('count');
    setAmountText('');
    if (k === 'quit') setTimeOfDay('anytime');
  };

  const applyTemplate = (t: HabitInput) => {
    setKind(t.kind);
    setName(t.name);
    setColor(t.color);
    setIcon(t.icon);
    setCategories(t.categories);
    setTimeOfDay(t.timeOfDay);
    setGoal(t.goal);
    setMeasure(t.unit != null ? 'amount' : 'count');
    setUnit(t.unit ?? DEFAULT_UNIT.unit);
    setAmountText(t.unit != null ? formatAmount(t.goal.count) : '');
    setDays(t.days);
    setReminders(t.reminders);
    setShowAllIcons(HABIT_ICONS.indexOf(t.icon) >= 10);
  };

  const toggleCategory = (id: string) =>
    setCategories((cs) => (cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id]));

  const createCategory = () => {
    if (newCategory?.trim()) {
      const id = addCategory(newCategory);
      setCategories((cs) => (cs.includes(id) ? cs : [...cs, id]));
    }
    setNewCategory(null);
  };

  const toggleDay = (d: number) =>
    setDays((ds) => (ds.includes(d) ? (ds.length > 1 ? ds.filter((x) => x !== d) : ds) : [...ds, d].sort()));

  const setCount = (count: number) => setGoal((g) => ({ ...g, count: Math.min(Math.max(minCount, count), MAX_GOAL) }));

  const setAmount = (amount: number) => {
    const count = Math.min(Math.max(quit ? 0 : 0.01, roundAmount(amount)), MAX_AMOUNT);
    setGoal((g) => ({ ...g, count }));
    setAmountText(formatAmount(count));
  };
  const amountStep = unitPreset(unit)?.steps[0] ?? 1;

  const changeMeasure = (m: Measure) => {
    setMeasure(m);
    if (m === 'amount') setAmount(unitPreset(unit)?.goal ?? DEFAULT_UNIT.goal);
    else setGoal((g) => ({ ...g, count: quit ? 0 : g.period === 'week' ? 3 : 1 }));
  };

  const chooseUnit = (u: string) => {
    setEditingUnit(false);
    setUnit(u);
    const preset = unitPreset(u);
    if (preset) setAmount(goal.period === 'week' ? preset.goal * 7 : preset.goal);
  };

  const openPicker = async (index: number | null) => {
    if (REMINDERS_SUPPORTED) setPermissionDenied(!(await requestReminderPermission()));
    const time = index == null ? TIME_OF_DAY[timeOfDay].defaultReminder : reminders[index];
    setPicker({ index, time });
  };

  const saveTime = (time: string) => {
    if (!picker) return;
    setReminders((rs) => sortTimes(picker.index == null ? [...rs, time] : rs.map((r, i) => (i === picker.index ? time : r))));
    setPicker(null);
  };

  const submit = () => {
    if (!hasName) return;
    const finalUnit = measure === 'amount' ? unit.trim() || 'unidades' : null;
    onSubmit({ name: name.trim(), color, icon, categories, timeOfDay, kind, goal, unit: finalUnit, days, reminders });
  };

  const current = steps[step];
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const stepAppearance = (
    <>
      {isNew && (
        <Segmented
          value={kind}
          color={color}
          style={styles.kindSelector}
          options={[
            { value: 'build', label: 'Generar hábito', icon: 'trending-up' },
            { value: 'quit', label: 'Dejar hábito', icon: 'ban' },
          ]}
          onChange={changeKind}
        />
      )}
      <View style={[styles.nameRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.preview, { backgroundColor: color }]}>
          <Ionicons name={icon} size={26} color="#FFFFFF" />
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nombre del hábito"
          placeholderTextColor={theme.muted}
          style={[styles.nameInput, { color: theme.text }]}
          maxLength={60}
          autoFocus={isNew}
          returnKeyType="next"
          onSubmitEditing={() => goTo(1)}
        />
      </View>

      {isNew && !hasName && (
        <>
          <SectionTitle>Sugerencias</SectionTitle>
          <View style={styles.wrap}>
            {(quit ? QUIT_TEMPLATES : HABIT_TEMPLATES).map((t) => (
              <Chip key={t.name} label={t.name} icon={t.icon} onPress={() => applyTemplate(t)} />
            ))}
          </View>
        </>
      )}

      <SectionTitle>Color</SectionTitle>
      <FitGrid
        items={HABIT_COLORS}
        columns={6}
        minItemSize={36}
        gap={12}
        keyOf={(c) => c}
        renderItem={(c, size) => (
          <Pressable
            onPress={() => setColor(c)}
            accessibilityLabel={`Color ${c}`}
            accessibilityState={{ selected: c === color }}
            style={[styles.swatch, { backgroundColor: c, borderRadius: size / 2, borderColor: c === color ? theme.text : 'transparent' }]}
          >
            {c === color && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
          </Pressable>
        )}
      />

      <SectionTitle
        right={
          <Pressable onPress={() => setShowAllIcons((v) => !v)} hitSlop={8}>
            <Text style={[styles.link, { color }]}>{showAllIcons ? 'Ver menos' : 'Ver todos'}</Text>
          </Pressable>
        }
      >
        Icono
      </SectionTitle>
      <FitGrid
        items={HABIT_ICONS}
        minItemSize={48}
        gap={10}
        maxRows={showAllIcons ? undefined : COLLAPSED_ICON_ROWS}
        keyOf={(n) => n}
        renderItem={(n) => {
          const selected = n === icon;
          return (
            <Pressable
              onPress={() => setIcon(n)}
              accessibilityLabel={`Icono ${n}`}
              accessibilityState={{ selected }}
              style={[styles.iconOption, { backgroundColor: selected ? color : theme.surface }]}
            >
              <Ionicons name={n} size={22} color={selected ? '#FFFFFF' : theme.text} />
            </Pressable>
          );
        }}
      />
    </>
  );

  const isPresetUnit = unitPreset(unit) != null;
  const customUnit = !isPresetUnit && !!unit.trim();
  const unitChips = (
    <>
      <SectionTitle>Unidad</SectionTitle>
      <View style={styles.wrap}>
        {UNIT_PRESETS.map((p) => (
          <Chip key={p.unit} label={p.unit} color={color} selected={!editingUnit && p.unit === unit} onPress={() => chooseUnit(p.unit)} />
        ))}
        {editingUnit ? (
          <TextInput
            value={isPresetUnit ? '' : unit}
            onChangeText={setUnit}
            onSubmitEditing={() => setEditingUnit(false)}
            onBlur={() => setEditingUnit(false)}
            autoFocus
            placeholder="Ej.: capítulos"
            placeholderTextColor={theme.muted}
            maxLength={MAX_UNIT_LENGTH}
            returnKeyType="done"
            accessibilityLabel="Unidad propia"
            style={[styles.categoryInput, styles.unitInput, { color: theme.text, borderColor: color }]}
          />
        ) : (
          <Chip
            label={customUnit ? unit : 'Otra'}
            icon={customUnit ? 'create-outline' : 'add'}
            color={color}
            selected={customUnit}
            onPress={() => {
              if (isPresetUnit) setUnit('');
              setEditingUnit(true);
            }}
          />
        )}
      </View>
    </>
  );

  const amountStepper = (
    <View style={[styles.stepperRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Pressable
        onPress={() => setAmount(goal.count - amountStep)}
        accessibilityLabel="Reducir meta"
        style={[styles.stepperButton, { backgroundColor: theme.surface }]}
      >
        <Ionicons name="remove" size={20} color={theme.text} />
      </Pressable>
      <View style={styles.stepperValue}>
        <View style={styles.amountRow}>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            onBlur={() => setAmount(parseAmount(amountText) ?? goal.count)}
            onSubmitEditing={() => setAmount(parseAmount(amountText) ?? goal.count)}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectTextOnFocus
            accessibilityLabel="Meta"
            // Ancho según el texto: así número y unidad quedan juntos y centrados.
            style={[styles.stepperNumber, styles.amountInput, { color: theme.text, width: (amountText.length + 1) * 15 }]}
          />
          <Text style={[styles.amountUnit, { color: theme.muted }]} numberOfLines={1}>{unit.trim() || 'unidades'}</Text>
        </View>
        <Text style={[styles.stepperLabel, { color: theme.muted }]}>
          {goal.period === 'day' ? 'al día' : 'por semana'}{quit ? ' como máximo' : ''}
        </Text>
      </View>
      <Pressable
        onPress={() => setAmount(goal.count + amountStep)}
        accessibilityLabel="Aumentar meta"
        style={[styles.stepperButton, { backgroundColor: theme.surface }]}
      >
        <Ionicons name="add" size={20} color={theme.text} />
      </Pressable>
    </View>
  );

  const countStepper = (
    <View style={[styles.stepperRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Pressable
        onPress={() => setCount(goal.count - 1)}
        accessibilityLabel="Menos veces"
        style={[styles.stepperButton, { backgroundColor: theme.surface }]}
      >
        <Ionicons name="remove" size={20} color={theme.text} />
      </Pressable>
      <View style={styles.stepperValue}>
        <Text style={[styles.stepperNumber, { color: theme.text }]}>{goal.count}</Text>
        <Text style={[styles.stepperLabel, { color: theme.muted }]}>
          {quit && goal.count === 0
            ? 'Ninguna: dejarlo del todo'
            : `${goal.count === 1 ? 'vez' : 'veces'} ${goal.period === 'day' ? 'al día' : 'por semana'}${quit ? ' como máximo' : ''}`}
        </Text>
      </View>
      <Pressable
        onPress={() => setCount(goal.count + 1)}
        accessibilityLabel="Más veces"
        style={[styles.stepperButton, { backgroundColor: theme.surface }]}
      >
        <Ionicons name="add" size={20} color={theme.text} />
      </Pressable>
    </View>
  );

  const stepGoal = (
    <>
      <SectionTitle>¿Cómo lo mides?</SectionTitle>
      <Segmented
        value={measure}
        color={color}
        options={[
          { value: 'count', label: 'Veces', icon: 'checkmark-done-outline' },
          { value: 'amount', label: 'Cantidad', icon: 'speedometer-outline' },
        ]}
        onChange={changeMeasure}
      />
      {measure === 'amount' && unitChips}

      <SectionTitle>{quit ? 'Límite' : 'Meta'}</SectionTitle>
      <Segmented
        value={goal.period}
        color={color}
        options={[
          { value: 'day', label: quit ? 'Diario' : 'Diaria', icon: 'today-outline' },
          { value: 'week', label: 'Semanal', icon: 'calendar-outline' },
        ]}
        onChange={(period) =>
          setGoal((g) => ({
            period,
            // El límite se conserva; la meta por veces se ajusta a algo razonable para el periodo.
            count: measure === 'amount' || quit ? g.count : period === 'week' ? Math.min(Math.max(g.count, 3), 7) : 1,
          }))
        }
      />
      {measure === 'amount' ? amountStepper : countStepper}
      <Text style={[styles.hint, { color: theme.muted }]}>
        {quit
          ? 'Cada día sin pasarte del límite cuenta como logrado. Solo registras cuando lo haces.'
          : measure === 'amount'
          ? 'Cada vez que lo hagas, anota la cantidad con las sumas rápidas o escribiendo el número exacto.'
          : goal.period === 'day'
            ? 'Por ejemplo, 8 para vasos de agua. Cada toque en el hábito suma una vez.'
            : 'Elige tú qué días hacerlo; lo importante es llegar a la meta de la semana.'}
      </Text>

      {goal.period === 'day' && (
        <>
          <SectionTitle>Qué días</SectionTitle>
          <View style={styles.wrap}>
            {DAY_PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                color={color}
                selected={[...days].sort().join() === p.days.join()}
                onPress={() => setDays(p.days)}
              />
            ))}
          </View>
          <View style={styles.daysRow}>
            {WEEKDAY_LABELS.map((label, d) => {
              const on = days.includes(d);
              return (
                <Pressable
                  key={label}
                  onPress={() => toggleDay(d)}
                  accessibilityLabel={`Día ${label}`}
                  accessibilityState={{ selected: on }}
                  style={[styles.dayCircle, { backgroundColor: on ? color : theme.surface }]}
                >
                  <Text style={[styles.dayText, { color: on ? '#FFFFFF' : theme.muted }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </>
  );

  const timeOfDayPicker = (
    <>
      <SectionTitle>Momento del día</SectionTitle>
      <View style={styles.todGrid}>
        {TIME_OF_DAY_ORDER.map((t) => {
          const selected = t === timeOfDay;
          return (
            <Pressable
              key={t}
              onPress={() => setTimeOfDay(t)}
              accessibilityState={{ selected }}
              style={[
                styles.todOption,
                { backgroundColor: selected ? color + theme.emptyAlpha : theme.surface, borderColor: selected ? color : 'transparent' },
              ]}
            >
              <Ionicons name={TIME_OF_DAY[t].icon} size={20} color={selected ? color : theme.muted} />
              <Text style={[styles.todText, { color: selected ? theme.text : theme.muted }]}>{TIME_OF_DAY[t].label}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  const stepSchedule = (
    <>
      {!quit && timeOfDayPicker}

      <SectionTitle>Recordatorios</SectionTitle>
      <View style={styles.wrap}>
        {reminders.map((r, i) => (
          <View key={r} style={[styles.reminderPill, { backgroundColor: color + theme.emptyAlpha }]}>
            <Pressable onPress={() => openPicker(i)} style={styles.reminderTime} accessibilityLabel={`Cambiar ${r}`}>
              <Ionicons name="alarm-outline" size={16} color={color} />
              <Text style={[styles.reminderText, { color: theme.text }]}>{r}</Text>
            </Pressable>
            <Pressable
              onPress={() => setReminders((rs) => rs.filter((x) => x !== r))}
              hitSlop={8}
              accessibilityLabel={`Quitar recordatorio ${r}`}
            >
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </Pressable>
          </View>
        ))}
        <Chip label={reminders.length ? 'Otra hora' : 'Añadir hora'} icon="add" onPress={() => openPicker(null)} />
      </View>
      <Text style={[styles.hint, { color: theme.muted }]}>
        {!REMINDERS_SUPPORTED
          ? REMINDERS_UNAVAILABLE_MESSAGE
          : permissionDenied
            ? 'Las notificaciones están desactivadas. Actívalas en los ajustes del teléfono para recibir avisos.'
            : quit
              ? 'Te avisamos los días que toca mientras sigas dentro del límite.'
              : 'Solo te avisamos los días que toca y si aún no lo has completado.'}
      </Text>
    </>
  );

  const stepCategories = (
    <View style={styles.wrap}>
      {allCategories.map((c) => (
        <Chip
          key={c.id}
          label={c.name}
          icon={c.icon}
          color={color}
          selected={categories.includes(c.id)}
          onPress={() => toggleCategory(c.id)}
        />
      ))}
      {newCategory == null ? (
        <Chip label="Nueva" icon="add" onPress={() => setNewCategory('')} />
      ) : (
        <TextInput
          value={newCategory}
          onChangeText={setNewCategory}
          onSubmitEditing={createCategory}
          onBlur={createCategory}
          autoFocus
          placeholder="Nombre de la categoría"
          placeholderTextColor={theme.muted}
          maxLength={24}
          returnKeyType="done"
          style={[styles.categoryInput, { color: theme.text, borderColor: color }]}
        />
      )}
    </View>
  );

  const content = [stepAppearance, stepGoal, stepSchedule, stepCategories][step];

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <View style={styles.steps}>
        {steps.map((s, i) => {
          const reachable = hasName && i <= furthest;
          const active = i === step;
          return (
            <Pressable
              key={s.label}
              disabled={!reachable}
              onPress={() => goTo(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled: !reachable }}
              accessibilityLabel={`Paso ${i + 1}: ${s.label}`}
              style={styles.stepItem}
            >
              <View style={[styles.stepBar, { backgroundColor: i <= furthest ? color : theme.surface }]} />
              <Text
                numberOfLines={1}
                style={[styles.stepLabel, { color: active ? theme.text : reachable ? theme.muted : theme.border }, active && styles.bold]}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView key={step} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.stepTitle, { color: theme.text }]}>{current.title}</Text>
        <Text style={[styles.stepSubtitle, { color: theme.muted }]}>{current.subtitle}</Text>
        {content}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: theme.bg, borderColor: theme.border }]}>
        {isNew ? (
          <>
            {step > 0 && (
              <Pressable onPress={() => setStep(step - 1)} style={[styles.secondary, { backgroundColor: theme.surface }]}>
                <Text style={[styles.secondaryText, { color: theme.text }]}>Atrás</Text>
              </Pressable>
            )}
            <Pressable
              onPress={isLast ? submit : () => goTo(step + 1)}
              disabled={!hasName}
              style={({ pressed }) => [styles.primary, { backgroundColor: color, opacity: !hasName ? 0.4 : pressed ? 0.8 : 1 }]}
            >
              <Text style={styles.primaryText}>{isLast ? submitLabel : 'Siguiente'}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={submit}
            disabled={!hasName}
            style={({ pressed }) => [styles.primary, { backgroundColor: color, opacity: !hasName ? 0.4 : pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.primaryText}>{submitLabel}</Text>
          </Pressable>
        )}
      </View>

      <TimePickerModal
        visible={picker != null}
        initial={picker?.time ?? '08:00'}
        color={color}
        onCancel={() => setPicker(null)}
        onConfirm={saveTime}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  steps: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 8 },
  stepItem: { flex: 1, gap: 6 },
  stepBar: { height: 4, borderRadius: 2 },
  stepLabel: { fontSize: 12, textAlign: 'center' },
  bold: { fontWeight: '700' },
  kindSelector: { marginBottom: 14 },
  content: { padding: 16, paddingTop: 20, paddingBottom: 32 },
  stepTitle: { fontSize: 22, fontWeight: '800' },
  stepSubtitle: { fontSize: 14, marginTop: 4, marginBottom: 16, lineHeight: 20 },
  nameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
  },
  preview: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nameInput: { flex: 1, fontSize: 20, fontWeight: '700', paddingVertical: 8, ...Platform.select({ web: { outlineWidth: 0 } }) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  link: { fontSize: 14, fontWeight: '700' },
  swatch: { flex: 1, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  iconOption: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 8,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  stepperButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { flex: 1, alignItems: 'center' },
  stepperNumber: { fontSize: 24, fontWeight: '800' },
  stepperLabel: { fontSize: 13 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, maxWidth: '100%' },
  amountInput: { minWidth: 36, maxWidth: 160, textAlign: 'center', padding: 0, ...Platform.select({ web: { outlineWidth: 0 } }) },
  amountUnit: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  unitInput: { minWidth: 120 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '700' },
  todGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  todOption: {
    flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5,
  },
  todText: { fontSize: 14, fontWeight: '600' },
  reminderPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 8,
    paddingVertical: 7, borderRadius: 999,
  },
  reminderTime: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reminderText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  categoryInput: {
    borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, minWidth: 160,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  primary: { flex: 2, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  secondary: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  secondaryText: { fontSize: 17, fontWeight: '700' },
});
