# Matriz de pruebas responsivas — observatorio-dashboard

## Viewports cubiertos

Los mismos cuatro que ya usaba `admin-visual.spec.ts`, ahora compartidos por
`public-visual.spec.ts`:

| Nombre | Ancho × alto | Categoría |
|---|---|---|
| 390x844 | 390 × 844 | Móvil estándar |
| 768x1024 | 768 × 1024 | Tablet vertical |
| 1280x800 | 1280 × 800 | Laptop |
| 1440x900 | 1440 × 900 | Escritorio |

Más una pasada de **zoom 200 %**, emulada a 720×450 (mitad de 1440×900 en píxeles CSS), en ambos
specs.

No se añadió un proyecto de dispositivo táctil (`devices['iPhone...']`) en `playwright.config.ts`
porque ninguna interacción del sitio depende de eventos táctiles distintos de click/tap — los
controles son botones y enlaces estándar. Si en el futuro se agrega un gesto táctil real (arrastre
en el mapa, por ejemplo), ahí sí se justifica un proyecto dedicado.

## Qué verifica cada spec

### `tests/e2e/admin-visual.spec.ts` (existente, extendido)

- UI-02, por cada viewport: recorre las 9 pantallas admin, aserta overflow horizontal ≤1px,
  guarda captura `fullPage`.
- UI-02: zoom 200 % en las 9 pantallas.
- UI-03: `AxeBuilder` (`wcag2a`, `wcag2aa`) en las 9 pantallas, falla si hay violación
  crítica/seria.
- UI-03: los badges de estado (`.state`) nunca dependen solo de color (`data-mark` con símbolo).
- **Nuevo**: el menú de secciones colapsa en 390×844, expone las 9 secciones al abrirse, no
  produce overflow ni abierto ni cerrado, y se cierra solo al seguir un enlace.

### `tests/e2e/public-visual.spec.ts` (nuevo)

- UI-02, por cada viewport: recorre las 7 pestañas públicas (incluidas las 2+2 sub-pestañas de
  Macroeconomía y Prensa), aserta overflow horizontal ≤1px, guarda captura por pestaña.
- UI-02: zoom 200 % en las 7 pestañas.
- UI-03: `AxeBuilder` en las 7 pestañas, mismo criterio que admin.

### Cobertura que ya existía y no se tocó

- `tests/diagnostics/axe-report.spec.ts` — diagnóstico impreso (no falla el build), 4 rutas admin.
  Se deja como está: es una herramienta de inspección, no un gate.
- `tests/e2e/admin-screens.spec.ts`, `admin-auth.spec.ts`, `admin-seeds.spec.ts`,
  `admin-traffic.spec.ts`, `admin-exports.spec.ts` — funcionales, sin relación directa con
  layout; no requerían cambios para este trabajo.

## Verificación visual real realizada (2026-09-20, segunda pasada)

El MCP de Playwright y la extensión de Chrome no estaban disponibles esta sesión (ver informe de
implementación), pero el paquete `playwright-core` ya instalado en `node_modules` sí lo está —
se usó directamente con pequeños scripts Node (`chromium.launch()`), cargando arneses HTML
estáticos que enlazan los CSS reales del proyecto (`globals.css`, `admin.css`) por `file://`, sin
depender de la base de datos. Esto permitió una verificación visual real, con capturas
inspeccionadas una a una, de todo lo que se cambió:

- **Menú admin colapsable**: 390px cerrado y abierto, 850px, 1280px — overflow 0 en los cuatro,
  el escritorio idéntico al original (`display:contents` confirmado), el móvil expone las 9
  secciones sin overflow.
- **`.rail`/`.workspace` (H4)**: medido en Chromium en 721/750/800/850/899/901/1280px con
  contenido realista (nombre de municipio largo, tabla de 9 columnas) — nunca hay overflow y el
  `.rail` nunca es de 264px por debajo de 900px (ver hallazgo H4 corregido en el plan).
  Descartado con datos, no con teoría.
- **`.card-tools`/`.card-sector` (M1)**: encontrado un solapamiento real con el rótulo de sector
  más largo del catálogo a 320px, corregido, y reverificado en 320/360/390/430px — sin
  solapamiento tras el fix, y sin efecto sobre tarjetas que no tienen `.card-toggle`.
- **Sombra de scroll en tablas (H5)**: verificada en Chromium a 390px, antes y después de
  desplazar — aparece y desaparece en el borde correcto.

## Estado de ejecución real (2026-09-20)

`npx playwright test --list` confirma que los 15 tests de ambos specs (`admin-visual.spec.ts` +
`public-visual.spec.ts`) se descubren y parsean correctamente — 6 nuevos entre ambos archivos.

La ejecución real contra un servidor vivo **no pudo completarse con datos reales**: la base de
Neon usada en local tiene la cuota de transferencia agotada (error `53000`, confirmado por
consola del servidor — el mismo problema ya registrado en la memoria del proyecto). Se verificó
en cambio que el arnés en sí está bien conectado: corriendo
`npx playwright test tests/e2e/public-visual.spec.ts -g "1440x900"` contra el servidor real, el
test falla exactamente donde debe — esperando el `tablist` que no aparece porque la página cae al
estado `<Unreadable/>` (captura de pantalla adjunta al fallo lo confirma) — y no por un selector
roto o un error de sintaxis. Es la falla correcta por la razón externa correcta, no una falla del
test.

**Esta sesión no pudo producir una corrida en verde de ninguno de los dos specs contra la base de
datos real**, ni antes ni después de los cambios de esta pasada — es una limitación preexistente
del entorno, no algo introducido aquí. Queda pendiente correr `npx playwright test` completo en
cuanto la cuota de Neon se restablezca; en ese momento el spec nuevo debería pasar sin cambios
adicionales salvo que revele algo que esta auditoría no pudo ver sin datos reales.

## Verificación que sí se completó esta sesión

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | ✅ sin errores, en cada grupo de cambios |
| `npm run build` | ✅ compila, genera las 26 rutas, sin advertencias nuevas |
| `npm run lint` | ✅ configurado esta sesión (no existía) y corre limpio: 0 errores, 12 warnings preexistentes de imports sin usar, ninguno introducido por este trabajo |
| `npx playwright test --list` | ✅ 15 tests descubiertos en los 2 specs de UI-02/UI-03 |
| 1 test de `public-visual.spec.ts` contra servidor real | ⚠️ falla por cuota de Neon agotada, no por el test — reconfirmado al final de la sesión, sigue agotada |
| Verificación visual en navegador | ✅ realizada vía `playwright-core` scripteado directamente (ver sección anterior) — MCP de Playwright y extensión de Chrome sí siguieron sin conectar |

## Matriz de dispositivos/condiciones del prompt maestro — cobertura real

| Condición pedida | Cubierta por | Nota |
|---|---|---|
| 320–2560px | Parcial | Los specs cubren 390/768/1280/1440px. 320, 360, 430, 1024, 1920, 2560 no tienen aserción automatizada — CSS revisado manualmente para esos anchos (`clamp()`, `max-width:100%`, sin `100vw`), no verificado en navegador real. |
| Orientación horizontal/vertical | No automatizado | El spec no rota viewport; revisar manualmente si se retoma este trabajo. |
| Zoom 200% | ✅ | Ambos specs. |
| Fuentes aumentadas | No automatizado | Fuera de alcance de esta pasada. |
| Textos largos/datos reales | Parcial | Los datos son reales (sin mocks, por convención explícita del proyecto en `playwright.config.ts`), pero no corrieron por la cuota agotada. |
| Datos vacíos | Ya cubierto por la app | `page.tsx` ya maneja secciones vacías con `callout`; no se tocó. |
| Teclado virtual / notch | No automatizado | Fuera de alcance de esta pasada. |
