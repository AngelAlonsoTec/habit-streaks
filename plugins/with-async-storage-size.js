/**
 * Amplía el tamaño máximo de AsyncStorage en Android.
 *
 * Por defecto la base de datos de AsyncStorage no puede pasar de 6 MB entre todas las claves:
 * al llegar ahí, guardar falla. Unos años de movimientos de Finanzas pueden acercarse, así que
 * se sube el tope con la propiedad de Gradle que la librería lee (AsyncStorage_db_size_in_MB).
 */
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'AsyncStorage_db_size_in_MB';

module.exports = function withAsyncStorageSize(config, { sizeMB }) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((item) => !(item.type === 'property' && item.key === KEY));
    cfg.modResults.push({ type: 'property', key: KEY, value: String(sizeMB) });
    return cfg;
  });
};
