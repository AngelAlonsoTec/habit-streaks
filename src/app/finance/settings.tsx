import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CurrencyOptions, ProfileOptions } from '@/components/finance/Onboarding';
import { IconBadge, TextButton } from '@/components/finance/ui';
import { Card, SectionTitle } from '@/components/ui';
import { isCustomCategory, MAX_PLATFORM_LENGTH, Profile } from '@/lib/finance';
import { confirmAction, goBack } from '@/lib/platform';
import { useFinance } from '@/store/finance';
import { useTheme } from '@/theme';

export default function FinanceSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const profiles = useFinance((s) => s.profiles);
  const currency = useFinance((s) => s.currency);
  const platforms = useFinance((s) => s.platforms);
  const categories = useFinance((s) => s.categories);
  const setProfiles = useFinance((s) => s.setProfiles);
  const setCurrency = useFinance((s) => s.setCurrency);
  const addPlatform = useFinance((s) => s.addPlatform);
  const removePlatform = useFinance((s) => s.removePlatform);
  const deleteCategory = useFinance((s) => s.deleteCategory);
  const resetFinance = useFinance((s) => s.resetFinance);
  const [newPlatform, setNewPlatform] = useState('');

  const custom = categories.filter((c) => isCustomCategory(c.id));

  // Siempre queda al menos un perfil.
  const toggleProfile = (p: Profile) => {
    const next = profiles.includes(p) ? profiles.filter((x) => x !== p) : [...profiles, p];
    if (next.length) setProfiles(next);
  };

  const createPlatform = () => {
    addPlatform(newPlatform);
    setNewPlatform('');
  };

  const removeCategory = async (id: string, name: string) => {
    if (await confirmAction('Eliminar categoría', `Los movimientos de "${name}" pasarán a "Otros".`, 'Eliminar')) {
      deleteCategory(id);
    }
  };

  const reset = async () => {
    if (await confirmAction('Borrar Finanzas', 'Se borrarán todos tus movimientos, fijos, presupuestos y metas de ahorro. Tus hábitos no se tocan.', 'Borrar todo')) {
      resetFinance();
      goBack('/finance');
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
      <SectionTitle>Perfil</SectionTitle>
      <ProfileOptions selected={profiles} onToggle={toggleProfile} />
      <Text style={[styles.note, { color: theme.muted }]}>
        Al añadir un perfil se suman sus categorías. Al quitarlo, las categorías se quedan con sus movimientos.
      </Text>

      <SectionTitle>Moneda</SectionTitle>
      <CurrencyOptions value={currency} onChange={setCurrency} />
      <Text style={[styles.note, { color: theme.muted }]}>Cambiar la moneda no convierte los importes que ya apuntaste.</Text>

      {profiles.includes('driver') && (
        <>
          <SectionTitle>Plataformas</SectionTitle>
          <View style={styles.wrap}>
            {platforms.map((p) => (
              <Pressable
                key={p}
                onPress={() => removePlatform(p)}
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${p}`}
                style={[styles.platform, { backgroundColor: theme.surface }]}
              >
                <Text style={[styles.platformText, { color: theme.text }]}>{p}</Text>
                <Ionicons name="close-circle" size={16} color={theme.muted} />
              </Pressable>
            ))}
          </View>
          <View style={styles.inlineRow}>
            <TextInput
              value={newPlatform}
              onChangeText={setNewPlatform}
              placeholder="Añadir plataforma (Cabify, Rappi…)"
              placeholderTextColor={theme.muted}
              maxLength={MAX_PLATFORM_LENGTH}
              returnKeyType="done"
              onSubmitEditing={createPlatform}
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
            />
            <TextButton label="Añadir" onPress={createPlatform} />
          </View>
          <Text style={[styles.note, { color: theme.muted }]}>Quitar una plataforma no borra las jornadas que ya registraste.</Text>
        </>
      )}

      {custom.length > 0 && (
        <>
          <SectionTitle>Tus categorías</SectionTitle>
          <Card style={styles.list}>
            {custom.map((c) => (
              <View key={c.id} style={styles.categoryRow}>
                <IconBadge icon={c.icon} color={c.color} size={30} />
                <Text style={[styles.categoryName, { color: theme.text }]}>{c.name}</Text>
                <Text style={[styles.categoryKind, { color: theme.muted }]}>{c.kind === 'income' ? 'Ingreso' : 'Gasto'}</Text>
                <Pressable onPress={() => removeCategory(c.id, c.name)} hitSlop={8} accessibilityLabel={`Eliminar ${c.name}`}>
                  <Ionicons name="trash-outline" size={19} color={theme.danger} />
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Datos</SectionTitle>
      <Pressable onPress={reset} accessibilityRole="button" style={[styles.danger, { borderColor: theme.danger }]}>
        <Ionicons name="trash-outline" size={18} color={theme.danger} />
        <Text style={[styles.dangerText, { color: theme.danger }]}>Borrar todos los datos de Finanzas</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  note: { fontSize: 12.5, lineHeight: 17, marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platform: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  platformText: { fontSize: 14, fontWeight: '600' },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: {
    flex: 1, fontSize: 15, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  list: { paddingVertical: 6, paddingHorizontal: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  categoryName: { flex: 1, fontSize: 15, fontWeight: '700' },
  categoryKind: { fontSize: 12.5 },
  danger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 14, borderWidth: 1,
  },
  dangerText: { fontSize: 15, fontWeight: '700' },
});
