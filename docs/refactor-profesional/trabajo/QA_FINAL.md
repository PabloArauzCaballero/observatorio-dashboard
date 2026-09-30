# QA final — fase 10

## F10.1 — candidato

- **Commit del candidato:** `ab425bd` (HEAD de `refactor-ux-ui-profesional` al momento de esta
  fase; los cambios de esta misma fase 10 se comitean después de este documento).
- **Rama:** `refactor-ux-ui-profesional`, creada desde `dev`, sin push ni fusión.
- **Datos:** no reproducibles con contenido real — la cuota de transferencia de Neon sigue agotada
  durante toda esta sesión (00 a 10). Las pruebas contra `/` corren sobre el estado de error real del
  producto, no sobre datos de prueba fijados; se declara así, no se oculta.
- **Navegadores:** Chromium vía Playwright (`@playwright/test`, proyecto `chromium` de
  `playwright.config.ts`); también Chromium vía el MCP de Playwright para verificación manual
  interactiva (fases 06, 07, 09).
- **Suites aplicables (Q01-Q16 del kit) a este alcance (zona pública, piloto):** build, tipos, lint,
  `tests/e2e/public-visual.spec.ts` (UI-02, UI-03 del proyecto), `tests/diagnostics/axe-report.spec.ts`
  (no corrida en detalle esta fase, redundante con el axe manual de fase 09 sobre la misma causa de
  bloqueo). `tests/e2e/admin-*.spec.ts` fuera de alcance (`/admin` excluido desde fase 00).

## F10.2 — checks y flujos

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK, sin errores |
| `npm run lint` | OK, 11 warnings preexistentes, 0 errores, ninguno nuevo desde el baseline de fase 00 |
| `npm run build` | OK, compila y prerrenderiza |
| `npx playwright test tests/e2e/public-visual.spec.ts --project=chromium` (contra `npm run dev` real, `E2E_BASE_URL=http://127.0.0.1:3000`) | **6/6 fallan**, los 6 en el mismo punto: `expect(tablist "Secciones del informe").toBeVisible()` nunca se cumple porque `/` muestra el estado `Unreadable` en vez de contenido. **Causa confirmada, no supuesta:** captura de pantalla y consola de cada fallo muestran literalmente "No fue posible leer la base de datos" con el error real de Neon ("Your project has exceeded the data transfer quota"), el mismo bloqueo declarado desde `BASELINE.md` (fase 00). Ningún fallo se debe a un cambio de este kit. |

**No se confunden estos 6 fallos con "aprobado" ni con "no ejecutado":** se ejecutaron de verdad,
fallaron de verdad, y la causa está confirmada con evidencia (no es una suposición). Es la primera
vez en este kit que la suite existente del proyecto se corrió contra un navegador real instalado
(`npx playwright install chromium` funcionó en esta sesión — los navegadores sí estaban disponibles
en caché de esta máquina, a diferencia de lo asumido en fase 00, que no llegó a intentar la
instalación). Evidencia (no comiteada, `artifacts/` está en `.gitignore`): capturas, video y trace
por cada fallo en `artifacts/e2e/output/`.

## F10.3 — regresión visual

Las 4 capturas por viewport (1440×900, 1280×800, 768×1024, 390×844) y la de zoom 200% que el spec
intenta generar **no se produjeron** — el test falla antes de llegar a `page.screenshot()` porque el
tablist nunca aparece. No hay regresión visual que comparar contra un baseline con datos reales
porque nunca existió un baseline con datos reales en este kit (mismo bloqueo). Las capturas
manuales de fases 06-07 (piloto con contenido simulado, declarado como tal) son la única evidencia
visual disponible y ya están documentadas en `EVIDENCIAS.md`/`MATRIZ_MOVIMIENTO.md`.

## F10.4 — revisión de producto

- **Descubribilidad:** sin cambios de navegación (decisión D01 de fase 02) — nada que re-verificar
  aquí.
- **Reglas de negocio:** ningún cambio de este kit tocó lógica de dominio, cálculo o transporte de
  datos — todos los cambios fueron de accesibilidad (ARIA, contraste) y un ajuste de `border-radius`
  responsive. Confirmado por el propio diff acumulado (ver lista de commits abajo): solo
  `tabs.tsx` y `globals.css`.
- **Reubicaciones:** ninguna — decisión D01 de fase 02 mantuvo la navegación existente.

## F10.5 — cierre de defectos

**Historial de hallazgos de todo el kit:**

| ID | Severidad | Estado |
|---|---|---|
| H01 | P2 | Corregido (fase 04) |
| H02 | P3 | Sin corregir — bajo impacto, no forma parte del alcance del piloto |
| H03 | P3 | Sin corregir — deuda preexistente (`next lint` deprecado), no introducida por este kit |
| H04 | P2 | Corregido (fase 04) |
| H05 | P3 | Corregido (fase 06) |
| H06 | P2 | Corregido (fase 08) |
| H06b | Deuda registrada | Tratamiento y condición de revisión definidos (fase 09), sin corregir a propósito |

**Cero P0/P1 en todo el kit.** No hay defecto abierto que bloquee el candidato dentro del alcance
acordado (zona pública, componente `Tabs`/`SubTabs`/`Pager`).

**Commits de este incremento** (rama `refactor-ux-ui-profesional`, ninguno pusheado a `dev`):

```
717d9aa docs: kit de refactor UX/UI + diagnóstico fases 00-03
bca103d feat(a11y): completa el patrón ARIA tablist en Tabs/SubTabs y sube contraste de texto tenue
fced283 docs(fase05): catálogo de estados del piloto Tabs y skills del kit instaladas
f0c2c10 fix(mobile): corrige la cápsula del riel de SubTabs al envolver filas en móvil
aaf60b3 docs(fase07): confirma con navegador real que el movimiento del piloto ya cumple
e7cde0d fix(a11y): extiende el fix de contraste de H04 al paginador (H06)
ab425bd docs(fase09): axe-core real confirma 0 violaciones WCAG en el piloto
```

## Decisión de candidato

**Candidato LISTO dentro del alcance acordado** (zona pública, piloto `Tabs`/`SubTabs`/`Pager`,
`/admin` excluido): typecheck/lint/build en verde, 0 violaciones WCAG automatizables (axe), 0
defectos P0/P1, todos los hallazgos del piloto corregidos con evidencia verificable, y el único
bloqueo real (datos de Neon) es externo a este kit, pre-existente, y confirmado como causa exacta de
los 6 fallos del e2e — no un defecto introducido por este trabajo.

**No listo para fusionar a `dev` automáticamente:** eso es una decisión del usuario, no de este kit
(ver `ESPECIFICACION_OBJETIVO.md`/`PROMPT_MAESTRO.md`: "no publiques... sin autorización suficiente").
Queda pendiente de decisión humana en fase 11 (entrega y gobierno).
