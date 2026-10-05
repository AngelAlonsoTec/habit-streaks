import * as Haptics from 'expo-haptics';
import { Href, router } from 'expo-router';
import { Alert, Platform } from 'react-native';

export function tapFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Vibración de "logrado", más marcada que la de un toque (al cumplir un objetivo). */
export function successFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Confirmación que funciona también en web (Alert.alert no tiene botones allí). */
export function confirmAction(title: string, message: string, confirmText: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/** Vuelve atrás o, si se entró por URL directa (web/deep link), navega a `fallback`. */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
