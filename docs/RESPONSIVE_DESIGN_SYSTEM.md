# Sistema responsivo — observatorio-dashboard

Referencia de lo que ya existe en `src/app/globals.css` (sitio público) y
`src/app/admin/admin.css` (panel admin, que reutiliza los mismos tokens). No es un sistema nuevo:
es la documentación que faltaba sobre el que ya está en producción, más los dos tokens añadidos en
esta pasada (z-index, y esta referencia de breakpoints).

## Por qué no hay CSS Modules ni Tailwind

No hay PostCSS configurado y no se introduce uno como parte de este trabajo — no hay
justificación técnica que lo amerite (el sistema actual funciona, es consistente y no tiene
colisiones de nombres detectadas). Toda regla nueva va en CSS plano, en el archivo que ya gobierna
esa pantalla.

## Tokens (`:root`, `globals.css:14-55`)

| Categoría | Tokens | Nota |
|---|---|---|
| Color | `--ink`, `--ink-soft`, `--ink-faint`, `--rule`, `--rule-soft`, `--paper`, `--panel`, `--panel-tint`, `--official`, `--parallel`, `--gap`, `--up`, `--down` | Override completo en `@media (prefers-color-scheme: dark)`. |
| Tipografía | `--serif`, `--sans`, `--mono` | Font stacks; no hay escala tipográfica tokenizada — cada regla fija su `font-size` en rem, con `clamp()` donde el título debe fluir. |
| Espaciado | `--s1` (0.5rem) … `--s5` (3rem) | Escala de 5 pasos, única para todo el sitio. |
| Forma | `--radius` (10px), `--shadow` | Un solo radio y una sola sombra en todo el sitio — decisión deliberada, no se fragmenta. |
| Movimiento | `--ease`, `--fast` (160ms), `--slow` (420ms) | Respeta `prefers-reduced-motion: reduce` globalmente. |
| **Apilamiento (nuevo)** | `--z-sticky` (1), `--z-sticky-raised` (2), `--z-sticky-corner` (3), `--z-overlay` (40) | Mismos valores que ya estaban sueltos en el código; solo se nombraron. |

## Escala de breakpoints (referencia, `globals.css:57-73`)

Sin `@custom-media` (no hay preprocesador), esta tabla es documentación para que una regla nueva
elija uno de estos anchos en vez de inventar uno cercano — no reemplaza los breakpoints ya
afinados por pantalla, que conservan su propio comentario explicando por qué ese ancho y no otro.

| Ancho | Uso previsto |
|---|---|
| 360px | Suelo de verificación — móviles más pequeños. |
| 640px | Techo de móvil en retrato. |
| 768px | Tablets pequeñas / móviles grandes en horizontal. |
| 900px | Punto donde la mayoría de los layouts de dos columnas (rail + contenido, grid de admin) pasan a una columna. |
| 1024px | Tablets en horizontal. |
| 1180–1280px | Punto donde los gráficos/tarjetas pareados dejan de caber lado a lado. |
| 1600px | Escritorio ancho — el shell gana padding lateral extra. |

Inventario real de los 18 `@media` existentes (14 en `globals.css`, 4 en `admin.css`), cada uno
con su propio comentario de por qué ese ancho: 640, 720 (×4), 860, 900 (×4, incluye las 3 de
`admin.css` para el grid y la nav), 1180, 1280, 1600 — más `prefers-color-scheme` y
`prefers-reduced-motion`.

## Patrones reutilizables (no crear uno nuevo sin revisar estos primero)

- **`.workspace` / `.rail` / `.workspace-main`** — el layout "rail docked + contenido", usado por
  casi todos los exploradores públicos. Colapsa a una columna a 900px. `.rail` tiene
  `max-width:100%; min-width:0; flex:none` deliberadamente, para no poder forzar overflow aunque
  su contenido tenga un nombre largo (ver comentario en el propio código).
- **`.table-wrap`** (público) / **`.admin-scroll`** (admin) — toda tabla ancha va envuelta en uno
  de estos dos contenedores (`overflow-x:auto`), nunca suelta. Las 24 tablas del sitio (9 públicas
  + 15 de admin) ya lo siguen. Ambos llevan ahora una sombra de scroll (gradientes CSS con
  `background-attachment: local, local, scroll, scroll` — la misma técnica de dos capas que
  `.rail-list-cut` ya usaba solo para el borde inferior) que indica que hay más columnas sin
  necesitar JS. Reutilizar este bloque tal cual para cualquier área nueva con scroll horizontal.
- **`.card-head:has(.card-toggle) .card-sector`** — cuando una cabecera de tarjeta tiene botones
  flotantes (`.card-toggle`/`.card-tools`, `position:absolute`), el nombre de categoría reserva
  `6rem` de ancho con `:has()` para no correr por debajo de ellos en pantallas angostas. `:has()`
  ya se usaba en este archivo (`.card:has(.card-table)`), así que no es una técnica nueva para el
  proyecto.
- **`.figures` / `.panel` / `.chip`/`.chip-on`** — tarjetas de cifras, paneles de contenido y
  filtros tipo píldora.
- **`.admin-nav-head` / `.admin-nav-toggle` / `.admin-nav-links`** (nuevo, `admin.css`) — patrón de
  menú colapsable: `display:contents` en desktop (sin caja propia, los hijos se comportan como
  antes) y disclosure real por debajo de 900px. Reutilizar esta forma para cualquier nav futura
  que necesite el mismo colapso, en vez de inventar otra.
- **Iconos de disclosure** — `Icon name="desplegar"` / `Icon name="plegar"` (`icons.tsx`) es la
  convención ya usada en `macro-explorer.tsx`, `press-explorer.tsx`, `filing-explorer.tsx` y ahora
  también en el toggle de la nav admin.

## Lo que se preserva a propósito

- Layout "full bleed con rail docked", no columna centrada de ancho fijo (`globals.css:95-103`).
- Un único radio y una única sombra.
- El catch-all de `:focus-visible` como mecanismo único de foco (`globals.css`, selector
  `:where(button, a[href], input, select, summary, [tabindex]):focus-visible`).
- `Tabs`/`SubTabs` montan solo el panel activo (no `display:none`), porque recharts necesita medir
  un contenedor con ancho real.
