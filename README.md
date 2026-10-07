<p align="center">
  <img src="assets/icon.png" alt="Habit Streaks" width="120" />
</p>

<h1 align="center">Habit Streaks</h1>

<p align="center">
  Registra tus hábitos día a día y mira cómo se llena tu gráfica al estilo GitHub. Y lleva tus cuentas en el mismo sitio.
</p>

---

## Qué es

**Habit Streaks** es una app móvil de hábitos para Android, iOS y web. Cada hábito tiene su propio *heatmap* tipo GitHub: cada cuadrito es un día y su color muestra cuánto lo cumpliste. Incluye una pestaña de **Finanzas** para llevar ingresos y gastos. Los datos se guardan en el teléfono (sin cuenta ni conexión), y el modelo está preparado para añadir sincronización en la nube más adelante.

### Hábitos

- **Heatmap por hábito**: un bloque por mes con su nombre, e intensidad según el progreso del día.
- **Metas flexibles**: una o varias veces al día (por ejemplo, 8 vasos de agua), días concretos de la semana o *N* veces por semana.
- **Hábitos cuantitativos**: minutos, km, pasos, páginas o una unidad propia, con sumas rápidas y cantidades exactas (admite decimales).
- **Generar o dejar un hábito**: al dejarlo, la meta es un límite diario o semanal (0 = dejarlo del todo); solo se registran las recaídas y los días que se pasan del límite se marcan en rojo.
- **Objetivos**: hitos opcionales por hábito (por ejemplo, «Alcanzar el A1»), con fecha límite y sugerencias según el hábito.
- **Rachas inteligentes**: respetan los días de descanso del hábito; las metas semanales cuentan la racha en semanas.
- **Pantalla Hoy**: los últimos 7 días para registrar días pasados, progreso del día, filtro por categoría y hábitos agrupados en mañana, tarde, noche o cualquier momento.
- **Asistente de creación** en 4 pasos, con plantillas, 15 categorías predefinidas y categorías propias.
- **Recordatorios** con una o varias horas que no avisan si ya cumpliste el hábito ese día.
- **Detalle del hábito**: estadísticas, calendario mensual editable y gráfica de tus mejores días de la semana.
- Menú con pulsación larga, vista compacta y modo claro/oscuro automático (incluido el icono de la app).

### Finanzas

- **Perfiles**: trabajador, estudiante o conductor de app (se pueden combinar); cada uno trae sus categorías.
- **Movimientos**: ingresos y gastos por categoría, con fecha, nota y categorías propias. Los importes se escriben como se quiera (`$1,250.50`, `1.250,50`…) y se muestran en la moneda elegida (peso mexicano por defecto).
- **Balance por semana o por mes**, con comparación con el periodo anterior, gastos e ingresos por categoría y lista de movimientos por día.
- **Conductor de app**: una jornada puede tener varias plataformas a la vez (Uber, DiDi, inDrive o las que añadas), con lo que dejó cada una, sus viajes y las horas totales contadas una sola vez; ganancia bruta y neta por hora y por viaje, descontando los gastos del auto.
- **Gasolina**: cada carga guarda litros y kilometraje; calcula el precio por litro, el rendimiento (km/l: exacto entre dos cargas de tanque lleno, o aproximado si siempre cargas una cantidad fija) y el costo por km, y avisa si el kilometraje parece mal escrito.
- **Se escribe como se habla**: horas como `8:30` u `8h`, `45,230 km`, `30 lts`, `17 viajes`; si algo no se entiende, avisa en vez de ignorarlo. Las categorías más usadas salen primero.
- **Presupuestos mensuales** por categoría: avisan desde el 80 % (incluso antes de guardar un gasto) y sugieren tu promedio de los meses anteriores.
- **Jornadas por cobrar**: lo de las apps que pagan por semana (Uber, los lunes; el día de cada app se elige en Ajustes) no cuenta en el balance hasta que llega: se ve aparte, «+$1,450 por cobrar», y se suma solo ese día o cuando marcas «Ya me pagaron». Lo que se cobra en efectivo cuenta al momento.
- **Gastos e ingresos fijos** (renta, Netflix, internet, sueldo quincenal, mesada, luz, beca…): semanales, quincenales (15 y fin de mes), mensuales o bimestrales, desde la fecha que elijas; se apuntan solos el día que tocan, aunque la app lleve tiempo sin abrirse. Pueden durar un número de pagos (4 meses, 2 quincenas): dicen qué pago va, cuánto falta y cuándo terminan, y se pueden liquidar de una vez.
- **Abonos**: fijos con fecha fija pero importe distinto cada vez (un préstamo, Coppel, Elektra). No se apuntan solos: en su fecha avisa «Toca abonar», apuntas cuánto abonaste (o «esta vez no abono») y lleva lo que debes hasta liquidarlo.
- **Dejar de pagar**: «Ya no lo pago» termina un fijo (una suscripción que cancelaste) eligiendo su último cobro: lo pagado se queda, lo que se apuntó solo después se quita y lo sigues viendo en «Terminados», de donde se puede retomar.
- **Lo que viene**: el Resumen dice cómo cierras el mes si todo sigue igual (lo que falta por entrar, tus fijos, mensualidades y abonos pendientes y lo que gastas al día), cuánto debes y cuándo terminas, lo que piden tus fijos y deudas los próximos 6 meses y qué parte de lo que ganas se llevan.
- **Créditos y compras a meses**: cada tarjeta o crédito de tienda con su día de pago y sus compras (a 3, 6, 12 meses…, o ya empezadas). El pago de cada mes es la suma de lo que toca de cada compra, así que cambia cuando una termina; dice cuánto debes y cuándo terminas.
- **Suscripciones**: Netflix, HBO Max, Disney+, Spotify y otras se eligen de un toque (o se reconocen al escribir su nombre) y salen con su inicial y su color. El Resumen dice cuánto se llevan los gastos fijos este mes (lo ya cobrado y lo que falta), qué se cobra primero y cuánto cuestan las suscripciones al año.
- **Metas de ahorro** con fecha opcional: cuánto apartar al mes o a la semana para llegar a tiempo, abonos y retiros.

## Tecnologías

| Área | Tecnología |
|---|---|
| Framework | [Expo](https://expo.dev) SDK 57 · React Native 0.86 · React 19.2 |
| Lenguaje | TypeScript 6 |
| Navegación | Expo Router 57 (rutas por archivos en `src/app/`) |
| Estado y datos | Zustand 5 + AsyncStorage (persistencia local con migraciones) |
| Gráficos | react-native-svg (heatmaps y anillos de progreso) |
| Nativo | expo-notifications, expo-haptics, expo-splash-screen, expo-system-ui |
| Web | react-native-web |
| Calidad | Jest 29 + jest-expo + Testing Library (React Native), ESLint 9 (eslint-config-expo) |
| Iconos | Script propio con [sharp](https://sharp.pixelplumbing.com/) que genera todos los PNG desde un SVG |

## Requisitos

- **Node.js** en versión LTS (probado con Node 24) y **npm**.
- **Git**.
- Para probar en el teléfono: la app **Expo Go** ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) · [iOS](https://apps.apple.com/app/expo-go/id982107779)) en su versión para SDK 57, con el teléfono en la misma red Wi-Fi que el ordenador.

## Instalación y uso por sistema operativo

Los comandos de la app son los mismos en todos los sistemas; lo que cambia es cómo instalar las herramientas y qué emuladores puedes usar.

### Windows

1. Instala Node.js LTS y Git (por ejemplo, con `winget`):
   ```powershell
   winget install OpenJS.NodeJS.LTS
   winget install Git.Git
   ```
2. Clona el proyecto e instala las dependencias:
   ```powershell
   git clone <URL-del-repositorio> habit-streaks
   cd habit-streaks
   npm install
   ```
3. Arranca el servidor de desarrollo:
   ```powershell
   npx expo start
   ```
   - **Android (teléfono)**: escanea el código QR con Expo Go.
   - **Android (emulador)**: instala [Android Studio](https://developer.android.com/studio), crea un dispositivo virtual y pulsa `a` en la terminal.
   - **Web**: pulsa `w`.
   - **iOS**: solo en un iPhone físico con Expo Go (escanea el QR con la cámara). El simulador de iOS no está disponible en Windows.

### macOS

1. Instala Node.js LTS y Git (por ejemplo, con [Homebrew](https://brew.sh)):
   ```bash
   brew install node git
   ```
2. Clona el proyecto e instala las dependencias:
   ```bash
   git clone <URL-del-repositorio> habit-streaks
   cd habit-streaks
   npm install
   ```
3. Arranca el servidor de desarrollo:
   ```bash
   npx expo start
   ```
   - **iOS (simulador)**: instala Xcode desde la App Store, ábrelo una vez para aceptar la licencia y pulsa `i` en la terminal.
   - **iOS / Android (teléfono)**: escanea el código QR con Expo Go (en iPhone, con la cámara).
   - **Android (emulador)**: instala Android Studio, crea un dispositivo virtual y pulsa `a`.
   - **Web**: pulsa `w`.

### Linux

1. Instala Node.js LTS y Git. Con [nvm](https://github.com/nvm-sh/nvm) (válido para cualquier distribución):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
   # Abre una terminal nueva y después:
   nvm install --lts
   sudo apt install git   # o el gestor de paquetes de tu distribución
   ```
2. Clona el proyecto e instala las dependencias:
   ```bash
   git clone <URL-del-repositorio> habit-streaks
   cd habit-streaks
   npm install
   ```
3. Arranca el servidor de desarrollo:
   ```bash
   npx expo start
   ```
   - **Android (teléfono)**: escanea el código QR con Expo Go.
   - **Android (emulador)**: instala Android Studio (el emulador necesita KVM activado), crea un dispositivo virtual y pulsa `a`.
   - **Web**: pulsa `w`.
   - **iOS**: solo en un iPhone físico con Expo Go. El simulador de iOS no está disponible en Linux.

> **Si el teléfono no conecta con el servidor** (redes con aislamiento de clientes, VPN, etc.), usa el modo túnel: `npx expo start --tunnel`.
>
> **Si ves errores raros tras actualizar el proyecto**, limpia la caché de Metro: `npx expo start -c`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Arranca el servidor de desarrollo de Expo |
| `npm run android` / `npm run ios` / `npm run web` | Arranca y abre directamente en el emulador de Android, el simulador de iOS (solo macOS) o el navegador |
| `npm test` | Ejecuta las pruebas (Jest) |
| `npm run test:tz` | Ejecuta las pruebas en varias zonas horarias (México, Los Ángeles, Madrid, Tokio y Auckland), incluidas las simulaciones del día a día de Finanzas (`src/__tests__/finance-daily.test.tsx` y cuatro meses de uso en `src/testing/financeDemo.ts`) |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm run lint` | Pasa ESLint |
| `npm run icons` | Regenera todos los iconos de `assets/` desde el SVG de `scripts/generate-icons.js` |

## Limitaciones de Expo Go

Expo Go sirve para desarrollar rápido, pero no es la app final:

- **Recordatorios**: no funcionan en Expo Go para Android, que no admite `expo-notifications` desde el SDK 53. La app lo detecta: los recordatorios se guardan y sonarán en la app instalada.
- **Icono y pantalla de carga**: Expo Go muestra los suyos; los de Habit Streaks solo se ven en la app instalada.


Para probar todo como en producción, genera la app con [EAS Build](https://docs.expo.dev/build/introduction/). Compila en la nube, así que funciona desde cualquier sistema operativo sin instalar Android Studio ni Xcode (necesitas una cuenta gratuita de Expo):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview      # APK para instalar en tu teléfono
npx eas-cli@latest build --platform android --profile production   # AAB para publicar en Google Play
```

Los perfiles están definidos en `eas.json`.

## Estructura del proyecto

```
src/
├── app/            Pantallas (Expo Router): pestañas Hábitos y Finanzas, detalle, formularios, resumen
├── components/     Heatmap, tarjetas, asistente de creación, calendario; finance/ para Finanzas
├── lib/            Lógica pura: fechas, reglas de hábitos, estadísticas, recordatorios, dinero y finanzas
├── store/          Estado global y persistencia (Zustand + AsyncStorage)
├── theme/          Colores, modo claro/oscuro, iconos y paleta de hábitos
└── testing/        Datos de ejemplo para las pruebas
plugins/            Config plugins de Expo (icono oscuro de Android, tamaño de AsyncStorage)
scripts/            Generador de iconos
assets/             Iconos, pantalla de carga y favicon
```

Las carpetas nativas `android/` e `ios/` no se versionan: Expo las genera a partir de `app.json` y de los config plugins (`npx expo prebuild`).

## Licencia

© 2026 AngelAlonsoTec. **Todos los derechos reservados.** Que el código sea público no da permiso para copiarlo, modificarlo ni publicarlo (tampoco en Google Play o App Store). Consulta [LICENSE](LICENSE).
