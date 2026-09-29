/**
 * Icono de Android para el modo oscuro.
 *
 * Android no tiene una opción oficial de "icono oscuro" (lo oficial es el icono temático,
 * monochromeImage). Este plugin copia capas adaptativas alternativas a mipmap-night-*,
 * que los launchers que respetan el modo noche usan en lugar de las normales. Si el launcher
 * no lo soporta, simplemente se ve el icono claro.
 *
 * Las imágenes las genera scripts/generate-icons.js en <source>/<densidad>/.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

module.exports = function withAndroidNightIcon(config, { source }) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      for (const density of DENSITIES) {
        const from = path.join(cfg.modRequest.projectRoot, source, density);
        const to = path.join(res, `mipmap-night-${density}`);
        fs.mkdirSync(to, { recursive: true });
        for (const file of fs.readdirSync(from)) {
          fs.copyFileSync(path.join(from, file), path.join(to, file));
        }
      }
      return cfg;
    },
  ]);
};
