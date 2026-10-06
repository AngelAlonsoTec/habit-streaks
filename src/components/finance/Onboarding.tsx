import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconBadge, PrimaryButton } from '@/components/finance/ui';
import { Chip, SectionTitle } from '@/components/ui';
import { Profile, PROFILES } from '@/lib/finance';
import { CURRENCIES, CurrencyCode } from '@/lib/money';
import { useFinance } from '@/store/finance';
import { useTheme } from '@/theme';

/** Tarjetas para elegir uno o varios perfiles. */
export function ProfileOptions({ selected, onToggle }: { selected: Profile[]; onToggle: (p: Profile) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.options}>
      {PROFILES.map((p) => {
        const on = selected.includes(p.id);
        return (
          <Pressable
            key={p.id}
            onPress={() => onToggle(p.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={p.label}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: theme.card, borderColor: on ? theme.primary : theme.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <IconBadge icon={p.icon} color={on ? theme.primary : theme.muted} size={42} />
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: theme.text }]}>{p.label}</Text>
              <Text style={[styles.optionDescription, { color: theme.muted }]}>{p.description}</Text>
            </View>
            <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? theme.primary : theme.border} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function CurrencyOptions({ value, onChange }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  return (
    <View style={styles.wrap}>
      {CURRENCIES.map((c) => (
        <Chip key={c.code} label={`${c.label} (${c.code})`} selected={value === c.code} onPress={() => onChange(c.code)} />
      ))}
    </View>
  );
}

/** Primera vez en Finanzas: perfil(es) y moneda. */
export function FinanceOnboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const setProfiles = useFinance((s) => s.setProfiles);
  const setCurrency = useFinance((s) => s.setCurrency);
  const [profiles, setSelected] = useState<Profile[]>([]);
  const storedCurrency = useFinance((s) => s.currency);
  const [currency, setLocalCurrency] = useState(storedCurrency);

  const toggle = (p: Profile) => setSelected((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]));

  const start = () => {
    setCurrency(currency);
    setProfiles(profiles);
  };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
      <Ionicons name="wallet" size={52} color={theme.primary} />
      <Text style={[styles.title, { color: theme.text }]}>Tus finanzas, claras</Text>
      <Text style={[styles.text, { color: theme.muted }]}>
        Apunta lo que ganas y lo que gastas, pon presupuestos y ahorra para lo que quieres. ¿Cómo lo vas a usar? Puedes
        elegir varias opciones.
      </Text>

      <ProfileOptions selected={profiles} onToggle={toggle} />

      <SectionTitle>Moneda</SectionTitle>
      <CurrencyOptions value={currency} onChange={setLocalCurrency} />

      <View style={styles.footer}>
        <PrimaryButton label="Empezar" color={theme.primary} onPress={start} disabled={!profiles.length} />
        <Text style={[styles.hint, { color: theme.muted }]}>Podrás cambiarlo cuando quieras en los ajustes de Finanzas.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, gap: 10 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 6 },
  text: { fontSize: 15, lineHeight: 21, marginBottom: 8 },
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18, borderWidth: 2 },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: '800' },
  optionDescription: { fontSize: 13, lineHeight: 18 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { gap: 10, marginTop: 20 },
  hint: { fontSize: 12.5, textAlign: 'center' },
});
