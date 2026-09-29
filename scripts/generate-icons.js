/**
 * Genera todos los iconos de Habit Streaks a partir del SVG de este archivo.
 * Símbolo: una llama con una palomita (check) calada.
 *  - Modo claro: llama blanca sobre degradado naranja.
 *  - Modo oscuro: llama con los colores del fuego sobre fondo oscuro.
 * Uso: npm run icons  → escribe los PNG en assets/ (o en la carpeta indicada como argumento).
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || path.join(__dirname, '..', 'assets');

// ---------- Formas (lienzo de 1000×1000) ----------
const FLAME =
  'M500 70 C515 170 600 235 668 318 C742 408 780 505 768 612 C752 758 640 872 500 880 ' +
  'C360 872 248 758 232 612 C222 520 252 440 300 372 C318 346 340 322 362 300 ' +
  'C356 360 368 420 408 452 C404 330 440 186 500 70 Z';
const CHECK = 'M372 612 L468 704 L646 500';

const DEFS = `
  <defs>
    <linearGradient id="orange" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF9F1C"/><stop offset="1" stop-color="#F2452B"/>
    </linearGradient>
    <linearGradient id="dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#23262E"/><stop offset="1" stop-color="#101318"/>
    </linearGradient>
    <linearGradient id="fire" gradientUnits="userSpaceOnUse" x1="0" y1="880" x2="0" y2="70">
      <stop offset="0" stop-color="#FFB22E"/><stop offset="0.55" stop-color="#FF6A1F"/><stop offset="1" stop-color="#EE3B24"/>
    </linearGradient>
    <mask id="check" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
      <rect width="1000" height="1000" fill="white"/>
      <path d="${CHECK}" fill="none" stroke="black" stroke-width="92" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>`;

const BG = {
  light: '<rect width="1000" height="1000" fill="url(#orange)"/>',
  dark: '<rect width="1000" height="1000" fill="url(#dark)"/>',
  black: '<rect width="1000" height="1000" fill="#000000"/>',
};

/** La llama con la palomita calada, escalada y centrada en el lienzo. */
function glyph(fill, scale) {
  return `<g transform="translate(500 510) scale(${scale}) translate(-500 -475)"><path d="${FLAME}" fill="${fill}" mask="url(#check)"/></g>`;
}

const svg = (...parts) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">${DEFS}${parts.join('')}</svg>`;

async function render(svgText, file, size) {
  const target = path.join(OUT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await sharp(Buffer.from(svgText)).resize(size, size).png({ compressionLevel: 9 }).toFile(target);
  console.log(`${file} (${size}x${size})`);
}

// Escalas: icono a sangre (iOS / icono general) y capa adaptativa de Android (zona segura central).
const FULL = 0.82;
const ADAPTIVE = 0.56;
const WHITE = '#FFFFFF';

(async () => {
  // Icono general y variantes de iOS 18+ (claro, oscuro y tintado; cuadrados y opacos).
  await render(svg(BG.light, glyph(WHITE, FULL)), 'icon.png', 1024);
  await render(svg(BG.dark, glyph('url(#fire)', FULL)), 'ios-icon-dark.png', 1024);
  await render(svg(BG.black, glyph(WHITE, FULL)), 'ios-icon-tinted.png', 1024);

  // Android adaptativo, modo claro.
  await render(svg(glyph(WHITE, ADAPTIVE)), 'android-icon-foreground.png', 512);
  await render(svg(BG.light), 'android-icon-background.png', 512);
  await render(svg(glyph(WHITE, ADAPTIVE)), 'android-icon-monochrome.png', 432);

  // Android adaptativo, modo oscuro: por densidad, lo copia el plugin with-android-night-icon.
  const densities = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
  for (const [density, size] of Object.entries(densities)) {
    await render(svg(glyph('url(#fire)', ADAPTIVE)), `android-night/${density}/ic_launcher_foreground.png`, size);
    await render(svg(BG.dark), `android-night/${density}/ic_launcher_background.png`, size);
  }

  // Pantalla de carga (el color de fondo lo pone app.json), notificación y favicon.
  await render(svg(glyph('url(#fire)', 0.8)), 'splash-icon.png', 1024);
  await render(svg(glyph(WHITE, 0.95)), 'notification-icon.png', 96);
  await render(svg(BG.light, glyph(WHITE, 0.9)), 'favicon.png', 48);
})();
