import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { ReminderSync } from '@/components/ReminderSync';
import { REMINDERS_SUPPORTED } from '@/lib/notifications';
import { useFinance } from '@/store/finance';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const theme = useTheme();
  const habitsReady = useHabits((s) => s.hasHydrated);
  const financeReady = useFinance((s) => s.hasHydrated);

  if (!habitsReady || !financeReady) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {REMINDERS_SUPPORTED && <ReminderSync />}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: theme.bg },
          // Solo la flecha: el título de la pestaña de origen (Hábitos o Finanzas) no aporta.
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ title: 'Inicio', headerShown: false }} />
        <Stack.Screen name="habit/new" options={{ title: 'Nuevo hábito', presentation: 'modal' }} />
        <Stack.Screen name="habit/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="habit/[id]/edit" options={{ title: 'Editar hábito', presentation: 'modal' }} />
        <Stack.Screen name="summary" options={{ title: 'Resumen' }} />
        <Stack.Screen name="finance/entry" options={{ title: 'Nuevo movimiento', presentation: 'modal' }} />
        <Stack.Screen name="finance/settings" options={{ title: 'Ajustes de Finanzas' }} />
      </Stack>
    </>
  );
}
