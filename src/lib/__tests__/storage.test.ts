import AsyncStorage from '@react-native-async-storage/async-storage';

import { chunkedStorage, splitChunks } from '../storage';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('splitChunks', () => {
  it('no parte un emoji entre dos trozos', () => {
    const value = `${'a'.repeat(9)}😀b`;
    const chunks = splitChunks(value, 10);
    expect(chunks.join('')).toBe(value);
    expect(chunks[0]).toBe('a'.repeat(9));
    for (const c of chunks) expect(/[\uD800-\uDBFF]$/.test(c)).toBe(false);
  });
});

describe('chunkedStorage', () => {
  it('lo pequeño se guarda tal cual (los datos de antes se siguen leyendo)', async () => {
    await AsyncStorage.setItem('store', '{"antiguo":true}');
    const storage = chunkedStorage(10);
    expect(await storage.getItem('store')).toBe('{"antiguo":true}');
    await storage.setItem('store', 'corto');
    expect(await AsyncStorage.getItem('store')).toBe('corto');
  });

  it('lo grande va en trozos y se lee igual desde cero (como al abrir la app)', async () => {
    const value = 'x'.repeat(25) + 'ñandú 😀 fin';
    await chunkedStorage(10).setItem('store', value);
    expect(await AsyncStorage.getItem('store')).toBe('__chunks:4');
    expect(await chunkedStorage(10).getItem('store')).toBe(value);
  });

  it('al añadir algo al final solo reescribe el último trozo', async () => {
    const storage = chunkedStorage(10);
    await storage.setItem('store', 'a'.repeat(30));
    const multiSet = jest.spyOn(AsyncStorage, 'multiSet');
    await storage.setItem('store', `${'a'.repeat(30)}b`);
    expect(multiSet).toHaveBeenCalledWith([['store#3', 'b'], ['store', '__chunks:4']]);
  });

  it('si encoge, borra los trozos que sobran; si vuelve a caber, guarda entero', async () => {
    const storage = chunkedStorage(10);
    await storage.setItem('store', 'a'.repeat(35));
    await storage.setItem('store', 'b'.repeat(15));
    expect(await AsyncStorage.getAllKeys()).toEqual(expect.arrayContaining(['store', 'store#0', 'store#1']));
    expect(await AsyncStorage.getItem('store#2')).toBeNull();
    await storage.setItem('store', 'c');
    expect(await AsyncStorage.getAllKeys()).toEqual(['store']);
    expect(await chunkedStorage(10).getItem('store')).toBe('c');
  });

  it('dos cambios seguidos sin esperar: queda el último', async () => {
    const storage = chunkedStorage(10);
    await storage.setItem('store', 'a'.repeat(30));
    const first = storage.setItem('store', `${'a'.repeat(30)}b`);
    const second = storage.setItem('store', 'a'.repeat(30));
    await Promise.all([first, second]);
    expect(await chunkedStorage(10).getItem('store')).toBe('a'.repeat(30));
  });

  it('borrar quita cabecera y trozos', async () => {
    const storage = chunkedStorage(10);
    await storage.setItem('store', 'a'.repeat(30));
    await storage.removeItem('store');
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});
