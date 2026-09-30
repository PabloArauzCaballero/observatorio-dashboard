# Arquitectura y contratos — fase 04

## F04.1 — responsabilidades reales de `Tabs`/`SubTabs`

`src/components/tabs.tsx` exporta dos componentes de presentación pura, sin
estado de dominio ni transporte:

- **Estado:** `active: number` en memoria (React `useState`), por instancia.
  No persiste entre navegaciones ni se sincroniza con la URL. No hay
  requisito conocido de enlace profundo a una pestaña concreta.
- **Presentación:** clases CSS (`tab`, `tab-active`, `subtab`,
  `subtab-active`) y iconos (`Icon`/`IconName`), sin lógica de negocio.
- **Reglas:** ninguna — el componente no decide qué contenido mostrar, solo
  qué hijo renderizar (`children[active]`).
- **Transporte/datos:** ninguno. Los datos ya llegan resueltos a los hijos
  (`SummaryExplorer`, `MacroExplorer`, etc.) desde `page.tsx`, que es quien
  llama a `read_models` en el núcleo.

**Consumidores verificados** (`grep` real, no supuesto):
- `src/app/page.tsx`: un `<Tabs>` de nivel superior (7 secciones) y dos
  `<SubTabs>` anidados dentro de sus paneles (Macroeconomía, Prensa).
- `src/components/trade-explorer.tsx`: no usa `<Tabs>`/`<SubTabs>`
  directamente pese a mencionarse como posible consumidor en fase 00 — se
  monta como hijo de `SummaryExplorer`/`MacroExplorer`, no como wrapper de
  pestañas. Esto no cambia el contrato; se corrige aquí la suposición.

**Acoplamiento accidental detectado:** ninguno relevante — es un componente
de presentación con una única responsabilidad (interruptor de secciones).
No hay ciclos de dependencia ni conocimiento duplicado entre `Tabs` y sus
consumidores.

**Seam elegido:** el contrato de accesibilidad del propio componente
(patrón ARIA `tablist` incompleto — H01). No se toca la forma en que
`page.tsx` invoca `Tabs`/`SubTabs` (misma firma `labels`/`icons`/`children`).

## F04.2 — interfaz definida

Sin cambios en la firma pública (`labels: string[]`, `icons: IconName[]`,
`children: React.ReactNode[]`) — el cambio es aditivo, interno al
componente:

- Cada botón de pestaña tiene `id` propio (`${baseId}-tab-${index}` /
  `${baseId}-subtab-${index}`, con `baseId` generado por `useId()` de React
  para evitar colisión entre instancias, aunque hoy solo una `Tabs`/`SubTabs`
  esté montada a la vez por `page.tsx`).
- `aria-controls` en cada pestaña apunta al panel compartido
  (`${baseId}-panel` / `${baseId}-subpanel`); el panel expone
  `aria-labelledby` apuntando a la pestaña activa. Un solo panel se
  renderiza a la vez (decisión ya justificada en el comentario original del
  componente: evitar gráficos medidos en un contenedor oculto).
- `tabIndex`: roving tabindex — solo la pestaña activa tiene `tabIndex={0}`,
  el resto `-1`, como pide el patrón APG de WAI-ARIA para un `tablist`.
- Teclado: `ArrowRight`/`ArrowLeft` mueven foco y selección al vecino
  (activación automática, ya que cambiar de pestaña no dispara ninguna
  petición de red — los datos siguen ya cargados por `page.tsx`);
  `Home`/`End` saltan a la primera/última. El comportamiento se extrajo a un
  hook interno (`useTablistKeyboard`) compartido por `Tabs` y `SubTabs` para
  no duplicar la lógica de navegación.
- Estados de UI: sin cambios — `normal`, `hover`, `active`, `focus-visible`
  siguen definidos en CSS; no hay estado `disabled` ni `error` en este
  componente (no aplica: no hay operación que pueda fallar).
- Estados de negocio: no aplica — el componente no tiene ninguno.

**Garantías del backend:** no aplica a este seam — `Tabs`/`SubTabs` no
llaman a ninguna API; los datos ya llegaron resueltos a sus hijos antes de
montarse.

## F04.3 — protección de comportamiento

- No existen pruebas previas para `tabs.tsx` (`grep` de `tabs` dentro de
  `tests/` sin resultados).
- El proyecto no tiene un test runner de componentes (Jest/Vitest/Testing
  Library) en `package.json` — solo Playwright end-to-end
  (`@playwright/test`), sin navegadores instalados en este entorno (bloqueo
  ya registrado en fase 00/01). No se introduce un runner nuevo: sería una
  decisión de stack que excede el alcance de este seam y el propio encargo
  pide no migrar herramientas por preferencia personal.
- Verificación realizada en su lugar: `npm run typecheck`, `npm run lint` y
  `npm run build` (los tres comandos reales del proyecto) tras el cambio —
  ver resultados en `ESTADO.md`. Esto cubre regresión de tipos y de
  compilación, no de comportamiento de teclado en runtime.
- **Pendiente explícito:** verificación manual de teclado (Tab, flechas,
  Home/End) y de lector de pantalla en un navegador real. No se pudo
  ejecutar en este entorno (sin Playwright con navegadores ni acceso
  interactivo). Se deja como tarea abierta para fase 09/10 o para quien
  revise este incremento con un navegador a mano.

## F04.4 — migración del piloto (implementada)

Cambios en `src/components/tabs.tsx`:
- Hook interno `useTablistKeyboard(count, setActive)`: roving tabindex +
  `ArrowLeft`/`ArrowRight`/`Home`/`End`, con `event.preventDefault()` para no
  scrollear la página al navegar.
- `Tabs`: agrega `useId()`, `id`/`aria-controls`/`tabIndex` por pestaña,
  `id`/`aria-labelledby` en el panel, `onKeyDown` por botón.
- `SubTabs`: mismo patrón, con su propio namespace de ids
  (`-subtab-`/`-subpanel`).

Cambios en `src/app/globals.css` (fix H04, acotado a lo que consume
`--ink-faint` en la superficie del piloto y en `.dateline`):
- `.tab` (pestaña inactiva): `color: var(--ink-faint)` → `var(--ink-soft)`
  (3.7:1 → 7.4:1 sobre `--paper`).
- `.tab:hover`: `var(--ink-soft)` → `var(--ink)`, porque al subir el color
  de reposo a `--ink-soft` el hover había quedado idéntico al reposo y
  perdía su función de affordance; ahora la progresión reposo→hover→activo
  vuelve a ser perceptible (soft → ink → ink+subrayado+negrita).
- `.dateline`: `var(--ink-faint)` → `var(--ink-soft)`. Es una única regla
  CSS que afecta todos los usos de `.dateline` en el sitio (bylines/fechas),
  no solo el piloto — se incluyó porque es un cambio de una sola propiedad,
  sin efecto de layout, estrictamente más accesible, y coherente con la
  condición de corrección que fase 03 dejó escrita para H04. `SubTabs` no
  usaba `--ink-faint` (ya usaba `--ink-soft`), así que no requirió cambio.

**Verificación:** `npm run typecheck` (OK), `npm run lint` (OK, mismos 11
warnings preexistentes de fase 00, ninguno nuevo), `npm run build` (OK,
compila y prerrenderiza las 3 páginas estáticas, misma tabla de rutas que
el baseline). No se pudo verificar visualmente en navegador (bloqueo ya
conocido).

## F04.5 — legado y convenciones

- No queda ningún adaptador ni componente antiguo por retirar — el cambio
  fue aditivo dentro del mismo archivo, sin introducir una segunda
  implementación paralela.
- Convención para consumidores futuros de `Tabs`/`SubTabs`: seguir
  pasando `labels`/`icons`/`children` en el mismo orden (el índice es el
  contrato); no depender de los `id` generados por `useId()`, son internos.
- Deuda que sigue abierta y no se toca en esta fase (fuera del seam
  elegido): `globals.css` en un solo archivo de ~4737 líneas (H02, P3) y
  la verificación visual/de teclado en navegador real (bloqueo de entorno).

## Gate

Piloto técnicamente preparado (contrato ARIA completo, sin romper la API
existente), cambios acotados y reversibles (`git revert` del commit
recupera el estado anterior sin afectar datos), verificación automatizada
completa (`typecheck`/`lint`/`build`) y verificación manual en navegador
pendiente y declarada como tal. Condición de recuperación: si la
verificación manual encuentra un problema de foco o de lectura de pantalla,
revertir el commit de este seam sin afectar las fases 00-03 (documentación
pura, en commits separados).
