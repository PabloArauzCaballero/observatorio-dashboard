# Hallazgos — fase 01 (auditoría y priorización)

> Alcance: zona **pública** (`/` y sus explorers). `/admin` queda fuera de este alcance por decisión
> del usuario (ver `PLAN_SITUADO.md`), salvo mención puntual cuando es relevante para un hallazgo.
> Sin datos reales (cuota de Neon agotada) ni navegadores Playwright instalados en este entorno — ver
> sección "No verificado" al final. Todo lo listado aquí se comprobó leyendo el código real, no por
> suposición.

## Corrección al inventario de fase 00 (impacta la elección del piloto de fase 06)

**INVENTARIO.md afirma** que los ~13-14 "explorers" comparten `pager.tsx` y `tabs.tsx` como base común.
Verificado con `grep` de imports reales:

- Importan `pager.tsx`: `city-places-explorer.tsx`, `macro-explorer.tsx`, `sources-explorer.tsx`,
  `world-explorer.tsx` — **4 de 15**.
- Importan `tabs.tsx` directamente: `trade-explorer.tsx` — **1 de 15**.
- `places-explorer.tsx`, `press-explorer.tsx`, `markets-explorer.tsx` y el resto **no** importan
  ninguno de los dos; cada uno implementa su propia estructura (mapa + tabla con `tabIndex`/`onKeyDown`
  propios en `places-explorer`, un "cubo" de prensa con su propio filtro en `press-explorer`, etc.).
- El patrón `Tabs`/`SubTabs` que sí es universal está en `src/app/page.tsx` (selector de secciones de
  nivel superior: Resumen, Tipo de cambio, Macroeconomía…), no dentro de cada explorer.

**Impacto:** la premisa de `PLAN_SITUADO.md` ("tocar `pager.tsx`/`tabs.tsx` beneficia a ~13
componentes de una vez") no se sostiene tal como está escrita. Tocar `pager.tsx` beneficia con
certeza a 4 componentes; tocar `tabs.tsx` beneficia directamente a la navegación de `page.tsx` (que
usan todos los visitantes) y a `trade-explorer`. Esto no invalida el piloto, pero cambia qué se
espera de él — ver F01.5 más abajo.

## Hallazgos priorizados

### H01 — Tabs/SubTabs no siguen el patrón de teclado esperado para `role="tablist"`
- **Dónde:** `src/components/tabs.tsx` (`Tabs` y `SubTabs`), usado en `src/app/page.tsx` para las
  secciones principales del informe (Resumen, Tipo de cambio, Macroeconomía, Mercados, etc.) y dentro
  de `trade-explorer.tsx`.
- **Reproducción:** leer el componente. Cada botón tiene `role="tab"` y `aria-selected`, pero no hay
  manejo de `ArrowLeft`/`ArrowRight`/`Home`/`End` entre pestañas (patrón esperado por WAI-ARIA APG
  para `tablist`), y ningún botón tiene `aria-controls` apuntando al `id` de su `tabpanel`; el
  `tabpanel` tampoco tiene `aria-labelledby` hacia su tab. Con lector de pantalla o teclado, cada tab
  se alcanza con `Tab` (funciona) pero no con flechas (no funciona como el patrón declara).
- **Impacto:** usuarios de lector de pantalla o navegación por teclado que esperan el patrón estándar
  de pestañas no lo encuentran; la relación tab↔panel no se anuncia explícitamente.
- **Severidad:** P2 (fricción real para navegación asistida, no bloquea la tarea porque `Tab` simple sí
  llega a cada botón). **Confianza:** alta, verificado por código, no depende de datos.
- **Requisito relacionado:** R10 (accesibilidad). **Fase responsable propuesta:** 05 (catálogo de
  componentes) o 07 si se aborda junto con estados de interacción; es buen candidato a resolverse
  dentro del piloto de fase 06 porque `Tabs` es el componente más usado de toda la zona pública.
- **Condición de corrección:** navegación con flechas entre tabs del mismo `tablist`, y
  `aria-controls`/`id`/`aria-labelledby` enlazando cada tab con su panel, verificado con teclado y con
  un lector de pantalla real (no solo axe).

### H02 — `globals.css` concentra toda la zona pública en un solo archivo de 4737 líneas
- **Dónde:** `src/app/globals.css`.
- **Reproducción:** `wc -l src/app/globals.css` → 4737. Contiene tokens semánticos ya definidos
  (colores, espaciado, radios, sombra, easing, capas — ver "No es un hallazgo" más abajo) pero todas
  las reglas de todas las páginas y componentes públicos viven en el mismo archivo.
- **Impacto:** no es un defecto visible para el usuario final; es riesgo de mantenibilidad y de
  colisión de nombres al tocar componentes en fases 04-08 (F01.3: "dependencias que condicionan
  rendimiento o accesibilidad" es cualitativo aquí, no hay medición de peso de CSS crítico en esta
  fase).
- **Severidad:** P3. **Confianza:** alta (tamaño de archivo verificado).
- **Requisito relacionado:** R05 (contratos y responsabilidades claros). **Fase responsable:** 04.
- **Condición de corrección:** decisión explícita en fase 04 de modularizar por
  componente/página o justificar explícitamente mantenerlo así; no es bloqueante para empezar el
  piloto.

### H03 — `next lint` deprecado (ya registrado en fase 00, se mantiene aquí por trazabilidad)
- **Dónde:** `package.json` script `lint` → `next lint`, deprecado en Next 16.
- **Severidad:** P3, deuda técnica conocida, sin impacto de usuario. **Confianza:** alta.
- **Condición de corrección:** migrar con `@next/codemod@canary next-lint-to-eslint-cli` cuando se
  actualice a Next 16, fuera del alcance de este refactor salvo que bloquee un check necesario (ya
  excluido explícitamente en `PLAN_SITUADO.md`).

## No son hallazgos (verificado explícitamente para no repetir falsos positivos del proyecto)

- **`useLayoutEffect` sin array de dependencias en `places-map.tsx:633`** (marcado por ESLint
  `exhaustive-deps`): es intencional — el propio comentario del código explica que necesita releerse
  tras cada render para medir el tamaño de una tarjeta, y evita el bucle comparando el tamaño antes de
  llamar a `setState`. No tocar.
- **Sistema de tokens de diseño**: `INVENTARIO.md` (fase 00) dejó como duda si existía uno. Sí existe:
  `:root` en `globals.css` define colores semánticos (`--official`, `--parallel`, `--gap`, `--up`,
  `--down`), variante completa para `prefers-color-scheme: dark`, escala de espaciado (`--s1`…`--s5`),
  radio, sombra, easing y capas de z-index nombradas con comentario de uso. La fase 03 parte de una
  base sólida, no de cero.
- **Mapa interactivo (`places-explorer.tsx`)**: los puntos usan `role="button"`, `tabIndex={0}`,
  manejo de `Enter`/`Espacio`, `aria-label` descriptivo y un círculo de impacto invisible de 20px de
  radio para ampliar el objetivo táctil sobre un punto de 4px. Bien implementado.
- **Modal de donación (`donate.tsx`)**: usa `<dialog>` nativo con `showModal()` (foco y `Escape`
  gestionados por el navegador), cierre por clic en el fondo, y muestra explícitamente "Código de
  prueba: todavía no recibe pagos" mientras `IS_TEST` sea `true`. No engaña al usuario.
- **Estados de lectura parcial (`page.tsx`)**: cuando una sección no se pudo leer a tiempo, se cuenta
  como "sin leer" (no como cero) y se avisa en un `callout` visible con los nombres reales de las
  secciones faltantes. Cuando falla el tipo de cambio o la brecha (la columna vertebral del informe),
  se sirve una página de error explícita en vez de cifras parciales. Ya cumple el principio del README
  ("nunca mostrar una cifra sin evidencia").

### H04 — `--ink-faint` no cumple AA de texto en modo claro (hallazgo de fase 03)
- **Dónde:** `src/app/globals.css` (`--ink-faint: #78839a`), consumido como texto en `.tab`
  (inactivo, `globals.css:274-291`), `.dateline` y `.topbar-stamp`.
- **Reproducción:** contraste WCAG medido sobre los valores reales: `--ink-faint` sobre `--paper`
  (`#fbfbfc`) = 3.68:1; sobre `--panel` (`#ffffff`) = 3.81:1. Ambos por debajo del mínimo AA de 4.5:1
  para texto normal (el texto de `.tab` es 0.92rem/14.7px, no bold, por debajo del umbral de "texto
  grande"). En modo oscuro el mismo token sí cumple (5.42:1) por el fondo mucho más oscuro.
- **Impacto:** el nombre de las pestañas inactivas de `Tabs`/`SubTabs` (navegación principal de `/`)
  y la fecha del informe (`.dateline`) son difíciles de leer con baja visión en modo claro.
- **Severidad:** P2 (afecta la navegación principal de todos los visitantes en modo claro).
  **Confianza:** alta, medido con la fórmula WCAG sobre los valores CSS reales del proyecto.
- **Requisito relacionado:** R10 (accesibilidad). **Fase responsable propuesta:** 05/06, en el mismo
  cambio que H01 porque toca el mismo componente (`tabs.tsx`).
- **Condición de corrección:** texto de interfaz que hoy usa `--ink-faint` pasa a `--ink-soft`
  (7.4:1, holgado); `--ink-faint` queda reservado a elementos no textuales o texto grande. Detalle
  completo en `DIRECCION_VISUAL.md` → F03.4/F03.5.

## No verificado en esta fase (declarar, no inventar)

- **Contraste real** de los colores definidos en `globals.css` sobre fondos reales, en modo claro y
  oscuro: no medido con herramienta en esta fase.
- **Estados vacíos/"sin resultados"/error de validación con datos reales** en cada explorer: no se
  pudo ejercitar porque la base no responde (cuota de Neon agotada) — se revisó el código, no el
  comportamiento en pantalla con datos.
- **`axe-core`** (`tests/diagnostics/axe-report.spec.ts`): no ejecutado, requiere navegadores de
  Playwright no instalados en este entorno.
- **Navegación completa por teclado end-to-end** de un flujo real (abrir explorer, filtrar, paginar,
  volver): revisado por código, no ejercitado a mano en navegador.
- **Comportamiento en 320-360px de ancho real**: no verificado visualmente, solo por lectura de
  media queries en `globals.css`.
- **Rendimiento** (LCP/INP/CLS de laboratorio): no instrumentado, sin base de datos con contenido real
  para ejercitar una carga representativa.

## F01.5 — flujo piloto elegido para fase 06

**Piloto propuesto: la pestaña "Resumen" de `/` junto con el componente `Tabs` que la contiene.**

Razones, a partir de la corrección del inventario:
1. Es el único componente verdaderamente compartido por el 100% de los visitantes de la zona pública
   (a diferencia de `pager.tsx`, que solo toca 4 explorers).
2. Ya expone el hallazgo P2 más claro y acotado (H01: navegación por teclado del patrón tabs), así que
   el piloto demuestra una corrección real, no solo un cambio visual.
3. Funciona incluso sin datos reales (el estado de "secciones perdidas" y el estado `Unreadable` ya
   están accesibles hoy con la cuota de Neon agotada), lo que permite verificar el piloto en este
   entorno sin depender de que se resuelva el acceso a datos.
4. Alcance acotado: un componente (`tabs.tsx`) y su primer consumidor (`page.tsx`), sin tocar los 15
   explorers todavía.

`places-explorer.tsx` (la tarea de consulta frecuente identificada en fase 00) queda como **segundo
candidato**, después de validar el piloto de `Tabs`, precisamente porque ya está bien resuelto en
accesibilidad (ver "No son hallazgos") y no tiene una condición de corrección pendiente que lo
justifique como primer piloto.

## H05 (P3, confianza alta) — `.subtabs` se deforma en cápsula al envolver a varias filas en móvil

**Ruta/rol/estado:** `/` → sección con `SubTabs` (ej. "Tipo de cambio"), viewport 375×667.
**Encontrado en:** fase 06 (flujo vertical piloto), primera verificación real en navegador de este
kit (Playwright con Chromium, vía una ruta temporal `smoke-tabs-temp` con contenido simulado, borrada
al terminar). Antes de esta fase estaba registrado como "no verificado" en `HALLAZGOS.md`/`ESTADO.md`
por falta de navegador en el entorno.

**Pasos de reproducción:** abrir cualquier sección con `SubTabs` en un viewport angosto donde los 3
botones no caben en una fila (ej. 375px). `border-radius: 999px` en `.subtabs` asume una sola fila;
al envolver a 3 filas (~116px de alto) el radio se recorta a `min(999, alto/2)` ≈ 58px por esquina,
lo que convierte el contenedor en una cápsula/lente que no coincide con el contenido, con espacio
vacío visible a la derecha de cada pastilla.

**Impacto:** cosmético, no bloquea la tarea — los botones siguen siendo clicables y accesibles, el
texto se lee bien. Confunde visualmente en el ~20% del ancho de pantalla más angosto del catálogo de
dispositivos (fase 00 no fijó un mínimo, pero 375px es un ancho de referencia común).

**Severidad:** P3 (inconsistencia visual, sin impacto funcional). **Confianza:** alta (reproducido y
medido con `getBoundingClientRect`/`getComputedStyle` reales, no una suposición).

**Corrección aplicada en esta misma fase:** `border-radius: 999px` → `border-radius: 1.25rem` en
`.subtabs` (`src/app/globals.css`). Verificado visualmente antes/después con captura en 375px: la
cápsula desaparece, el contenedor se ve como un riel redondeado normal en cualquier número de filas,
y en desktop (una sola fila) sigue leyéndose como pastilla porque 1.25rem sigue siendo mayor que la
mitad de la altura de una fila.

## Recuento por severidad

| Severidad | Cantidad | IDs |
|---|---|---|
| P0 | 0 | — |
| P1 | 0 | — |
| P2 | 2 | H01, H04 |
| P3 | 3 | H02, H03, H05 |

> H04 se agregó en fase 03 (dirección visual), a partir de contraste medido sobre valores reales.
> H05 se agregó en fase 06 (flujo vertical piloto) y ya fue corregido en el mismo incremento.

No se encontró ningún hallazgo P0/P1 en la zona pública dentro de lo que se pudo verificar por código
en esta fase. Esto no certifica ausencia de problemas P0/P1 en flujos que requieren datos reales o
Playwright (ver "No verificado").
