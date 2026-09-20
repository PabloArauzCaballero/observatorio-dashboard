# Plan situado — observatorio-dashboard

> Fase 00 · F00.5. Deriva de INVENTARIO.md y BASELINE.md, no de una lista genérica de gustos.

## Alcance inicial propuesto

Dado que es una app compartida en producción, sin datos reales disponibles en este entorno, y sin
captura visual todavía tomada, el alcance inicial recomendado es:

1. Completar la observación visual real (fase 00 extendida o inicio de fase 01) antes de tocar
   ningún componente: conseguir una base con cuota o datos de prueba, o al menos capturar la
   portada en su estado de error actual y compararlo contra capturas antiguas si existen.
2. Empezar por la **zona pública** (`/`), que es la tarea principal y la más visible, con foco en
   los explorers repetidos (patrón `pager.tsx` + `tabs.tsx`) como primer candidato de piloto vertical
   (fase 06), porque tocar ese patrón una vez beneficia a ~13 componentes.
3. Dejar la zona **admin** para después de validar el patrón en público, por su superficie de
   riesgo (auth, operaciones de datos reales como seeds/ingestión) — cualquier cambio ahí necesita
   más evidencia de pruebas antes de aceptarse.

## Exclusiones explícitas de este alcance inicial

- No se toca `src/lib/db.ts` (autocorrección de base) ni la lógica de dominio en `series.ts`,
  `daily-analysis.ts`, `econometrics.ts`, `macro-stats.ts` — son reglas de negocio verificadas, no
  superficie de UX.
- No se migra el stack (Next.js/React/recharts) ni se introduce una librería de animación o de
  componentes nueva sin justificarlo contra lo que ya existe.
- No se toca autenticación/sesión admin salvo que la fase de estados/accesibilidad encuentre un
  problema concreto ahí.
- No se resuelve la migración de `next lint` a la CLI de ESLint dentro de este encargo salvo que
  bloquee un check necesario — se registra como deuda técnica conocida.

## Tabla tarea → archivos → resultado → prueba → riesgo → reversión

| Tarea | Archivos reales | Resultado esperado | Prueba | Riesgo | Reversión |
|---|---|---|---|---|---|
| Confirmar visual real de la portada (con datos o en estado de error) | ninguno (solo observación) | Captura de escritorio/móvil documentada en `trabajo/` | Captura + `npm run dev` | Bajo | N/A, no cambia código |
| Auditoría y priorización (fase 01) | — (documento) | Lista de problemas con evidencia, no opiniones | Revisión manual contra INVENTARIO/BASELINE | Bajo | Descartar documento |
| Dirección UX / arquitectura de información (fase 02) | — (documento) | Mapa de tareas → ubicación, justificando cualquier movimiento de navegación | Descubribilidad revisada manualmente | Medio (decisiones de navegación) | Documento no se aplica hasta fase 04+ |
| Dirección visual y tokens (fase 03) | `src/app/globals.css`, nuevo archivo de tokens | Pantalla piloto con todos sus estados | Comparación visual antes/después | Medio | Revertir el CSS de tokens, componentes siguen funcionando sin ellos |
| Piloto: `Tabs` + pestaña "Resumen" de `/` (corregido en fase 01, ver arriba) | `src/components/tabs.tsx`, `src/app/page.tsx` | Navegación por flechas entre tabs (corrige H01), `aria-controls`/`aria-labelledby` enlazando tab↔panel, verificado con teclado | `npm run typecheck`, `npm run build`, revisión manual con teclado; Playwright/axe si se instalan navegadores | Bajo-medio (un componente muy usado, cambio acotado) | Revertir `tabs.tsx` a su versión actual; `page.tsx` sigue funcionando sin los atributos nuevos |
| Patrón `pager.tsx` (fase 08, no piloto) | `src/components/pager.tsx` y sus 4 consumidores reales (`city-places-explorer`, `macro-explorer`, `sources-explorer`, `world-explorer`) | Mejora aplicada a 4 componentes confirmados, no 13 | `npm run typecheck`, `npm run build` | Bajo (alcance ya acotado a 4 archivos) | Revertir `pager.tsx`, los 4 consumidores dejan de recibir la mejora pero siguen funcionando |
| Movimiento y feedback (fase 07) | componentes tocados en el piloto | Transiciones con variante de movimiento reducido | Verificación manual con `prefers-reduced-motion` | Bajo si se aplica solo al piloto | Quitar transición, el control sigue funcionando |
| Migración del resto del producto (fase 08) | resto de explorers y admin | Producto completo migrado sin romper funcionalidad | Build + typecheck + Playwright + revisión manual | Alto (superficie amplia) | Migrar en incrementos por componente, cada uno revertible por separado |
| Accesibilidad y rendimiento (fase 09) | componentes migrados | `axe` sin violaciones nuevas | `tests/diagnostics/axe-report.spec.ts` (requiere instalar navegadores Playwright) | Medio | N/A, es verificación |
| QA y regresión (fase 10) | toda la app | Evidencia de que nada roto | Playwright completo + revisión manual de capturas | Alto si se salta | N/A, es verificación |

## Incógnitas ordenadas por impacto

1. **Alto** — no hay acceso a datos reales en este entorno (cuota de Neon agotada). Bloquea
   verificación visual real y cualquier prueba Playwright que dependa de datos. Decisión del
   usuario: ¿conseguir una base de prueba, esperar a que se renueve la cuota, o trabajar solo con
   capturas del estado de error + código estático?
2. **Medio** — no se instalaron navegadores de Playwright en este entorno; no se sabe si el
   `playwright.config.ts` asume un servidor ya corriendo o lo levanta él mismo. A confirmar antes
   de fase 09/10.
3. **Medio** — no se leyó el detalle de cada handler de `/api/*` ni el contrato exacto que expone
   el núcleo al cliente admin (`src/lib/admin/core-client.ts`). Relevante para no romper contratos
   al reorganizar.
4. **Bajo** — deuda de `next lint` deprecado; no bloquea nada hoy.

## Supuestos reversibles con los que se continúa

- Se asume que la zona admin se aborda después de la pública, no en paralelo, para no multiplicar
  el riesgo sobre autenticación mientras se valida el enfoque visual.

## Actualización — fase 01 (auditoría y priorización)

> Ver `trabajo/HALLAZGOS.md` para el detalle completo. Resumen de lo que cambia respecto a este plan:

- **El supuesto de "patrón repetido en ~13 explorers" queda corregido, no confirmado.** Verificado
  por import real: solo 4 de 15 `*-explorer.tsx` usan `pager.tsx` (`city-places`, `macro`, `sources`,
  `world`) y solo 1 usa `tabs.tsx` (`trade`). El resto tiene su propia estructura. El componente
  realmente universal es `Tabs` en `src/app/page.tsx`, no un patrón interno de cada explorer.
- **Piloto de fase 06 actualizado:** en vez de `places-explorer.tsx` + `pager.tsx`, el piloto propuesto
  es el componente `Tabs` (`src/components/tabs.tsx`) y su consumidor principal (`src/app/page.tsx`,
  pestaña "Resumen"). Razones y detalle en `HALLAZGOS.md` → F01.5. Corrige la fila correspondiente de
  la tabla tarea→archivos más abajo.
- Auditoría de fase 01 no encontró hallazgos P0/P1 en lo que se pudo verificar por código (sin datos
  reales ni Playwright). Un hallazgo P2 (`Tabs` sin navegación por flechas ni `aria-controls`,
  H01) y dos P3 (`globals.css` de 4737 líneas en un archivo, `next lint` deprecado — ya conocido).
- Varias piezas que un refactor superficial suele "arreglar" ya están bien resueltas y no deben
  tocarse sin evidencia nueva: el sistema de tokens en `globals.css` (sí existe), el mapa interactivo
  de `places-explorer.tsx` (accesible), el modal de donación (usa `<dialog>` nativo), y los estados de
  lectura parcial de `page.tsx` (ya honestos). Ver "No son hallazgos" en `HALLAZGOS.md`.

## Actualización — fase 02 (UX y arquitectura de información)

> Ver `trabajo/MAPA_UX.md` y `trabajo/DECISIONES.md` para el detalle completo.

- **No se reorganiza la navegación de la zona pública** (D01): sin evidencia de fricción en las 7
  secciones actuales ni en los `SubTabs` contextuales; las etiquetas ya son de dominio.
- El único cambio de arquitectura de información que se lleva a fase 06 (piloto) es de **contrato de
  componente**, no de organización: completar el patrón ARIA `tablist` en `Tabs`/`SubTabs`
  (`ArrowLeft`/`ArrowRight`/`Home`/`End`, `aria-controls`/`aria-labelledby`) — resuelve H01, cambio
  aditivo, sin romper consumidores (D02). Actualiza y reemplaza la fila del piloto en la tabla de
  arriba: mismos archivos (`tabs.tsx`, `page.tsx`), ahora con la condición de corrección explícita.
- Revisión heurística (sin participantes disponibles, declarado como tal) no encontró fricción nueva
  de tareas; confirma que T1-T4 ya están bien resueltas salvo H01.
- Sin bloqueos para fase 03 (dirección visual y tokens).

## Actualización — fase 03 (dirección visual y tokens)

> Ver `trabajo/DIRECCION_VISUAL.md` para el detalle completo.

- **No se propone un rediseño de marca ni un archivo de tokens nuevo.** La dirección visual ya
  existe en `globals.css` (comentario de cabecera "One surface, one rhythm") y ya es coherente
  (tipografía por función, color reservado a significado de dominio, materiales planos, movimiento
  con `prefers-reduced-motion` ya resuelto globalmente). Esta fase la formaliza con una tabla de
  roles semánticos y verifica contraste sobre valores reales; no reescribe el sistema.
- **Nuevo hallazgo P2 (H04):** `--ink-faint` no cumple AA de texto en modo claro (3.68-3.81:1 vs
  4.5:1 requerido) — afecta el tab inactivo de `Tabs`/`SubTabs` y `.dateline`. Se agrega a
  `HALLAZGOS.md` y queda como condición de corrección para el mismo cambio que H01 (fase 05/06,
  mismo componente `tabs.tsx`).
- Tema oscuro ya está en alcance (sigue preferencia del sistema, sin selector manual); no se propone
  agregar un mecanismo de elección manual sin evidencia de que falte.
- Ningún código de producto tocado en esta fase (documentación y medición únicamente).

## Actualización — fase 04 (arquitectura y contratos)

> Ver `trabajo/ARQUITECTURA.md` para el detalle completo.

- **Primer código de producto de este kit, implementado en rama aislada `refactor-ux-ui-profesional`**
  (no `dev`, sin push): `src/components/tabs.tsx` gana el contrato ARIA `tablist` completo (roving
  tabindex, flechas/`Home`/`End`, `aria-controls`/`aria-labelledby`) — resuelve H01. Firma pública sin
  cambios.
- **Fix de contraste H04 aplicado** en `src/app/globals.css`: `.tab` y `.dateline` pasan de
  `--ink-faint` a `--ink-soft`; se ajustó `.tab:hover` a `--ink` para conservar la progresión visual.
- Verificado con `typecheck`/`lint`/`build` (los tres reales del proyecto), todos en verde, sin
  warnings nuevos. Verificación manual de teclado/lector de pantalla en navegador: **pendiente**, no
  ejecutable en este entorno.
- Sin bloqueos para fase 05 (componentes y skills). Sigue abierto H02 (`globals.css` monolítico, P3,
  baja prioridad) y la verificación visual/de teclado en navegador real.

## Actualización — fase 05 (componentes y skills)

> Ver `trabajo/CATALOGO_ESTADOS.md` para el detalle completo.

- `Tabs`/`SubTabs` ya cubrían todos los estados aplicables tras fase 04 (normal, hover, activo,
  foco); pressed/disabled/error/ocupado no aplican a este control y quedó documentado por qué, en
  vez de inventarlos.
- No se introdujo Storybook (el proyecto no lo tiene) — catálogo textual en `CATALOGO_ESTADOS.md`.
- Sin duplicados de `role="tablist"`/`role="tab"` en el proyecto — nada que consolidar.
- Skills copiadas a `.claude/skills/` (nuevo): `ui-atomic-solid`, `ui-visual-system`,
  `ui-states-recovery`, cada una con una nota de aprendizaje específica de este proyecto.
- Sin código de producto nuevo tocado (los estados ya estaban completos).
- Sin bloqueos para fase 06 (flujo vertical piloto).

## Actualización — fase 06 (flujo vertical piloto)

> Ver `trabajo/EVIDENCIAS.md` para el detalle completo.

- Primera verificación con navegador real de este kit (Playwright/Chromium contra `npm run dev`).
  Contenido simulado y declarado como tal (sin datos reales por cuota de Neon), en una ruta temporal
  borrada al terminar, nunca comiteada.
- ARIA tablist, roving tabindex y navegación por teclado (flechas/Home/End, en ambos niveles
  anidados) verificados funcionando de verdad, no solo por lectura de código.
- **H05 (P3) encontrado y corregido:** `.subtabs` se deformaba en móvil (375px) al envolver a 3
  filas; `border-radius: 999px` → `1.25rem`.
- No verificado (declarado, no oculto): flujo con datos reales, lector de pantalla real, rendimiento.
- Gate de fase 06 aprobado con alcance explícito. Sin bloqueos para fase 07 (movimiento y feedback).

## Actualización — fase 07 (movimiento y feedback)

> Ver `trabajo/MATRIZ_MOVIMIENTO.md` para el detalle completo.

- Sin cambios de código: el sistema de movimiento existente (tokens, `panel-enter` con stagger, regla
  global `prefers-reduced-motion`) ya cubre el piloto. Verificado con Playwright real emulando
  `reducedMotion`, no asumido por lectura de código.
- F07.4 (perfilado con datos reales) queda pendiente, mismo bloqueo de Neon que fases anteriores.
- Gate de fase 07 aprobado. Sin bloqueos para fase 08 (extensión al producto).

## Actualización — fase 08 (extensión al producto)

> Ver `trabajo/MATRIZ_COBERTURA.md` para el detalle completo.

- Zona pública = una sola ruta (`/`); sin familias de rutas que migrar. `Tabs`/`SubTabs` compartido ya
  alcanzó a todo su uso real desde fases 04-07. Se auditó `Pager` (única familia adicional con
  componente compartido) — ya era sólido, salvo un defecto real.
- **H06 (P2) encontrado y corregido:** mismo defecto de contraste que H04, ahora en `.pager-where`.
- **H06b registrado como deuda explícita, no corregido:** `--ink-faint` usado en 60+ reglas fuera del
  piloto; corregir en bloque sin datos reales excedería el alcance de este kit.
- Gate de fase 08 aprobado con alcance explícito. Sin bloqueos para fase 09 (accesibilidad y
  rendimiento).

## Actualización — fase 09 (accesibilidad y rendimiento)

> Ver `trabajo/EVIDENCIAS_ACCESIBILIDAD.md` para el detalle completo.

- axe-core real (WCAG 2A+2AA) corrido con navegador real: 0 violaciones en `/` y en el piloto
  completo (Tabs+SubTabs+Pager). Confirma H01/H04/H06 sin regresión.
- Rendimiento de campo y lector de pantalla real siguen sin verificar (mismos bloqueos de datos/
  entorno). H06b tratado como deuda explícita, condición de revisión definida.
- Gate de fase 09 aprobado con limitaciones explícitas, 0 P0/P1 abiertos. Sin bloqueos para fase 10
  (QA y regresión).
