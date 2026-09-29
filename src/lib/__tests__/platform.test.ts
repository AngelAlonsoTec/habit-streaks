import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert, AlertButton, Platform } from 'react-native';

import { confirmAction, goBack, tapFeedback } from '../platform';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

/** Simula que el usuario pulsa el botón `index` del Alert nativo. */
function pressAlertButton(index: number) {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.[index].onPress?.();
  });
}

describe('confirmAction', () => {
  it('en el móvil resuelve true al confirmar', async () => {
    pressAlertButton(1);
    await expect(confirmAction('Eliminar', '¿Seguro?', 'Eliminar')).resolves.toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Eliminar',
      '¿Seguro?',
      [expect.objectContaining({ text: 'Cancelar' }), expect.objectContaining({ text: 'Eliminar', style: 'destructive' })],
      expect.objectContaining({ cancelable: true }),
    );
  });

  it('en el móvil resuelve false al cancelar', async () => {
    pressAlertButton(0);
    await expect(confirmAction('Eliminar', '¿Seguro?', 'Eliminar')).resolves.toBe(false);
  });

  it('en el móvil resuelve false si se cierra tocando fuera', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, _b, options) => options?.onDismiss?.());
    await expect(confirmAction('Eliminar', '¿Seguro?', 'Eliminar')).resolves.toBe(false);
  });

  it('en web usa window.confirm', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const confirm = jest.fn(() => true);
    Object.defineProperty(globalThis, 'window', { value: { confirm }, configurable: true });
    await expect(confirmAction('Eliminar', '¿Seguro?', 'Eliminar')).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith('Eliminar\n\n¿Seguro?');
  });
});

describe('tapFeedback', () => {
  it('vibra en el móvil', () => {
    tapFeedback();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('no hace nada en web', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    tapFeedback();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('ignora errores del módulo de vibración', async () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('sin motor de vibración'));
    expect(() => tapFeedback()).not.toThrow();
    await Promise.resolve();
  });
});

describe('goBack', () => {
  it('vuelve atrás si hay historial', () => {
    (router.canGoBack as jest.Mock).mockReturnValue(true);
    goBack();
    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sin historial (URL directa) navega a la ruta de respaldo', () => {
    (router.canGoBack as jest.Mock).mockReturnValue(false);
    goBack({ pathname: '/habit/[id]', params: { id: 'h1' } });
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/habit/[id]', params: { id: 'h1' } });
  });

  it('la ruta de respaldo por defecto es la pantalla principal', () => {
    (router.canGoBack as jest.Mock).mockReturnValue(false);
    goBack();
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
