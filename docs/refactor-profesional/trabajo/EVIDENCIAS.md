# Evidencias — flujo vertical piloto (fase 06)

## Entorno de verificación

- Herramienta: Playwright real (Chromium, vía MCP), navegando contra `npm run dev` en
  `http://localhost:3000`. Primera vez en este kit con navegador disponible (fases 00-05 no lo
  tenían instalado en el entorno).
- Datos: **no reales**. La cuota de Neon seguía agotada durante esta sesión, así que `/` muestra el
  estado `Unreadable` diseñado del producto (ver `BASELINE.md`), no la pestaña "Resumen" con
  contenido. Para verificar el comportamiento de `Tabs`/`SubTabs` en sí (navegación, teclado, ARIA,
  responsive) se usó una ruta temporal `src/app/smoke-tabs-temp/page.tsx`, con contenido
  explícitamente marcado `data-mock="true"` y el texto "Contenido simulado — no son datos reales del
  Observatorio". **Esta ruta se creó, se usó y se borró dentro de esta misma sesión — no se comiteó
  en ningún momento** (confirmado con `git status` antes de cada commit de esta fase).
- Esto verifica el **contrato del componente** (lo que le corresponde a este piloto), no el flujo de
  datos reales de principio a fin — eso sigue bloqueado por la cuota de Neon, igual que en fases
  anteriores.

## F06.1 — recorrido válido (con contenido simulado)

- Carga inicial: pestaña "Resumen" activa por defecto, `role="tablist"`/`role="tab"`/`role="tabpanel"`
  presentes y correctamente enlazados (`aria-controls`, `aria-labelledby`) — verificado con
  `browser_snapshot` (accesibilidad real del DOM, no solo el código fuente).
- Clic en "Tipo de cambio": cambia `aria-selected`, cambia el panel, renderiza `SubTabs` anidados
  correctamente.

## F06.2 — no aplica en esta fase

No hay validación de formulario, escritura ni rechazo de servidor en este piloto (es navegación de
lectura pura). No se fuerza ni se documenta un caso que no existe.

## F06.3 — continuidad

- `ArrowRight` en el nivel superior: mueve foco Y selección a la siguiente pestaña (activación
  automática), confirmado con `document.activeElement`.
- `End` / `Home`: saltan al último/primer tab respectivamente.
- `Tab` (fuera del tablist activo): el roving tabindex funciona — los botones inactivos tienen
  `tabIndex=-1` y no reciben foco; `Tab` desde el tablist superior activo aterriza directo en el
  subtab activo del panel (confirmado, salta los subtabs inactivos también).
- `ArrowRight` dentro de `SubTabs` anidado: cambia de "Cómo comercia" a "Con qué liquida", cambia el
  subpanel (`Sub B (simulado)`), sin afectar el tablist superior.

## F06.4 — rol y dispositivo

- Rol: solo hay un rol relevante para esta pantalla (visitante público, sin sesión) — `/admin` está
  fuera de alcance, no se verificó.
- Escritorio (viewport por defecto del navegador MCP): capturado, foco visible correcto (outline
  azul `--official`), jerarquía activo/inactivo legible tras el fix de contraste H04.
- **Móvil (375×667): encontró un defecto real — H05** (`.subtabs` se deformaba en una cápsula al
  envolver a 3 filas). Corregido en esta misma fase (`border-radius: 999px` → `1.25rem`). Recapturado
  después del fix: contenedor se ve como riel redondeado normal, sin cápsula.
- Teclado: cubierto arriba (F06.3). Lector de pantalla real (NVDA/VoiceOver): **no verificado** —
  fuera del alcance de lo que Playwright headless puede ejercitar; sigue como pendiente explícito.
- Medición de carga/interacción: no instrumentada — no hay datos reales para una carga representativa
  (mismo bloqueo de fases anteriores).

## F06.5 — aprendizaje

- La causa de H05 es sistémica al patrón, no un caso aislado: cualquier `SubTabs` con 3+ opciones de
  etiqueta larga en un viewport angosto habría mostrado el mismo problema. Se corrigió en el token del
  componente (`.subtabs`), no con un parche por instancia — ninguna sección individual necesitó su
  propio ajuste.
- Confirma el valor de haber podido, por fin, ejercitar el componente con un navegador real: los
  hallazgos H01/H04 (fases 01/03) se habían identificado por lectura de código; H05 solo apareció al
  ver el layout renderizado en un viewport angosto.
- **Gate de fase 06: aprobado con alcance explícito.** El contrato del componente piloto (`Tabs`/
  `SubTabs`) está demostrado con navegador real, incluidos teclado, ARIA, anidamiento y un defecto de
  responsive encontrado y corregido en el mismo incremento. **No demostrado:** el flujo con datos
  reales de principio a fin (depende de que se resuelva la cuota de Neon) y la verificación con lector
  de pantalla real. No se marca como "100% verificado" — se declara el alcance real.

## Verificación de código

- `npm run typecheck` → OK.
- `npm run lint` → OK, mismos 11 warnings preexistentes, ninguno nuevo.
- `npm run build` → OK, sin la ruta temporal (confirmado que `smoke-tabs-temp` no aparece en la
  tabla de rutas del build final).
