# Catálogo de estados — piloto Tabs/SubTabs

> Fase 05. No hay Storybook ni ruta de desarrollo/demo en el proyecto (confirmado: no
> aparece en `package.json`, no hay carpeta `stories/` ni similar). Introducir Storybook
> aquí sería la "herramienta pesada" que la propia fase 05.3 pide evitar para un catálogo
> de dos componentes. Este documento es el catálogo textual: cada estado enlaza al selector
> CSS real y al componente real, para que se pueda verificar leyendo el código en vez de
> una herramienta aparte.

## `Tabs` (`src/components/tabs.tsx`, selector `.tab` / `.tab-active`)

| Estado | Disparador | Regla CSS real | Verificado |
|---|---|---|---|
| Normal | pestaña no activa, sin interacción | `.tab` → `color: var(--ink-soft)` | Código ✅ (fase 04 subió el contraste desde `--ink-faint`) |
| Hover | puntero sobre pestaña no activa | `.tab:hover` → `color: var(--ink)` | Código ✅ |
| Activo/seleccionado | `aria-selected="true"` | `.tab-active` → `color: var(--ink)`, `font-weight: 600`, `border-bottom-color: var(--ink)` | Código ✅ |
| Foco de teclado | `:focus-visible` tras Tab o flecha | `.tab:focus-visible` → outline 2px `--official`, offset -2px | Código ✅ |
| Pressed | no existe como estado visual distinto — al hacer click, el estado resultante es "activo"; no hay un frame intermedio de "presionado" que el CSS deba distinguir | — | No aplica (confirmado: no es un botón de acción con efecto secundario, es un selector) |
| Disabled | no existe — todas las secciones del informe están siempre disponibles, no hay permiso ni carga que deshabilite una pestaña | — | No aplica (confirmado por `CONTEXTO_REAL.md`: zona pública sin roles) |
| Error | no aplica al control de navegación en sí — un fallo de datos se muestra **dentro del panel**, no en la pestaña | ver estado de panel abajo | Código ✅ (responsabilidad correcta: la pestaña no miente sobre si hay datos) |
| Ocupado/cargando | no aplica al control — el panel activo puede mostrar su propio estado de carga/erroe, la pestaña siempre es clicable | ver estado de panel abajo | Código ✅ |

## `SubTabs` (selector `.subtab` / `.subtab-active`)

Misma tabla que `Tabs`, con una diferencia real de diseño ya documentada en `DIRECCION_VISUAL.md`:
es "un paso más silencioso" (pills en vez de subrayado) para señalar el segundo nivel de
navegación. Normal `--ink-soft`, hover `--ink` + fondo `--rule-soft`, activo fondo `--official`
+ texto blanco (con `.subtab-active:hover` fijado para no cambiar en hover), foco outline
2px `--official` offset 2px. No hay pressed/disabled/error/busy por la misma razón que `Tabs`.

## Panel (`role="tabpanel"`, contenido de cada pestaña)

El panel es quien de verdad tiene estados de datos, no el control de navegación:

| Estado | Qué se ve | Dónde vive en código |
|---|---|---|
| Con datos | contenido normal de la sección | componentes de cada pestaña (fuera del alcance de este piloto) |
| Secciones parcialmente perdidas | callout explícito, no oculta el hueco | ya existente, confirmado en fase 02 (`MAPA_UX.md`) |
| Fallo de la columna vertebral | página de error del producto (esto es lo que se observó en esta sesión por la cuota de Neon agotada) | ya existente, confirmado en `BASELINE.md` |
| Vacío/sin resultados dentro de una sección | no verificado con datos reales en esta sesión (bloqueo de fase 00) | pendiente de verificación visual cuando haya datos |

## Consolidación de duplicados (F05.5)

Búsqueda de `role="tablist"` y `role="tab"` en `src/`: el único resultado es
`src/components/tabs.tsx`. No hay una segunda implementación de pestañas ni un patrón
paralelo que debiera migrarse hacia `Tabs`/`SubTabs`. No se propone ninguna consolidación
porque no hay duplicado real que consolidar.

## Skills copiadas a `.claude/skills/` (F05.4)

Copiadas completas (carpeta + `references/`), fuente canónica sigue siendo
`docs/refactor-profesional/skills/`:

- `ui-atomic-solid` — aplica a la extracción del hook `useTablistKeyboard` (fase 04).
- `ui-visual-system` — aplica a la medición de contraste y el catálogo de tokens (fase 03-04).
- `ui-states-recovery` — aplica a los estados del panel documentados arriba.

No copiadas por ahora (sin tarea activa que las use todavía): `ui-audit-and-reorder` (la
auditoría de fase 01 ya cerró), `ui-motion-feedback` (fase 07), `ui-quality-gate` (fase 10).
Cada una en `references/decisiones.md` recibió una nota específica de este proyecto, sin
convertirla en regla universal.
