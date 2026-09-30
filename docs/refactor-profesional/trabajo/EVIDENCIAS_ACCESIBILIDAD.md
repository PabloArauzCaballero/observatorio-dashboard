# Evidencias de accesibilidad y rendimiento — fase 09

## F09.1 — recorrido con teclado (reutiliza evidencia de fase 06, no repetida aquí)

`Tab`, `ArrowLeft/Right/Home/End` en ambos niveles (`Tabs` y `SubTabs` anidado) ya verificados con
navegador real en fase 06 (`EVIDENCIAS.md`): roving tabindex correcto, foco nunca se pierde ni queda
atrapado, `Tab` desde el tablist superior activo aterriza directo en el subtab activo (salta los
inactivos en ambos niveles). No hay overlays/modales en el alcance de este piloto (zona pública, sin
`/admin`) que revisar por trampas de foco.

## F09.2 — accesibilidad automatizada y manual

**Herramienta:** axe-core 4.10.2 (cargado desde CDN, cdnjs, directamente en el navegador real vía
Playwright), reglas WCAG 2A + 2AA. Primera vez que este kit puede correr un análisis automatizado
real (fases 00 solo tenía Playwright sin navegadores instalados).

| Superficie | Violaciones | Reglas que pasaron |
|---|---|---|
| `/` en su estado real actual (`Unreadable`, Neon sin cuota) | 0 | 15 |
| Piloto con contenido simulado: `Tabs` + `SubTabs` anidado + `Pager` con datos de prueba | 0 | 20 |

**Cero violaciones no significa "100% accesible"** — axe cubre lo que puede detectar
automáticamente (~30-40% de los criterios WCAG según su propia documentación). Lo que SÍ confirma:
los fixes de contraste (H04, H06) y de ARIA (H01) de este kit resuelven lo que axe puede medir en la
superficie del piloto, sin introducir una regresión nueva.

**Lector de pantalla real (NVDA/VoiceOver/JAWS): NO probado.** Sigue fuera del alcance de lo que este
entorno puede ejercitar (headless, sin lector de pantalla instalado). Declarado como pendiente, no
como aprobado.

**Contraste:** medido con fórmula WCAG sobre valores reales en fase 03 (tokens del piloto) y
confirmado sin violaciones por axe en esta fase. La deuda H06b (usos de `--ink-faint` fuera del
piloto) permanece sin medir — axe solo escaneó las superficies del piloto (`/` y la ruta de
verificación), no el resto de componentes de la zona pública que este kit no migró.

**Reflow / zoom:** no re-verificado en esta fase — cubierto por inspección de media queries en
fases anteriores (`HALLAZGOS.md`, sección "no verificado" original), sigue igual.

## F09.3 — rendimiento

**No medido.** Sin datos reales (cuota de Neon agotada durante toda esta sesión), no hay una carga
representativa que perfilar — medir contra contenido simulado de 3 párrafos no produciría una cifra
comparable al baseline real. Mismo bloqueo declarado desde fase 00.

## F09.4 — corrección de causas

Nada nuevo que corregir en esta fase: los tres hallazgos de accesibilidad del piloto (H01, H04, H06)
ya se corrigieron en las fases donde se encontraron (04 y 08), en el componente compartido, no con
parches por instancia — por eso el escaneo de esta fase salió limpio.

## F09.5 — pendientes y su tratamiento

| Pendiente | Severidad | Tratamiento | Condición de revisión |
|---|---|---|---|
| H06b — `--ink-faint` sistémico fuera del piloto (60+ usos) | Deuda de accesibilidad, no P0/P1 | No corregir a ciegas; requiere triage con contenido real | Cuando se resuelva la cuota de Neon, o antes de decidir extender este refactor más allá del piloto actual |
| Lector de pantalla real | Verificación pendiente | Declarado explícitamente, no bloquea el piloto (axe + revisión manual de roles/nombres ya dan cobertura razonable) | Cuando haya acceso a un entorno con lector de pantalla real |
| Rendimiento de campo | Verificación pendiente | Declarado explícitamente | Cuando haya datos reales para una carga representativa |

**Ningún defecto P0/P1 abierto en el alcance de este piloto.** No hay bloqueo para fase 10 (QA y
regresión) por accesibilidad o rendimiento — los pendientes son de alcance ampliado (más allá del
piloto) o de entorno (sin datos/sin lector de pantalla), no defectos conocidos dentro de lo migrado.

**Gate de fase 09: aprobado, con limitaciones explícitas** (no se declara "100% accesible" ni "sin
errores" — axe confirma ausencia de violaciones automatizables en la superficie del piloto,
únicamente).
