# Entrega — kit de refactor UX/UI, piloto Tabs/SubTabs/Pager

> Fase 11, última del kit. Rama `refactor-ux-ui-profesional` (desde `dev`), 10 commits, **sin push,
> sin fusionar**. La decisión de integrar a `dev` (y por tanto desplegar vía Coolify) es del usuario.

## F11.1 — qué cambió, en términos de producto

**Alcance de esta pasada: la zona pública del tablero (`/`), específicamente la navegación por
secciones (`Tabs`) y sub-secciones (`SubTabs`), y el paginador (`Pager`) que usan 4 de sus 15
"explorers". `/admin` no se tocó — decisión del usuario en fase 00.**

- **Navegación por teclado, antes rota, ahora completa:** antes, un visitante que navegaba con
  teclado solo podía pasar de pestaña en pestaña con `Tab` (una por una, sin flechas, sin `Home`/
  `End`), y un lector de pantalla no anunciaba qué panel correspondía a qué pestaña. Ahora: flechas
  izquierda/derecha y `Home`/`End` mueven entre pestañas (también dentro de las sub-secciones
  anidadas de Macroeconomía y Prensa), y cada panel está correctamente asociado a su pestaña
  (`aria-controls`/`aria-labelledby`). Confirmado con navegador real, no solo por código.
- **Texto que antes no se leía bien, ahora sí:** la pestaña inactiva, la fecha de publicación
  (`.dateline`) y el contador de página del paginador ("21–40 de 86") usaban un gris que no llegaba
  al contraste mínimo legal/estándar (AA) sobre fondo claro. Ahora sí lo cumplen — confirmado con
  medición real, no aproximada.
- **Un defecto visual en móvil, encontrado y corregido en el mismo trabajo:** las sub-pestañas (el
  segundo nivel de navegación, dentro de Macroeconomía y Prensa) se deformaban en una forma de
  cápsula extraña en pantallas angostas (~375px) cuando no cabían en una fila. Ahora se ven como un
  riel redondeado normal en cualquier ancho.
- **Nada de la navegación cambió de lugar** — la fase de UX (02) encontró que la organización actual
  ya funciona bien y no hay evidencia de que reubicar algo mejore la tarea. Ningún enlace ni atajo
  aprendido por un visitante recurrente dejó de funcionar.
- **Ninguna regla de negocio ni dato cambió** — todos los cambios son de accesibilidad y de un
  ajuste visual responsive; nada tocó cómo se leen, calculan o transportan los datos del núcleo.

**No se puede mostrar una comparación antes/después con datos reales de producción** porque la
cuota de transferencia de la base de datos (Neon) estuvo agotada durante las 11 fases de este trabajo
— se declara esta limitación en vez de simularla. Las capturas disponibles (fases 06-07,
`EVIDENCIAS.md`) usan contenido explícitamente marcado como simulado.

## F11.2 — mantenimiento

- **Dónde viven los tokens:** `src/app/globals.css`, bloque `:root` (líneas ~1-90 aprox., ver
  `trabajo/DIRECCION_VISUAL.md` para el catálogo con rol semántico de cada uno). No hay build de CSS
  (sin PostCSS/Tailwind) — son variables CSS nativas, se editan directamente ahí.
- **Dónde vive el componente del piloto:** `src/components/tabs.tsx` (`Tabs`, `SubTabs`, y el hook
  privado `useTablistKeyboard` que ambos comparten). `src/components/pager.tsx` para paginación.
- **Cómo añadir una variante sin romper el contrato:** `Tabs`/`SubTabs` reciben `labels`/`icons`/
  `children` (arrays paralelos) — cualquier nueva sección de `/` que use este patrón simplemente
  agrega un elemento a esos tres arrays en `page.tsx` o `trade-explorer.tsx`; el comportamiento ARIA/
  teclado se hereda automáticamente, no hay que reimplementarlo por instancia.
- **Cómo ejecutar los checks reales:** `npm run typecheck`, `npm run lint`, `npm run build`. Para
  e2e: `npx playwright install chromium` (una vez; ya estaba en caché en esta máquina) y luego
  `E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/public-visual.spec.ts
  --project=chromium` contra `npm run dev` corriendo. Requiere datos reales para pasar (por diseño
  del proyecto, ver comentario en `playwright.config.ts`) — con la cuota de Neon agotada, fallará en
  el mismo punto documentado en `QA_FINAL.md`, no por un defecto de este cambio.
- **Skills actualizadas:** `.claude/skills/ui-atomic-solid`, `ui-visual-system`, `ui-states-recovery`
  — cada una con una nota de aprendizaje de este proyecto en su `references/decisiones.md` (fase 05).

## F11.3 — gobernanza de excepciones

Este proyecto no tiene un equipo de diseño dedicado — el mismo repositorio es mantenido por su autor.
No se inventan roles ni responsables que no existen. Proceso breve, proporcional al tamaño del
proyecto:

- **Proponer un patrón visual/de interacción nuevo:** antes de introducirlo, confirmar que resuelve
  una tarea real (no "se ve mejor"), que reutiliza un token existente cuando sea posible, y que
  define sus estados (normal/hover/foco/error según aplique) desde el principio — no después.
- **Deprecación:** cuando un componente reemplace a otro, dejar una nota en el componente viejo con
  la condición de retiro (ej. "retirar cuando ningún import lo use" — verificable con `grep`).
  Ninguna deprecación de este tipo quedó pendiente en este trabajo (todos los cambios fueron
  aditivos sobre los mismos archivos).
- **Deuda aceptada vs. defecto que bloquea:** un defecto bloquea si es P0/P1 (pérdida de datos,
  acceso indebido, o impide una tarea principal). Todo lo demás es deuda a registrar con su causa y
  condición de revisión — ver H06b abajo.

## F11.4 — integración y reversión

- **Diff:** 7 commits de código+docs sobre `dev` (ver lista completa en `QA_FINAL.md`), tocan
  únicamente `src/components/tabs.tsx`, `src/app/globals.css`, y `docs/refactor-profesional/`
  (más `.claude/skills/`, nuevo). Ningún otro archivo de producto.
- **Riesgos para quien revise:** ninguno de severidad alta — son cambios aditivos de accesibilidad y
  un ajuste responsive, verificados con typecheck/lint/build en verde y 0 violaciones axe. El riesgo
  real es el ya conocido: no hay verificación end-to-end con datos reales (bloqueado por Neon), así
  que el comportamiento con contenido real de producción no se demostró en este entorno — sí se
  demostró el contrato del componente con contenido simulado declarado como tal.
- **Reversión:** esta rama no se fusionó a `dev`. Si se decide fusionar y luego se encuentra un
  problema, revertir es `git revert` de los commits de código (`bca103d`, `f0c2c10`, `e7cde0d`) — no
  hay migración de datos ni cambio de esquema que revertir, son archivos de frontend puro.
- **Sin despliegue:** no se pusheó nada, no se abrió PR. Autorización insuficiente para publicar —
  el propio encargo lo prohíbe sin permiso explícito. Queda listo para que el usuario decida.

## F11.5 — estado final y seguimiento

- **Última versión verificada:** commit `6ade9d9` (fase 10, QA final) en `refactor-ux-ui-profesional`.
- **Pendientes concretos, con condición de cierre:**

| Pendiente | Condición de cierre |
|---|---|
| H06b — `--ink-faint` sistémico (60+ usos fuera del piloto) | Triage con contenido real cuando se resuelva la cuota de Neon, o antes de ampliar este refactor más allá del piloto actual |
| Verificación e2e con datos reales | Cuando se resuelva la cuota de Neon — correr `tests/e2e/public-visual.spec.ts` de nuevo, debería pasar sin cambios adicionales |
| Lector de pantalla real (NVDA/VoiceOver) | Cuando haya acceso a un entorno con uno instalado |
| Rendimiento de campo | Cuando haya datos reales para una carga representativa |
| H02 — `globals.css` monolítico (4737 líneas) | P3, sin condición de cierre definida — no bloquea nada, es una decisión de mantenibilidad a futuro |
| Fusionar `refactor-ux-ui-profesional` a `dev` | Decisión del usuario |

- **Prompt de continuación** (si otra sesión retoma este trabajo): "Lee
  `docs/refactor-profesional/trabajo/ENTREGA.md` y `ESTADO.md`. El piloto (Tabs/SubTabs/Pager de la
  zona pública) está completo y verificado en la rama `refactor-ux-ui-profesional`. Antes de seguir,
  confirma con el usuario: (1) si ya se resolvió la cuota de Neon, para correr la verificación e2e
  con datos reales pendiente; (2) si se debe fusionar esta rama a `dev`; (3) si se debe ampliar el
  alcance más allá del piloto actual (fase 08 dejó fuera 11 de los 15 explorers por no compartir
  componente con el piloto) o atacar H06b."

## Gate final

R01-R14 (ver `ESPECIFICACION_OBJETIVO.md`) trazados dentro del alcance de este piloto: navegación por
tareas conservada (D01), estados completos para el componente migrado, ningún dato inventado, textos
claros, dirección visual consistente y medida, movimiento con alternativa reducida verificada,
arquitectura de componente sin fragmentación, 0 P0/P1, evidencia de QA real (no solo compilación).
**Entrega autocontenida:** toda decisión, hallazgo y pendiente vive en `docs/refactor-profesional/
trabajo/`, no en esta conversación.
