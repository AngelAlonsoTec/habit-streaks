import * as Haptics from 'expo-haptics';
import { Href, router } from 'expo-router';
import { Alert, Keyboard, Platform, TextInput } from 'react-native';

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

/**
 * Suelta el campo que tenga el foco y cierra el teclado. Hay que hacerlo antes de cerrar una
 * pantalla o un panel: en Android, si un campo enfocado dentro de un ScrollView desaparece con el
 * teclado abierto, la app se cierra ("parameter must be a descendant of this view").
 */
export function releaseFocus() {
  // En web no existe currentlyFocusedInput (ahí basta con Keyboard.dismiss, que quita el foco).
  TextInput.State?.currentlyFocusedInput?.()?.blur?.();
  Keyboard.dismiss();
}

/** Vuelve atrás o, si se entró por URL directa (web/deep link), navega a `fallback`. */
export function goBack(fallback: Href = '/') {
  releaseFocus();
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
