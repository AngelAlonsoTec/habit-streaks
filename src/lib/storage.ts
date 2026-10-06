import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/** Caracteres por trozo: muy por debajo de los ~2 MB que Android puede leer de una sola entrada. */
export const CHUNK_SIZE = 400_000;
/** Cabecera de un valor guardado en trozos: "__chunks:3". */
const HEADER = '__chunks:';

const chunkKey = (name: string, i: number) => `${name}#${i}`;

/** Corta en trozos sin partir un emoji (un par sustituto partido se corrompería al guardarlo). */
export function splitChunks(value: string, size: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + size, value.length);
    const last = value.charCodeAt(end - 1);
    if (end < value.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks;
}

/**
 * Almacenamiento de zustand que reparte un valor grande en varias entradas. En Android una
 * entrada de más de ~2 MB no se puede leer (la app arrancaría sin datos), y años de movimientos
 * llegan a eso. Los valores pequeños se guardan tal cual, así que lo ya guardado se sigue leyendo.
 * Cabecera y trozos se escriben juntos (multiSet es atómico) y solo los trozos que cambian:
 * al añadir un movimiento, normalmente el último.
 */
export function chunkedStorage(size = CHUNK_SIZE): StateStorage {
  /** Lo último leído o escrito de cada clave: trozos (o null si se guardó entero). */
  const saved = new Map<string, string[] | null>();

  return {
    getItem: async (name) => {
      const head = await AsyncStorage.getItem(name);
      if (head == null || !head.startsWith(HEADER)) {
        saved.set(name, null);
        return head;
      }
      const count = Number(head.slice(HEADER.length));
      const pairs = await AsyncStorage.multiGet(Array.from({ length: count }, (_, i) => chunkKey(name, i)));
      const chunks = pairs.map(([, v]) => v ?? '');
      saved.set(name, chunks);
      return chunks.join('');
    },

    setItem: async (name, value) => {
      // Se anota antes de esperar: si llega otro cambio mientras se escribe, compara con este
      // (las escrituras se hacen en orden), no con lo de antes.
      const previous = saved.get(name) ?? null;
      if (value.length <= size) {
        saved.set(name, null);
        await AsyncStorage.setItem(name, value);
        if (previous) await AsyncStorage.multiRemove(previous.map((_, i) => chunkKey(name, i)));
        return;
      }
      const chunks = splitChunks(value, size);
      saved.set(name, chunks);
      const changed: [string, string][] = chunks
        .map((c, i): [string, string] => [chunkKey(name, i), c])
        .filter((_, i) => previous?.[i] !== chunks[i]);
      await AsyncStorage.multiSet([...changed, [name, `${HEADER}${chunks.length}`]]);
      // Trozos que sobran si el valor encogió (sin cabecera que los cuente, ya no se leen).
      if (previous && previous.length > chunks.length) {
        await AsyncStorage.multiRemove(previous.slice(chunks.length).map((_, i) => chunkKey(name, chunks.length + i)));
      }
    },

    removeItem: async (name) => {
      const previous = saved.get(name);
      await AsyncStorage.removeItem(name);
      if (previous) await AsyncStorage.multiRemove(previous.map((_, i) => chunkKey(name, i)));
      saved.delete(name);
    },
  };
}
