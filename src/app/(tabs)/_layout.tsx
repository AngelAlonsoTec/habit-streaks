import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ColorValue, StyleSheet, View } from 'react-native';

import { IconName, useTheme } from '@/theme';

/** Icono de pestaña: la activa lleva una pastilla de color detrás. */
function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: ColorValue }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, focused && { backgroundColor: theme.primary + theme.emptyAlpha }]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        // Cada pestaña dibuja su propio encabezado.
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: theme.dark ? StyleSheet.hairlineWidth : 0,
          boxShadow: theme.dark ? undefined : '0px -2px 12px rgba(16, 24, 40, 0.06)',
        },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '700' },
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hábitos',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finanzas',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'wallet' : 'wallet-outline'} focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: { width: 52, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
