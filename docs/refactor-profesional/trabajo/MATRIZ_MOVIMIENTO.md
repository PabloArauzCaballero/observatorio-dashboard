# Matriz de movimiento — piloto Tabs/SubTabs

> Fase 07. Verificado con Playwright real contra `npm run dev` (misma ruta temporal
> `smoke-tabs-temp` de fase 06, contenido marcado `data-mock="true"`, borrada al terminar,
> nunca comiteada).

## Tokens (ya existentes, fase 03 los inventarió)

| Token | Valor | Uso en el piloto |
|---|---|---|
| `--ease` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | curva de todas las transiciones/animaciones del piloto |
| `--fast` | 160ms | `color`/`border-color` de `.tab` en hover/activo |
| `--slow` | 420ms | animación `rise` de entrada del panel |

No se crea ningún token nuevo — el sistema ya cubría lo que este componente necesita.

## Inventario de interacciones (F07.1)

| Interacción | Feedback | Propiedad | Duración/curva | Disparador |
|---|---|---|---|---|
| Hover en tab/subtab inactivo | cambio de color (`--ink-soft`→`--ink`), subtab también cambia fondo | `color`, `background` | `--fast`/`--ease` (140ms en subtab, valor propio ya existente) | mouse; **no aplica en táctil** (no hay estado hover persistente en touch, es un no-problema: el tap activa directo) |
| Click/tap en tab | cambia `aria-selected`, subrayado (`Tabs`) o fondo sólido (`SubTabs`), remonta el panel | `border-bottom-color`/`background`, `color` | `--fast`/`--ease` para el control; el panel entra con `rise` | click, tap, `Enter`/`Space` sobre el tab enfocado |
| Foco de teclado | outline 2px `--official` | `outline` (sin transición, aparece inmediato) | instantáneo | `Tab`, flechas |
| Navegación por flechas/Home/End | mueve foco + selección a la vez (activación automática) | ninguna transición propia — dispara el mismo cambio de "click" | igual que click | `ArrowLeft/Right/Home/End` |
| Entrada del panel | los hijos directos del contenido aparecen con `rise` (opacity 0→1, translateY 10px→0), escalonado 0/70/140/210ms | `opacity`, `transform` | 420ms (`--slow`) por hijo, con stagger | remount del panel (cambio de tab) |

No hay controles "silenciosos": todo cambio de estado (hover, foco, selección) tiene un cambio visual
inmediato verificado en código y en navegador real.

## F07.2 — patrones (ya implementados, sin cambios nuevos)

- La acción funcional (cambiar `aria-selected`, remontar el panel) ocurre en el mismo tick de React
  que el click/tecla — no espera a que termine ninguna animación decorativa.
- No hay `transition: all` en ningún selector de `.tab`/`.subtab` (se listan propiedades explícitas:
  `color`, `border-color`, `background`).
- Geometría estable: los botones no cambian de tamaño al pasar a estado activo (solo cambia
  `font-weight`, y la fuente ya reserva ese espacio con `font-variation-settings` — confirmado
  visualmente en fase 06, sin salto de layout entre estados).

## F07.3 — interrupción y preferencias (verificado con navegador real en esta fase)

- **Cambio rápido entre tabs:** como el panel se remonta (`key={active}`) en vez de esconderse con
  CSS, no existe una animación de salida que pueda quedar "a medias" — cada cambio empieza una
  entrada nueva desde cero. No hay cola de animaciones que limpiar.
- **`prefers-reduced-motion: reduce` emulado con Playwright:** confirmado con
  `getComputedStyle().animationName` → `"none"` y `animationDuration` → `"0s"` en los hijos del
  panel (antes, sin la preferencia: `"rise"` / `"0.42s"` con el stagger esperado). La regla global
  (`* { animation: none !important; transition-duration: 1ms !important; }`) cubre el piloto sin
  necesitar una excepción local.
- El estado final (contenido correcto, foco conservado en el tab activo) es el mismo con y sin
  movimiento reducido — la animación es decorativa, nunca la única señal de que el cambio ocurrió
  (el `aria-selected`/subrayado/fondo ya lo comunican sin movimiento).

## F07.4 — perfilado

**No ejecutado.** No hay datos reales disponibles en esta sesión (cuota de Neon agotada) para una
carga representativa del panel "Resumen"; perfilar contra contenido simulado de 3 párrafos no
produciría una medición útil. Queda como pendiente explícito, igual que en fases anteriores — no se
inventa una cifra de rendimiento.

## F07.5 — revisión y gate

- Coherencia espacial: el stagger (0/70/140/210ms) da una sensación de "ensamblado" consistente en
  cualquier panel con múltiples hijos directos; no hay panels con retraso acumulado excesivo (tope
  210ms observado, tokens ya lo acotan a 4 hijos).
- Sin dependencia nueva: todo el movimiento es CSS/`@keyframes` nativo, ninguna librería de animación
  se introdujo.
- **Gate de fase 07: aprobado, sin cambios de código necesarios.** El sistema de movimiento ya
  existente (tokens, `panel-enter`, regla global de `prefers-reduced-motion`) cubre el piloto
  completo; se verificó con navegador real en vez de darlo por sentado por lectura de código. Pendiente
  explícito: perfilado con datos reales (bloqueado por Neon, igual que en fases anteriores).
