import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { DateKey, todayKey } from './dates';

/** Milisegundos hasta la próxima medianoche local (con un segundo de margen). */
function msUntilTomorrow(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 1000;
}

/**
 * El día de hoy, que se actualiza solo: al pasar la medianoche con la app abierta y al volver a
 * la app (los temporizadores no corren mientras está en segundo plano). Así lo que se marca
 * después de las 00:00 va al día nuevo y las rachas y el heatmap no se quedan en el anterior.
 */
export function useToday(): DateKey {
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    const refresh = () => setToday(todayKey());
    const timer = setTimeout(refresh, msUntilTomorrow());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  return today;
}
