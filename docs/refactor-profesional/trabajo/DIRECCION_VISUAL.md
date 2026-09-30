# Dirección visual — fase 03

> Alcance: zona pública (`/`), piloto `Tabs` + pestaña "Resumen". Sin datos reales (cuota Neon
> agotada); estados verificados son el error de lectura completo (`Unreadable`) y el `callout` de
> secciones parciales, ambos ya alcanzables hoy sin base de datos. No se propone un rediseño de
> marca: la dirección ya existe en el código (`src/app/globals.css`, comentario de cabecera) y esta
> fase la formaliza, la verifica y define su contrato, como pide el kit.

## F03.1 — dirección existente (se conserva)

El propio archivo de estilos declara la dirección en su comentario de cabecera: **"One surface, one
rhythm"**, para una audiencia de economistas — "the page reads like a briefing rather than a control
room: type carries the hierarchy and colour is spent only where it means something". Verificado
contra el código real, no es aspiracional:

- **Densidad:** media-alta, apropiada para consulta de series y tablas, no para una landing. Ancho
  de lectura y jerarquía tipográfica priman sobre superficies grandes o espacio decorativo.
- **Tipografía:** dos familias funcionales, ambas de sistema (sin *webfonts*, cero coste de red):
  `--serif` (`ui-serif, Georgia...`) para títulos (`h1`, `h2`, `.masthead`) — el registro de
  "informe" — y `--sans` (`ui-sans-serif, system-ui...`) para cuerpo e interfaz. `--mono` para datos
  técnicos: `.dateline`, `.topbar-stamp`, cifras en `<code>`. Esta separación serif/sans/mono por
  *función* (no por componente) ya es la regla; se mantiene.
- **Jerarquía y retícula:** escala de espaciado `--s1`…`--s5` (0.5rem→3rem) usada de forma
  consistente; `.stack` (`gap: var(--s4)`) como unidad de composición vertical repetida.
- **Materiales:** planos, casi sin sombra (`--shadow` es sutil, `0 1px 2px` + `0 8px 24px -12px` con
  opacidad baja) y sin traslucidez, glassmorphism ni gradientes decorativos — coherente con la regla
  del kit de no convertir la app en tarjetas de cristal. Único material con elevación real:
  `.slicers` (paneles de filtro), justificado porque flotan sobre contenido con el que no deben
  confundirse.
- **Acento:** color reservado a significado de dominio, no a decoración. Cuatro acentos semánticos
  fijos: `--official` (tipo de cambio oficial), `--parallel` (paralelo), `--gap` (brecha),
  `--up`/`--down` (variación). No hay un "color de marca" genérico aplicado a botones o navegación;
  el estado activo de un tab se marca con `--ink` (texto, no color), evitando que el acento de dominio
  se confunda con un acento de interfaz.
- **Movimiento:** una sola animación de entrada (`rise`, `panel-enter`) con *stagger* de 70ms entre
  hijos — "a section arrives rather than appears" (comentario del propio componente `Tabs`).
  `prefers-reduced-motion: reduce` ya anula toda animación y transición globalmente
  (`globals.css:174-180`), no solo la de esta pieza.

**Qué se ajusta en esta fase:** nada estructural. Se documenta la dirección para que fases 05-08 no
reinventen valores, y se señalan dos puntos concretos (ver F03.4) que sí necesitan corrección antes
de extender el patrón a más componentes.

## F03.2 — inventario de tokens (ya existentes, `globals.css:14-56`)

| Token | Claro | Oscuro | Rol semántico | Uso verificado |
|---|---|---|---|---|
| `--ink` | `#14181f` | `#eef1f6` | `text.primary` | Texto principal, tab activo |
| `--ink-soft` | `#4a5464` | `#b3bccb` | `text.secondary` | Texto de apoyo, `.callout` |
| `--ink-faint` | `#78839a` | `#7f8a9c` | `text.tertiary` (⚠ no usar en texto <18px, ver F03.4) | `.dateline`, `.topbar-stamp`, tab inactivo |
| `--rule` / `--rule-soft` | `#e2e6ed` / `#eef1f5` | `#2a313d` / `#212833` | `border.default` / `border.subtle` | Bordes, `.tabs` underline |
| `--paper` | `#fbfbfc` | `#0e1116` | `surface.canvas` | Fondo de página |
| `--panel` / `--panel-tint` | `#ffffff` / `#f6f8fa` | `#151a21` / `#1a202a` | `surface.panel` / `surface.panel.tint` | Tarjetas, `.slicers`, `.callout` |
| `--official` | `#1b4f9c` | `#6fa8e8` | `data.official` | Serie oficial, foco (`.tab:focus-visible`) |
| `--parallel` | `#c2551f` | `#ee9161` | `data.parallel` | Serie paralela |
| `--gap` | `#7a5197` | `#b696d6` | `data.gap` | Brecha, borde de `.callout` |
| `--up` / `--down` | `#a32b1f` / `#1c6b4a` | `#e8776a` / `#58c39a` | `state.negative` / `state.positive` | Variación, `.error` (borde) |
| `--s1`…`--s5` | `0.5–3rem` | — | `space.1`…`space.5` | Espaciado, escala geométrica ~1.5-1.6× |
| `--radius` | `10px` | — | `radius.default` | Paneles, controles |
| `--shadow` | ver arriba | variante oscura propia | `elevation.panel` | `.slicers`, `.table-wrap` |
| `--ease` / `--fast` / `--slow` | `cubic-bezier(0.22,0.61,0.36,1)` / `160ms` / `420ms` | — | `motion.ease` / `motion.feedback` / `motion.enter` | Transiciones de color/borde, `panel-enter` |
| `--z-sticky*` / `--z-overlay` | `1–3` / `40` | — | `layer.sticky*` / `layer.overlay` | Cabeceras y tablas con columnas fijas, modal |

No hay valores duplicados ni contradictorios detectados en el subconjunto usado por el piloto
(`Tabs`, `page.tsx`, `.error`, `.callout`). No se propone un archivo de tokens nuevo ni formato DTCG:
el proyecto no usa herramienta de build de CSS (sin PostCSS/Tailwind, confirmado en fase 00), así que
variables CSS en `:root` ya son el mecanismo correcto para este stack — adoptar DTCG añadiría una
capa de generación sin consumidor real. Los alias de rol de esta tabla son documentación, no un
archivo nuevo a mantener.

## F03.3 — pantalla patrón: `Tabs` + "Resumen" (`src/app/page.tsx`, `src/components/tabs.tsx`)

Estados verificables en este entorno (sin datos reales) y su tratamiento visual actual:

| Estado | Disparador real | Tratamiento actual | Fuente |
|---|---|---|---|
| **Normal** | Datos completos | `Tabs` con 7 secciones, tab activo en `--ink` + subrayado 2px, resto en `--ink-faint` | `page.tsx:505-609` |
| **Ocupado** | Cambio de pestaña | Remount del panel activo (no oculto por CSS, ver comentario en `tabs.tsx:10-13`) + `panel-enter` con *stagger* | `tabs.tsx:43-47` |
| **Vacío/parcial** | Una sección no se leyó a tiempo | `.callout` (borde `--gap`, fondo `--panel-tint`) con nombre real de la sección faltante, no genérico | `page.tsx` + `NOMBRE_DE_SECCION` |
| **Error total** | Falla la columna vertebral (tipo de cambio/brecha) | Página `Unreadable` completa, sin cifras, mensaje explícito, sin culpar al usuario | `page.tsx:205-220`, `.error` (borde `--up`) |
| **Foco** | Navegación por teclado | `outline: 2px solid var(--official)`, `outline-offset: -2px` — visible sobre fondo claro y oscuro (ver contraste F03.4) | `globals.css:303-307` |

Verificado hoy en este entorno: el estado **Error total** (`Unreadable`) se observó realmente
sirviéndose en `npm run dev` (fase 00), no es una descripción teórica. El estado **Vacío/parcial** y
**Normal** se verificaron por lectura de código, no en pantalla con datos — pendiente de captura real
cuando se resuelva el acceso a Neon (decisión ya registrada como pendiente del usuario en
`PLAN_SITUADO.md`).

Móvil: no verificado visualmente (sin navegador en este entorno). `.tabs` usa `flex-wrap: wrap`, así
que en ancho estrecho los tabs pasan a varias filas en vez de scroll horizontal — comportamiento
leído en CSS, no ejercitado a mano.

## F03.4 — contraste y tema

Medido con la fórmula WCAG 2.x sobre los valores reales de `globals.css` (no estimado):

| Par | Claro | Oscuro | AA texto normal (≥4.5:1) | AA texto grande / UI (≥3:1) |
|---|---|---|---|---|
| `--ink` / `--paper` | 17.2:1 | 16.7:1 | ✅ | ✅ |
| `--ink-soft` / `--paper` | 7.4:1 | 9.9:1 | ✅ | ✅ |
| `--ink-faint` / `--paper` (`.dateline`, `.topbar-stamp`) | **3.68:1** | 5.4:1 | ❌ claro | ✅ |
| `--ink-faint` / `--panel` (tab **inactivo**, 0.92rem ≈ 14.7px, no bold) | **3.81:1** | — | ❌ claro | ✅ (solo si se trata como UI, no como texto) |
| `--official` / `--panel` (foco, enlaces) | 7.9:1 | 7.0:1 | ✅ | ✅ |
| `--parallel` / `--panel` | 4.55:1 | 7.4:1 | ✅ (al límite en claro) | ✅ |
| `--gap` / `--panel` | 6.1:1 | 6.9:1 | ✅ | ✅ |
| `--up` / `--panel` | 7.2:1 | 6.1:1 | ✅ | ✅ |
| `--down` / `--panel` | 6.5:1 | 8.1:1 | ✅ | ✅ |

**Hallazgo verificado (nuevo, no estaba en `HALLAZGOS.md` de fase 01 — se agrega ahí también):**
`--ink-faint` sobre fondo claro (`--paper`/`--panel`) da 3.68–3.81:1, por debajo del mínimo AA de
4.5:1 para texto normal. Se usa hoy en texto de 14.7px sin negrita: la etiqueta del tab **inactivo**
en `.tab` (`globals.css:274-291`) y `.dateline`/`.topbar-stamp`. En modo oscuro el mismo token sí pasa
(5.42:1) porque el fondo es mucho más oscuro. **No se corrige en esta fase** (fase 03 es de
contrato, no de implementación general); queda como condición de corrección para el piloto de fase
06, que ya toca `tabs.tsx`: o bien `--ink-faint` se oscurece para modo claro (perdería su uso como
color "terciario" en superficies donde 3:1 basta), o los usos de texto real (tab inactivo, dateline)
pasan a `--ink-soft` (7.4:1, holgado) y `--ink-faint` queda reservado a elementos no textuales o de
gran tamaño. Se recomienda la segunda opción por afectar menos superficies.

**Tema oscuro:** ya está en alcance — implementado vía `@media (prefers-color-scheme: dark)`
(`globals.css:79-96`), sin mecanismo de elección manual ni `localStorage` (confirmado por
`grep` sin resultados de `data-theme` o `theme` en `layout.tsx`/componentes). Se seguirá la
preferencia del sistema únicamente; no se propone agregar un selector manual de tema en este
refactor — no hay evidencia de que falte (F02 no lo señaló como fricción) y sería alcance nuevo, no
un ajuste del sistema existente.

**Fallback opaco de superficies translúcidas:** no aplica — no se detectó ninguna regla con
`backdrop-filter` ni `rgba()` de fondo con opacidad parcial usada como superficie de contenido en el
subconjunto revisado (`--shadow` usa alfa, pero es sombra, no relleno).

**Zoom / tamaño de fuente:** no verificado en este entorno (requiere navegador). El uso de `rem` y
`clamp()` en tipografía (`.masthead h1`) es consistente con soporte a zoom del navegador, pero queda
como "no verificado" hasta que se pueda probar a mano.

## F03.5 — contrato visual interno

**Reglas (con ejemplo real del proyecto):**

1. Un color de dato (`--official`, `--parallel`, `--gap`, `--up`, `--down`) identifica una serie o
   una dirección de cambio — nunca decora un botón, un tab o una superficie genérica.
   *Ejemplo correcto:* `.error` usa `--up` en el borde porque la app está reportando una situación
   negativa. *Antiejemplo a evitar:* usar `--official` como color de acento de un botón "Descargar"
   sin relación con la serie oficial — no ocurre hoy, se documenta como límite para fases futuras.
2. `--ink-faint` es válido para elementos no textuales pequeños o texto ≥18.66px/24px-bold; para
   texto de interfaz normal usar `--ink-soft` (regla nueva de esta fase, ver F03.4).
3. Cada superficie elevada (`--shadow`) representa algo que flota sobre el contenido (`.slicers`), no
   una tarjeta decorativa; una sección de contenido normal no lleva sombra.
4. Toda animación pasa por `--ease`/`--fast`/`--slow` y respeta el corte global de
   `prefers-reduced-motion` ya existente (`globals.css:174`) — un componente nuevo no necesita
   declarar su propio *media query*, hereda la regla `*` global.
5. `--serif` es de título/registro editorial; `--sans` de interfaz y cuerpo; `--mono` de dato técnico
   o marca de tiempo. No mezclar por preferencia puntual.

**Tokens estables** (no cambian sin romper contrato): `--ink`, `--paper`, `--panel`, `--rule`,
`--official`, `--parallel`, `--gap`, `--up`, `--down`, `--s1`…`--s5`, `--radius`, `--ease`, `--fast`,
`--slow`, capas `--z-*`.

**Decisión experimental, no estable:** el uso de `--ink-faint` en texto de interfaz queda marcado
como *a corregir*, no como regla estable — ver regla 2 arriba. Fase 05/06 decide el mecanismo exacto
(cambiar el token o cambiar los consumidores).

**Entrega a fase 05:** el piloto (`Tabs`) puede recibir su corrección de contraste (regla 2) y su
corrección de accesibilidad (H01, patrón ARIA `tablist`) en el mismo cambio, ya que ambas tocan
`tabs.tsx`/`globals.css` y son aditivas sobre la misma superficie.

## Código de producto tocado en esta fase

**Ninguno.** Esta fase es de documentación y verificación (dirección ya existente + contraste medido
sobre valores reales); las correcciones identificadas (contraste de `--ink-faint`, ARIA de `Tabs`)
quedan como condición de corrección explícita para el piloto de fase 05/06, no se implementan aquí,
siguiendo el criterio conservador pedido para esta fase.
