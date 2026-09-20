# Auditoría y plan de implementación responsiva — observatorio-dashboard

Fecha: 2026-09-20. Alcance: `observatorio-dashboard` (Next.js), sitio público (`/`) y panel admin (`/admin/**`).

## 1. Resumen ejecutivo

El dashboard ya está construido con disciplina responsiva: hay una escala de espaciado
(`--s1`…`--s5`), tokens de color con variante oscura completa, `clamp()` usado correctamente en
tipografía sin ningún `100vw` suelto, y las 24 tablas del sitio (9 públicas + 15 de admin) están
todas envueltas en un contenedor con scroll horizontal controlado. No hay overflow horizontal
accidental detectado, ni componentes que dependan de `window.innerWidth` para decidir su layout
(salvo un caso puntual en el mapa de lugares, ver H4).

El trabajo real no es "arreglar una app rota", es cerrar brechas puntuales:

- **La navegación admin no tiene estrategia móvil real** — colapsa a una fila de 11 enlaces con
  wrap, sin agrupar ni colapsar (H1).
- **El sitio público —7 pestañas, la superficie principal del producto— no tiene ninguna prueba
  de overflow ni de accesibilidad**, mientras que admin sí la tiene desde `admin-visual.spec.ts`
  (H2). Esta es la brecha de mayor impacto real.
- **14 breakpoints ad-hoc en `globals.css` + 4 en `admin.css`**, con valores que no convergen
  (640/720/860/900/1180/1280/1600) para problemas equivalentes (H3).
- Un puñado de anchos fijos y posicionamientos absolutos sin ajuste por breakpoint, ya
  identificados con archivo:línea (H4–H5, M1–M6).

No se tocan los 6 componentes `*-explorer.tsx` que no están importados desde ninguna ruta
(`markets-explorer`, `payments-explorer`, `social-explorer`, `territory-explorer`,
`trade-explorer`, y **`places-explorer.tsx`**, encontrado durante la implementación) — no son
alcanzables hoy, así que "arreglar su responsividad" sería trabajo sin efecto observable y un
riesgo de tocar código muerto que podría estar en construcción. Suposición documentada, ver
sección 13. Este último hallazgo importa: dos de los ítems «Medio» de la tabla de la sección 5
(M3 `.map-layout`, M5 `.map-tip` sin acoplar) viven exclusivamente dentro de
`places-explorer.tsx` — es decir, no tienen efecto en la aplicación que de verdad se sirve hoy.
Quedan marcados como tales en la tabla en vez de "arreglados a ciegas".

## 2. Stack detectado

- Next.js 15.5.23, React 19.1.1 / react-dom 19.1.1, App Router, TypeScript 5.9.2 estricto.
- Sin librería UI ni gestor de estado externo; todo `useState` local.
- CSS plano, sin preprocesador ni PostCSS configurado (no hay `postcss.config.*`): dos hojas,
  `src/app/globals.css` (4679 líneas, sitio público + tokens compartidos) y
  `src/app/admin/admin.css` (614 líneas, panel admin, reutiliza los mismos `var(--...)`).
- Gráficos: recharts 3.10.1. Mapas: SVG dibujado a mano (`places-map.tsx`, y el mapa de Bolivia
  usado desde `world-explorer.tsx`/`territory-explorer.tsx`).
- Testing: Playwright 1.56 + `@axe-core/playwright` 4.10. Proyecto único Chromium (+ Firefox solo
  en 2 specs de admin). Sin proyecto de dispositivo móvil declarado en `playwright.config.ts`.
- Lint/format: `next lint`, Prettier (singleQuote, printWidth 100, trailingComma all).

## 3. Inventario de rutas

**Público** (`src/app/page.tsx`, SPA de una sola URL, sin rutas por sección):
`Tabs` → Resumen (`SummaryExplorer`+`MarketCards`) · Tipo de cambio (`FxExplorer`) ·
Macroeconomía (`SubTabs`: `MacroExplorer` + `WorldExplorer`) · Empresas (`FilingExplorer`) ·
Ciudades (`CityPlacesExplorer`, usa `places-map.tsx`) · Prensa (`SubTabs`: `PressExplorer` +
`SubjectsExplorer`) · Método (`SourcesExplorer`).

**Admin** (`src/app/admin/**`, rutas reales de Next): `/admin/login` (público) →
`(private)/layout.tsx` con `AdminShell` → `/admin`, `/traffic`, `/downloads`, `/health`,
`/ingestion` (+ `/ingestion/runs/[id]`), `/quality` (+ `/quality/issues/[id]`), `/metadata`,
`/seeds` (+ `/seeds/runs/[id]`), `/audit`.

## 4. Inventario de componentes críticos

Compartido entre casi todos los exploradores públicos: patrón `.workspace` (`.rail` lateral de
filtros + `.workspace-main`), `.panel`, `.figures` (grid de tarjetas), `.chip`/`.chip-on`. Este
patrón ya centralizado en CSS es la palanca principal: arreglarlo una vez en `globals.css`
corrige la mayoría de las pantallas sin tocarlas una por una.

Componentes de mayor tamaño/complejidad: `charts.tsx` (1953 líneas), `places-map.tsx` (1261,
único con medición de tamaño por JS), `subjects-explorer.tsx` (1087), `world-explorer.tsx` (723),
`macro-analysis-charts.tsx` (851), `macro-explorer.tsx` (976), `fx-explorer.tsx` (749). Ninguno
de estos supera el límite de 300 líneas por una causa relacionada con layout responsivo — son
grandes por lógica de dominio (econometría, transformación de series), no por CSS embebido, así
que no se dividen como parte de este trabajo (dividirlos sería refactor no solicitado, fuera de
alcance).

## 5. Problemas encontrados (con severidad)

| ID | Severidad | Archivo:línea | Problema |
|---|---|---|---|
| H1 | Alto | `src/app/admin/admin.css:44-89` | Nav admin (9 secciones + marca + "volver") colapsa a fila con wrap por debajo de 900px, sin agrupar ni colapsar — varias líneas de enlaces antes del contenido en móvil. |
| H2 | Alto | `tests/e2e/*` | Cero cobertura de overflow/axe/viewport en el sitio público (7 tabs); solo `admin-visual.spec.ts` la tiene, y solo para `/admin/*`. |
| H3 | Alto | `src/app/globals.css` (14 media queries), `admin.css` (4) | Breakpoints ad-hoc sin escala documentada: 640/720/860/900/1180/1280/1600, con valores distintos para el mismo problema general (columna angosta) en `.tile-head` (720) vs `.workspace` (900). |
| H4 | Alto → **descartado con datos reales** | `src/app/globals.css:1066` | Medido con un arnés real en Chromium a 721/750/800/850/899/901/1280px: `.rail` **no** es de 264px entre 721-899px — a esos anchos `.workspace` ya está en columna (la regla es `@media (max-width:900px)`, no un umbral más estrecho como se asumió al escribir este hallazgo) y el `.rail` mide el ancho completo. Por encima de 900px sobran 614px+ para el contenido. Nunca hubo banda de riesgo. Sin cambio. |
| H5 | Alto → **mejorado** | `src/app/globals.css` (`.table-wrap`), `admin.css` (`.admin-scroll`) | Ya usaban scroll horizontal contenido (estrategia válida). Se añadió una sombra de scroll (gradientes CSS, técnica ya usada en `.rail-list-cut` de este mismo archivo) para que el borde indique que hay más columnas, en vez de cortar en seco. Verificado en Chromium: aparece/desaparece correctamente al desplazar; en una tabla que cabe sin desbordar queda un remanente muy sutil en ambos bordes (limitación conocida de la técnica, aceptada por ser casi imperceptible). |
| M1 | Medio → **bug real, corregido** | `src/app/globals.css:958-975` | Verificado con Chromium y el rótulo de sector más largo real del catálogo (`«Monetario y financiero»`, `macro-vocabulary.ts:20`): a 320px el texto corría por debajo de los botones de `.card-tools` (posición absoluta, sin reservar espacio). Corregido con `.card-head:has(.card-toggle) .card-sector { max-width: calc(100% - 6rem) }` — fuerza el ajuste a dos líneas antes de llegar a los botones. Verificado que no afecta las tarjetas sin `.card-toggle` (ej. `city-places-explorer.tsx`), que siguen usando el ancho completo. |
| M2 | Medio → **código muerto, no en producción** | `src/app/globals.css:930-934` (ahora eliminable) | Las clases `.slicer`/`.slicers`/`.slicer-row`/`.slicer-grow` no las usa ningún componente (`grep` confirma cero `className` que las referencie); los controles de año en `macro-explorer.tsx`/`world-explorer.tsx` usan `.rail-field` con `style={{width:'100%'}}` inline, no `.slicer`. Se ajustó igual el ancho de `input[type=range]` (ahora `width:100%; max-width:200px`, cambio inocuo) pero no tiene efecto visible en la app real. No se eliminó el bloque CSS muerto por no ser parte del alcance de una auditoría responsiva — queda señalado para una futura limpieza. |
| M3 | Medio → **sin efecto en producción** | `src/app/globals.css:3283-3292` | `.map-layout` solo se usa en `src/components/places-explorer.tsx`, que no está importado desde ninguna ruta (ver sección 1). No se toca. |
| M4 | Medio → **revisado, ya correcto** | `src/components/places-map.tsx:257-274` | Ya tiene `ResizeObserver` sobre el contenedor **y** un listener de `resize` en `window`, ambos disparando el mismo `measure()`; se recalcula en cada cambio de tamaño, no solo al montar. No requiere cambio. |
| M5 | Medio → **sin efecto en producción** | `src/app/globals.css:3358-3363` | El `.map-tip` sin acoplar vive en `src/components/places-explorer.tsx` (no enrutado). El único `.map-tip` alcanzable es el de `places-map.tsx`, que ya usa `.places-map-docked` en móvil. No se toca. |
| M6 | Medio | `src/app/globals.css:1814,1819,2719,2724-2725` | `!important` puntual por pelea de especificidad — deuda menor, no tocar salvo que el trabajo pase por esas reglas. |
| B1 | Bajo | `src/app/globals.css` (sin tokens) | Sin tokens de z-index: valores sueltos (1, 2, 3, 40) en `.rail-top`, `.heat-head`, `.heat-corner`, `.skip-link`, `.map-tip`, `.admin-modal-backdrop`. |
| B2 | Bajo | `src/app/globals.css:1780-1793` | `.tone-cell` con `flex-basis:148px` — ajustado por debajo de ~320px reales. |
| B3 | Bajo | `src/app/globals.css:2560` y otros | Estados `:disabled` a opacidad 0.4 — verificar contraste WCAG (adyacente a responsivo, no bloqueante). |
| B4 | Bajo | `src/app/globals.css:1918` | `.grid-table` genérico con `min-width:660px` — fuerza scroll leve en móviles muy pequeños, aceptable dado el contenido. |

No encontrado (y por lo tanto no se actúa sobre ello): `100vw` suelto, `<table>` sin wrapper,
overlays/drawers custom fuera de `<dialog>` (donate) y `.admin-modal` (seeds), ni componentes que
dependan de un modelo de dispositivo específico.

## 6. Componentes afectados

`globals.css`, `admin.css`, `admin-shell.tsx` (nav admin), `places-map.tsx` (M4/M5),
`tests/e2e/` (nuevo spec `public-visual.spec.ts` análogo a `admin-visual.spec.ts`). Ningún
componente de dominio (lib/*, lógica de series) se toca.

## 7. Estrategia de solución

- **Sin migrar de sistema de estilos.** Se mantiene CSS plano; no se introduce Tailwind, CSS
  Modules ni un preprocesador — no hay justificación técnica para el cambio y el prompt maestro
  lo prohíbe salvo necesidad real.
- **Breakpoints**: como no hay PostCSS, no se pueden centralizar como `@custom-media` reales.
  Se documenta una escala canónica en un bloque de comentario al inicio de `globals.css` y se
  convergen los breakpoints existentes hacia esos valores donde resuelven el mismo problema,
  sin over-fix: donde 720 vs 860 responden a problemas genuinamente distintos, se documentan
  ambos como válidos.
- **z-index**: tokens `--z-*` en `:root`, reemplazando los valores sueltos citados en B1.
- **Nav admin**: patrón de menú compacto por debajo de 900px (resumen colapsable con estado
  activo siempre visible), reutilizando los tokens existentes — sin añadir una librería.
- **Tests**: extender el patrón ya probado de `admin-visual.spec.ts` (viewports + assert de
  overflow cero + `AxeBuilder`) al sitio público, cubriendo las 7 tabs y las 2 SubTabs anidadas.

## 8. Riesgos de regresión

- Tocar `.rail`/`.workspace` afecta a casi todos los exploradores públicos a la vez: cualquier
  cambio ahí se verifica visualmente en más de una pantalla antes de darlo por bueno.
- El patrón de nav admin nuevo no debe romper `data-testid="admin-session-bar"` ni la detección
  `aria-current` que ya usan `admin-screens.spec.ts` y otros specs de admin.
- `places-map.tsx` es código con comentarios extensos que documentan decisiones de precisión
  numérica (proyección, floats de 32 bits) — cualquier cambio ahí se limita estrictamente al
  cálculo de tamaño (M4), sin tocar la lógica de proyección/zoom.

## 9. Orden de implementación

1. Fundamentos: escala de breakpoints documentada + tokens z-index (H3, B1).
2. Navegación admin móvil (H1).
3. Ajustes puntuales de CSS: `.rail` (H4), `.card-tools` (M1), `.slicer` range (M2), `.map-layout`
   paso intermedio (M3).
4. `places-map.tsx`: confirmar/],corregir recálculo de `window.innerHeight` en resize (M4) y
   paridad de tooltip en el mapa de Bolivia (M5).
5. Test de cobertura pública nueva (H2), reutilizando el spec de admin como base.
6. Verificación: `npm run lint`, `npm run typecheck`, `npm run build` tras cada grupo.

Los ítems B2–B4 se dejan documentados como backlog de bajo impacto si el tiempo no alcanza — se
señala explícitamente si quedan pendientes en el informe final.

## 10. Criterios de aceptación

- Sin overflow horizontal en el sitio público en los mismos viewports que ya cubre
  `admin-visual.spec.ts` (1440×900, 1280×800, 768×1024, 390×844) más 320px.
- Nav admin utilizable y sin ocupar más de ~2 líneas antes del contenido en 390px.
- `npm run lint`, `npm run typecheck` y `npm run build` pasan sin nuevas advertencias.
- Ninguna prueba existente se rompe.
- Nuevo spec público pasa localmente en Chromium (sujeto a disponibilidad de base de datos, ver
  limitaciones).

## 11. Pruebas necesarias

`npm run lint`, `npm run typecheck`, `npm run build` tras cada grupo de cambios. Playwright
(`npx playwright test`) para el spec nuevo y para confirmar que `admin-visual.spec.ts` sigue
pasando — sujeto a que el entorno tenga acceso a una base de datos real (ver limitación conocida
de cuota de Neon en local, documentada en memoria del proyecto); si no hay cuota disponible, se
declara explícitamente en el informe en vez de simular un resultado.

## 12. Decisiones que deben conservarse

- El layout "full bleed con rail docked" (sin columna centrada de ancho fijo) — decisión de
  diseño explícita documentada en el comentario de `.shell` (`globals.css:95-103`).
- Un solo radio (`--radius:10px`) y una sola sombra en todo el sitio.
- El catch-all de `:focus-visible` (línea ~2634) como mecanismo único de foco — no se le agregan
  34 reglas de focus por hover para no fragmentar el patrón ya deliberado, salvo que al tocar un
  selector puntual (H1, M1) se note una pérdida real de contraste de foco.
- `Tabs`/`SubTabs` solo montan el panel activo (no `display:none`) — necesario para que recharts
  mida el contenedor; no se cambia a ocultar por CSS.

## 13. Suposiciones realizadas

- `markets-explorer.tsx`, `payments-explorer.tsx`, `social-explorer.tsx`,
  `territory-explorer.tsx`, `trade-explorer.tsx` no están importados desde ninguna ruta activa —
  se excluyen del trabajo. Si en realidad están pendientes de conectar, señalarlo y se incluyen
  en una siguiente pasada.
- Los hallazgos Bajo (B2–B4) se tratan como backlog opcional, no bloqueante para "terminado".
- No se ejecuta el matrix completo de 2560px/ultra-wide con datos reales de producción; se
  verifica con las herramientas de devtools/CSS disponibles y con los viewports ya cubiertos por
  Playwright.

## 14. Alcance explícitamente NO cubierto en esta pasada

Contraste de estados `:disabled` (B3) y refactor de los 5 componentes huérfanos — quedan
señalados para el informe final como pendientes conocidos, no como "hecho".
