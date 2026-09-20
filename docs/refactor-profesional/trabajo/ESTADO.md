# Estado del trabajo — kit de refactor UX/UI

## Sesión actual

- Kit instalado en `docs/refactor-profesional/` (copiado desde el paquete
  `REFAC_UX_UI_CLAUDE_CODEX_2026-09-18`, sin modificar).
- **Fase 00 completada** (contexto, inventario, baseline, plan situado). Nada de código de producto
  fue tocado. No se hizo commit — los cambios quedan sin commitear para revisión humana.

## Decisiones tomadas en esta fase

- No se avanzó a fase 01 sin que el usuario revise el plan situado, dado que es una app compartida
  en producción y el propio kit permite avanzar solo mientras el trabajo sea local y reversible;
  esta fase ya lo fue, la siguiente empieza a tomar decisiones de priorización.
- Se decidió no instalar navegadores de Playwright ni intentar conseguir credenciales de base de
  datos nuevas sin permiso explícito — ambas son acciones que exceden "inspección local".

## Pruebas ejecutadas con resultado

- `npm run typecheck` → OK, sin errores.
- `npm run lint` → OK, 11 warnings, 0 errores (detalle en BASELINE.md).
- `npm run build` → OK, compila y prerrenderiza sin error.
- `npm run dev` + petición a `http://localhost:3000/` → HTTP 200, pero mostrando el estado de error
  del producto porque la base de datos configurada (Neon) agotó su cuota de transferencia. Servidor
  detenido al terminar la prueba.
- `npx playwright test` → no ejecutado (navegadores no instalados, algunas specs requieren datos
  reales).
- Captura de pantalla → no tomada en esta fase.

## Bloqueos reales

1. Sin acceso a datos reales (cuota de Neon agotada) — impide verificación visual real y varias
   pruebas automatizadas.
2. Playwright no tiene navegadores instalados en este entorno.

Ninguno de los dos bloquea seguir a fase 01 (auditoría y priorización), que es principalmente
análisis sobre lo ya inventariado; sí bloquean partes de fase 00.4 (captura visual) y de fases 09-10
(accesibilidad/QA con Playwright).

## Próximo paso sugerido

1. El usuario decide cómo resolver el acceso a datos (nueva cuota, base de prueba local, o aceptar
   trabajar con el estado de error + código estático por ahora).
2. Con esa decisión, avanzar a **fase 01 — auditoría y priorización**, que no requiere datos reales
   para su mayor parte (es revisión de lo ya inventariado más, idealmente, una captura del estado
   actual).
3. Antes de tocar cualquier componente real (fase 03 en adelante), confirmar con el usuario el
   alcance inicial propuesto en PLAN_SITUADO.md (empezar por público, dejar admin para después).

## Archivos de fase 00 (sin commitear)

- `docs/refactor-profesional/trabajo/CONTEXTO_REAL.md`
- `docs/refactor-profesional/trabajo/INVENTARIO.md`
- `docs/refactor-profesional/trabajo/BASELINE.md`
- `docs/refactor-profesional/trabajo/PLAN_SITUADO.md`
- `docs/refactor-profesional/trabajo/ESTADO.md` (este archivo)
- Todo el resto de `docs/refactor-profesional/` es el kit copiado tal cual, sin modificar.

## Sesión — fase 01 (auditoría y priorización)

- **Fase 01 completada.** Alcance: zona pública únicamente (decisión del usuario), sin datos reales
  (cuota de Neon sigue agotada) ni Playwright instalado. Se leyó código real de
  `tabs.tsx`, `pager.tsx`, `page.tsx`, `places-map.tsx`, `places-explorer.tsx`, `press-explorer.tsx`,
  `donate.tsx` y `globals.css`. Nada de código de producto tocado, nada comiteado.
- **Entregable nuevo:** `docs/refactor-profesional/trabajo/HALLAZGOS.md` (3 hallazgos: 1×P2, 2×P3;
  0×P0/P1 en lo verificable por código). Incluye sección explícita de "no son hallazgos" para no
  repetir falsos positivos ya conocidos en este proyecto, y sección "no verificado" para lo que
  depende de datos reales o de Playwright.
- **Corrección importante al inventario de fase 00:** el patrón "pager+tabs compartido en ~13
  explorers" no se sostiene — verificado por import real, solo 4 explorers usan `pager.tsx` y 1 usa
  `tabs.tsx`. `PLAN_SITUADO.md` quedó actualizado con esta corrección y con un nuevo piloto propuesto
  para fase 06: el componente `Tabs` (`src/components/tabs.tsx`) + la pestaña "Resumen" de `/`, que sí
  es universal (lo usa el 100% de los visitantes) y ya tiene una condición de corrección concreta
  (H01: falta navegación por flechas y `aria-controls`/`aria-labelledby` en el patrón de tabs).
- **Decisión tomada en esta fase:** no se propuso ningún hallazgo P0/P1 sin evidencia de código; donde
  el código ya resuelve algo bien (tokens de diseño, mapa accesible, modal nativo, estados de lectura
  parcial honestos) se documentó explícitamente como "no es un hallazgo" en vez de omitirlo o
  inventar un problema para justificar trabajo.
- **Pruebas ejecutadas en esta fase:** ninguna nueva (fase 01 es auditoría de código, no ejecución);
  se reutilizaron los resultados de `BASELINE.md` (fase 00).
- **Próximo paso sugerido:** fase 02 (UX y arquitectura de información) puede arrancar — no depende de
  datos reales, es principalmente revisión de lo ya inventariado y auditado. Antes de tocar código en
  fase 03+, confirmar con el usuario el piloto corregido (`Tabs` en vez de `places-explorer`+`pager`).
- **Archivos nuevos/actualizados de esta fase:** `trabajo/HALLAZGOS.md` (nuevo),
  `trabajo/PLAN_SITUADO.md` (actualizado, historial de fase 00 conservado arriba),
  `trabajo/ESTADO.md` (este archivo, sección añadida). Sin commitear.

## Sesión — fase 02 (UX y arquitectura de información)

- **Fase 02 completada.** Alcance: zona pública. Modelo de 4 tareas (T1 consultar el informe del día,
  T2 profundizar en sección, T3 exportar/comparar, T4 recuperación ante datos faltantes) sobre la
  página única `/` con `Tabs`/`SubTabs`. Nada de código de producto tocado, nada comiteado.
- **Entregables nuevos:** `docs/refactor-profesional/trabajo/MAPA_UX.md`,
  `docs/refactor-profesional/trabajo/DECISIONES.md`.
- **Decisión D01 — no se reorganiza la navegación:** sin evidencia de fricción en las 7 secciones
  actuales ni en los `SubTabs` contextuales (Macroeconomía, Prensa); las etiquetas ya son de dominio.
  Reorganizar sin evidencia iría contra la especificación de UX del kit.
- **Decisión D02 — único cambio de IA que pasa a fase 06:** completar el contrato ARIA `tablist` de
  `Tabs`/`SubTabs` (flechas/`Home`/`End`, `aria-controls`/`aria-labelledby`), resolviendo H01. Cambio
  aditivo sobre `src/components/tabs.tsx`, sin romper la API que consumen `page.tsx` y
  `trade-explorer.tsx`.
- **Revisión heurística** (sin participantes disponibles — declarado como tal, no como investigación
  con usuarios): confirma T1-T4 resueltas salvo el punto de consistencia/estándares que ya cubre H01.
- **Wireframe de comportamiento** del piloto (`Tabs`/"Resumen") documentado en texto en `MAPA_UX.md`,
  incluyendo los dos estados de falta de datos que ya existen hoy (`callout` de secciones perdidas y
  página de error de la columna vertebral) — ninguno requiere cambios, ya cumplen "nunca mostrar una
  cifra sin evidencia".
- **No verificado en esta fase:** comportamiento visual real en 320-360px (sin navegador disponible
  en este entorno); queda igual que en `HALLAZGOS.md`.
- **Próximo paso sugerido:** continuar de corrido a fase 03 (dirección visual y tokens) — sin
  bloqueos. El usuario ya autorizó avanzar sin pausar a confirmar cada fase; solo detenerse ante un
  bloqueo real (credenciales, datos de producción, algo irreversible).

## Sesión — fase 03 (dirección visual y tokens)

- **Fase 03 completada.** No se propone un rediseño: la dirección visual ya existía y era coherente
  (`globals.css`, comentario de cabecera "One surface, one rhythm"); esta fase la formaliza,
  inventaría sus tokens como roles semánticos, y mide contraste real sobre los valores del proyecto.
- **Entregable nuevo:** `docs/refactor-profesional/trabajo/DIRECCION_VISUAL.md` (dirección, catálogo
  de tokens con rol semántico y uso verificado, estados del piloto, contraste medido, contrato
  visual con ejemplos/antiejemplos reales).
- **Hallazgo nuevo H04 (P2):** `--ink-faint` no cumple AA de texto en modo claro (3.68-3.81:1, bajo
  el mínimo 4.5:1) — afecta el tab inactivo de `Tabs`/`SubTabs` y `.dateline`. Agregado a
  `HALLAZGOS.md`, con condición de corrección: mover esos usos a `--ink-soft` (7.4:1). Se resuelve
  junto con H01 en fase 05/06 porque tocan el mismo componente (`tabs.tsx`).
- **Decisión:** no se agrega selector manual de tema (el modo oscuro ya sigue la preferencia del
  sistema vía `prefers-color-scheme`); no hay evidencia de que falte. No se adopta el formato DTCG
  sugerido por la especificación del kit — el proyecto no tiene build de CSS (sin PostCSS/Tailwind),
  así que variables CSS en `:root` ya son el mecanismo correcto; DTCG añadiría una capa sin
  consumidor real.
- **Código de producto tocado en esta fase:** ninguno. Las dos correcciones identificadas (contraste
  de `--ink-faint`, ARIA de `Tabs` de fase 02) quedan documentadas como condición de corrección para
  el piloto de fase 05/06, siguiendo el criterio conservador de esta fase (solo documentación y
  medición).
- **Próximo paso sugerido:** continuar a fase 04 (arquitectura y contratos) — sin bloqueos. Fase
  04 debe decidir además qué hacer con `globals.css` (4737 líneas en un archivo, H02 de fase 01).

## Sesión — fase 04 (arquitectura y contratos)

- **Fase 04 completada. Primer código de producto tocado en este kit**, en rama aislada
  `refactor-ux-ui-profesional` (creada desde `dev`; sin push, sin fusión).
- **Cambio implementado:** `src/components/tabs.tsx` — patrón ARIA `tablist` completo en `Tabs` y
  `SubTabs` (roving tabindex, flechas/`Home`/`End`, `aria-controls`/`aria-labelledby` tab↔panel vía
  `useId()`), resolviendo H01 (P2). Cambio aditivo, misma firma pública
  (`labels`/`icons`/`children`), sin romper `page.tsx`.
- **Fix de contraste H04 aplicado:** `.tab` y `.dateline` en `src/app/globals.css` pasan de
  `--ink-faint` (3.7:1, bajo AA) a `--ink-soft` (7.4:1); se ajustó `.tab:hover` a `--ink` para no
  perder la progresión visual reposo→hover→activo. `SubTabs` no requería cambio (ya usaba
  `--ink-soft`). Detalle completo en `ARQUITECTURA.md`.
- **Verificación:** `npm run typecheck` OK · `npm run lint` OK (mismos 11 warnings preexistentes,
  ninguno nuevo) · `npm run build` OK (compila y prerrenderiza, misma tabla de rutas del baseline).
  Verificación manual de teclado/lector de pantalla en navegador real: **no ejecutada** (sin
  Playwright con navegadores en este entorno, bloqueo ya conocido) — declarada explícitamente como
  pendiente, no como aprobada.
- **No hay tests previos ni runner de componentes en el proyecto** (solo Playwright e2e, sin
  navegadores instalados aquí); no se introdujo uno nuevo por exceder el alcance de este seam.
- **Commit:** cambios de código + `ARQUITECTURA.md` comiteados en rama
  `refactor-ux-ui-profesional` (ver hash en el log de git; sin push a `dev`, sin publicar).
- **Entregable nuevo:** `docs/refactor-profesional/trabajo/ARQUITECTURA.md`.
- **Próximo paso sugerido:** continuar a fase 05 (componentes y skills) — sin bloqueos nuevos. Sigue
  pendiente: verificación visual/teclado real y decisión sobre `globals.css` monolítico (H02, P3,
  baja prioridad).

## Sesión — fase 05 (componentes y skills)

- **Fase 05 completada**, en rama `refactor-ux-ui-profesional`. `Tabs`/`SubTabs` ya cubrían todos
  los estados que les aplican (normal, hover, activo, foco de teclado) tras el trabajo de fase 04;
  no había hueco real que cerrar. Se documentó explícitamente por qué pressed/disabled/error/ocupado
  **no aplican** a este control (no son botones de acción con efecto secundario, ni tienen permiso o
  carga que los deshabilite) en vez de inventar estados que el componente nunca puede producir.
- **Entregable nuevo:** `docs/refactor-profesional/trabajo/CATALOGO_ESTADOS.md` — catálogo textual
  (no Storybook: el proyecto no lo tiene y añadirlo para dos componentes sería la herramienta pesada
  que la fase 05.3 pide evitar), con tabla estado→selector CSS real→verificación.
- **F05.5 — sin duplicados:** único `role="tablist"`/`role="tab"` del proyecto es
  `src/components/tabs.tsx`; no hay nada que consolidar.
- **F05.4 — skills copiadas** a `.claude/skills/` (nuevo, no existía): `ui-atomic-solid`,
  `ui-visual-system`, `ui-states-recovery` (carpeta completa con `references/`). Cada una recibió una
  nota de aprendizaje específica de este proyecto en su `decisiones.md`. No se copiaron
  `ui-audit-and-reorder` (fase ya cerrada), `ui-motion-feedback` (fase 07) ni `ui-quality-gate`
  (fase 10) por no tener tarea activa todavía. Fuente canónica sigue en `docs/refactor-profesional/skills/`.
- **Código de producto tocado:** ninguno nuevo (los estados ya estaban completos desde fase 04).
- **Verificación:** no fue necesario re-correr typecheck/lint/build (sin cambios en `src/`); se
  mantienen los resultados en verde de fase 04.
- **Commit:** cambios de docs (`CATALOGO_ESTADOS.md`, `PLAN_SITUADO.md`, `ESTADO.md`) y las tres
  skills nuevas en `.claude/skills/` comiteados en `refactor-ux-ui-profesional`, sin push.
- **Próximo paso sugerido:** continuar a fase 06 (flujo vertical piloto) — sin bloqueos. Esa fase
  debe demostrar el flujo completo (Tabs/Resumen) de principio a fin, incluida la verificación de
  teclado que hasta ahora solo se revisó por código.

## Sesión — fase 06 (flujo vertical piloto)

- **Fase 06 completada con alcance explícito** (ver `EVIDENCIAS.md`), en rama
  `refactor-ux-ui-profesional`. Primera vez en este kit con navegador real disponible (Playwright vía
  MCP, Chromium) — se levantó `npm run dev` y se verificó contra él, no solo por lectura de código.
- **Contenido simulado, declarado como tal:** sin datos reales (Neon sigue sin cuota), se usó una
  ruta temporal `smoke-tabs-temp` con contenido marcado `data-mock="true"` para poder ejercitar
  `Tabs`/`SubTabs` con navegador. Creada, usada y **borrada dentro de la misma sesión** — nunca
  comiteada (verificado con `git status` antes de cada commit).
- **Verificado con navegador real:** ARIA tablist correcto (roles/aria-controls/aria-labelledby),
  roving tabindex (Tab salta los inactivos en ambos niveles), ArrowLeft/Right/Home/End en nivel
  superior y en `SubTabs` anidado, foco visible correcto, jerarquía activo/inactivo legible.
- **Hallazgo nuevo H05 (P3) encontrado y corregido en la misma fase:** `.subtabs` (`border-radius:
  999px`) se deformaba en una cápsula al envolver a 3 filas en 375px de ancho — nunca antes
  verificado por falta de navegador. Fix: `border-radius: 1.25rem` en `src/app/globals.css`.
  Recapturado antes/después, confirmado visualmente.
- **No verificado en esta fase (declarado explícitamente, no oculto):** flujo con datos reales de
  principio a fin (bloqueado por Neon), lector de pantalla real (NVDA/VoiceOver — fuera del alcance
  de Playwright headless), rendimiento de carga (sin datos reales para una carga representativa).
- **Verificación:** `typecheck`/`lint`/`build` en verde tras el fix, sin la ruta temporal en el build
  final (confirmado en la tabla de rutas).
- **Commit:** cambios de código (`globals.css`) + docs (`HALLAZGOS.md` con H05, `EVIDENCIAS.md`
  nuevo, `PLAN_SITUADO.md`, `ESTADO.md`) en `refactor-ux-ui-profesional`, sin push.
- **Próximo paso sugerido:** fase 07 (movimiento y feedback) — sin bloqueos nuevos. El piloto (`Tabs`/
  `SubTabs`) ya tiene sus contratos, estados y responsive demostrados; fase 07 debe revisar
  transiciones (`prefers-reduced-motion`, que el proyecto ya resuelve globalmente según fase 03) sobre
  este mismo componente antes de pensar en propagar a más rutas (fase 08).

## Sesión — fase 07 (movimiento y feedback)

- **Fase 07 completada, sin cambios de código.** El sistema de movimiento ya existente (tokens
  `--ease`/`--fast`/`--slow`, animación `rise` de entrada de panel con stagger, regla global
  `prefers-reduced-motion: reduce`) ya cubría por completo lo que el piloto necesita — se verificó con
  navegador real (misma técnica de ruta temporal de fase 06, borrada al terminar) en vez de darlo por
  sentado.
- **Verificado con Playwright real:** con movimiento normal, `animationName: "rise"` /
  `animationDuration: "0.42s"` con stagger 0/70/140ms en los hijos del panel. Con
  `prefers-reduced-motion: reduce` emulado, `animationName: "none"` / `animationDuration: "0s"` — la
  regla global sí alcanza al piloto sin necesitar una excepción local.
- **Interrupción:** el panel se remonta (`key={active}`) en vez de esconderse con CSS, así que no
  existe una animación de salida que pueda quedar a medias al cambiar rápido de tab — no hay cola de
  animaciones que limpiar, por diseño.
- **Entregable nuevo:** `docs/refactor-profesional/trabajo/MATRIZ_MOVIMIENTO.md` (inventario de
  interacciones, tokens, verificación de reduced-motion, perfilado declarado como no ejecutado).
- **No verificado (declarado, no oculto):** F07.4 perfilado con datos reales — bloqueado por la
  cuota de Neon, igual que en fases anteriores.
- **Commit:** solo documentación (`MATRIZ_MOVIMIENTO.md`, `PLAN_SITUADO.md`, `ESTADO.md`) en
  `refactor-ux-ui-profesional`, sin push. Ningún archivo de `src/` cambió en esta fase.
- **Próximo paso sugerido:** fase 08 (extensión al producto) — sin bloqueos. Esa fase decide si y
  cómo propagar el patrón del piloto (ARIA tablist, contraste, `.subtabs` sin cápsula) al resto de la
  zona pública; `/admin` sigue fuera de alcance por decisión del usuario.

## Sesión — fase 08 (extensión al producto)

- **Fase 08 completada.** La zona pública es una sola ruta (`/`); no hay "familias de rutas" que
  migrar en el sentido tradicional — `Tabs`/`SubTabs` es compartido, así que las fases 04-07 ya
  alcanzaron a todo su uso real (incluido `trade-explorer.tsx`). Se auditó la única familia adicional
  con patrón compartido: `Pager` (4 de los 15 explorers).
- **`Pager` ya era sólido:** botones nativos `disabled`, `aria-label` distingue instancias, foco
  visible cubierto por la regla global. No necesitaba adoptar el patrón `tablist` (no es un widget de
  pestañas).
- **H06 (P2) encontrado y corregido:** `.pager-where` con el mismo defecto de contraste que H04
  (`--ink-faint` = 3.81:1 sobre panel blanco, bajo AA). Corregido a `--ink-soft` (7.4:1).
- **H06b registrado, deliberadamente NO corregido:** `--ink-faint` aparece en 60+ reglas fuera del
  piloto. Sin datos reales para distinguir texto informativo de texto genuinamente auxiliar, corregir
  en bloque sería un rediseño de jerarquía visual que excede el alcance de este kit. Queda como deuda
  explícita para fase 09 o una auditoría dedicada — no se omitió en silencio.
- **Entregable nuevo:** `docs/refactor-profesional/trabajo/MATRIZ_COBERTURA.md`.
- **Verificación:** `typecheck`/`build` en verde tras limpiar `.next` (el caché de tipos tenía una
  referencia obsoleta a la ruta temporal de fases 06-07, ya borrada — no era una regresión real).
- **Commit:** `globals.css` (fix H06) + docs (`HALLAZGOS.md`, `MATRIZ_COBERTURA.md`,
  `PLAN_SITUADO.md`, `ESTADO.md`) en `refactor-ux-ui-profesional`, sin push.
- **Próximo paso sugerido:** fase 09 (accesibilidad y rendimiento) — sin bloqueos nuevos. Debe decidir
  qué hacer con H06b (deuda de `--ink-faint` sistémico) y con el perfilado de rendimiento, ambos
  pendientes por falta de datos reales.
