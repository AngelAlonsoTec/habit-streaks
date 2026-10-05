import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { ReminderSync } from '@/components/ReminderSync';
import { REMINDERS_SUPPORTED } from '@/lib/notifications';
import { useHabits } from '@/store/habits';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const theme = useTheme();
  const hasHydrated = useHabits((s) => s.hasHydrated);

  if (!hasHydrated) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

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
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Hoy', headerShown: false }} />
        <Stack.Screen name="habit/new" options={{ title: 'Nuevo hábito', presentation: 'modal' }} />
        <Stack.Screen name="habit/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="habit/[id]/edit" options={{ title: 'Editar hábito', presentation: 'modal' }} />
        <Stack.Screen name="summary" options={{ title: 'Resumen' }} />
      </Stack>
    </>
  );
}
