/**
 * Ejecuta todas las pruebas en varias zonas horarias (incluidas algunas con horario de verano),
 * para detectar errores de fechas que solo aparecen fuera de la zona local.
 * Uso: npm run test:tz
 */
const { spawnSync } = require('child_process');

const ZONES = ['America/Mexico_City', 'America/Los_Angeles', 'Europe/Madrid', 'Asia/Tokyo', 'Pacific/Auckland'];

const failed = [];
for (const zone of ZONES) {
  console.log(`\n=== ${zone} ===`);
  const result = spawnSync('npx', ['jest', '--runInBand', '--silent'], {
    env: { ...process.env, TEST_TZ: zone },
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) failed.push(zone);
}

if (failed.length) {
  console.error(`\nFallaron las pruebas en: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\nTodas las pruebas pasan en ${ZONES.length} zonas horarias.`);
