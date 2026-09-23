# Mapa UX — fase 02 (zona pública)

> Consume `HALLAZGOS.md` y `PLAN_SITUADO.md` (fase 01). Alcance: zona pública (`/`). `/admin` fuera
> de alcance. Sin datos reales (cuota Neon agotada) — el modelo de tareas se verificó leyendo código
> y el estado degradado real, no con datos de producción.

## F02.1 — modelo de tareas

Hay una sola página pública (`src/app/page.tsx`) organizada en 7 secciones dentro de un `Tabs`
(`role="tablist"`). No hay rutas separadas por sección — todo vive bajo `/`, lo que ya evita el
problema típico de "dónde está X" entre páginas distintas.

| Tarea | Rol | Disparador | Info necesaria | Decisión | Acción | Resultado |
|---|---|---|---|---|---|---|
| **T1 — Consultar el informe del día** (principal) | Visitante sin cuenta | Llega a `/` (enlace directo o búsqueda) | Tipo de cambio oficial, paralelo, brecha, fecha del último dato | Ninguna decisión previa: la portada abre en "Resumen" | Leer | Entiende la situación cambiaria del día sin clics adicionales |
| **T2 — Profundizar en una sección** (frecuente) | Visitante | Ya está en `/`, quiere un tema concreto (macro, empresas, ciudades, prensa) | Sabe qué sección busca por nombre de dominio (no técnico) | Elegir pestaña | Clic o `Tab`+`Enter` en la pestaña | Ve el panel de esa sección, resto del informe sigue accesible por pestañas |
| **T3 — Comparar series / exportar** (consulta secundaria) | Visitante avanzado | Está viendo una sección con series | Formato deseado (CSV/imagen, según `Download`) | Elegir qué exportar | Clic en control de descarga junto al gráfico | Obtiene el archivo sin perder el contexto de la sección |
| **T4 — Recuperación ante datos faltantes** | Cualquiera | Una sección no se leyó a tiempo o la fuente falló | Qué falta y por qué | Ninguna acción posible del lado del usuario | Ninguna (solo lectura del aviso) | Entiende que falta un dato puntual (`callout`) o que el informe entero no tiene evidencia suficiente (página de error), nunca ve una cifra sin respaldo |

No hay pasos que existan solo para compensar mala organización: T1 y T2 se resuelven en la misma
pantalla, sin navegación intermedia. No se propone eliminar ningún paso de T3 (el control de
descarga por sección es intencional, no fricción — mismo lugar en cada sección, ver comentario en
`page.tsx`).

## F02.2 — organización de navegación

**Se mantiene la organización actual.** No hay evidencia (ni en fase 00 ni en fase 01) de que las
etiquetas o el agrupamiento actuales confundan a alguien; son nombres de dominio (Resumen, Tipo de
cambio, Macroeconomía, Empresas, Ciudades, Prensa, Método), no jerga técnica ni carpetas de código.
Reorganizar sin evidencia iría contra la regla de la especificación ("¿no hay evidencia de
problema? no reorganizar masivamente").

Clasificación de lo que ya existe (para que fase 04+ no la mezcle):
- **Navegación global** (entre secciones del informe): `Tabs` de nivel 1, 7 destinos.
- **Navegación contextual** (dentro de una sección con más de una vista): `SubTabs` de nivel 2 —
  usado hoy en Macroeconomía (Series de Bolivia / Bolivia ante el mundo) y en Prensa (Cobertura / Temas).
- **Herramientas de la vista** (actúan sobre lo que se está viendo, no navegan): control de
  descarga (`Download`) junto a cada gráfico, filtros propios de cada explorer.
- **Aviso de estado** (no es navegación ni herramienta): el `callout` de secciones perdidas y la
  página de error del informe — son T4, no una quinta categoría de menú.

El único cambio de arquitectura de información que sí se justifica con evidencia es a nivel de
**contrato del componente**, no de organización: `Tabs`/`SubTabs` declaran `role="tablist"` /
`role="tab"` / `role="tabpanel"` (el contrato ARIA de pestañas) pero no cumplen la mitad del
contrato — ver H01 y la ficha en `DECISIONES.md`. Corregirlo no mueve nada de sitio; hace que la
relación entre pestaña y panel que ya existe visualmente también exista para teclado y lectores de
pantalla.

## F02.3 — movimientos documentados

**Ninguno.** No se propone mover, renombrar ni reagrupar ninguna sección de la zona pública en esta
fase — ver F02.2. Si una fase posterior (03-08) encuentra evidencia nueva que justifique un
movimiento, debe abrir su propia ficha en `DECISIONES.md` con ubicación anterior/nueva,
compatibilidad y prueba de descubribilidad, tal como pide la especificación; no se anticipa aquí sin
evidencia.

## F02.4 — wireframe de comportamiento (piloto: `Tabs` + "Resumen")

Representación textual (sin datos reales disponibles, se listan los estados reales del código).

**Escritorio, ancho ≥ 768px:**
```
[ Resumen* ] [ Tipo de cambio ] [ Macroeconomía ] [ Empresas ] [ Ciudades ] [ Prensa ] [ Método ]
--------------------------------------------------------------------------------------------------
(callout, solo si perdidas.size > 0) "No se pudieron leer a tiempo estas secciones: …"

<panel activo = Resumen>
  Cifras principales (oficial, paralelo, brecha, fecha)   [Download]
  Tarjetas de mercado (MarketCards)
  Análisis del día (bullets)
  Cobertura (contadores: series diarias, macro anuales, hechos relevantes, días con brecha)
</panel>
```
- Orden DOM y foco: `nav[role=tablist]` → botones de pestaña en orden visual → `div[role=tabpanel]`
  con el contenido activo. Con la corrección de H01, `Home`/`End`/flechas deben mover el foco
  *dentro* de la lista de pestañas sin abandonar el `tablist`; `Enter`/`Espacio` activan.
- Permanece visible al cambiar de pestaña: el propio `tablist` (no se oculta ni se reconstruye) y
  el `callout` de secciones perdidas si aplica a cualquier sección.

**Móvil, ancho < 768px:** mismo componente, sin menú oculto adicional — las 7 pestañas ya son pocas
y estables; envolver en un menú oculto solo escondería destinos que hoy son visibles, contra el
criterio de "no copiar automáticamente toda la sidebar dentro de un menú oculto" (aplicado aquí a
top navigation en vez de sidebar). No verificado visualmente en 320-360px en esta fase (ver
`HALLAZGOS.md` → "No verificado"); pendiente cuando se pueda abrir el dev server con navegador.

**Estado vacío/error (T4), ya presente hoy sin necesidad de datos reales:**
```
(callout) "No se pudieron leer a tiempo estas secciones: Empresas, Prensa. El resto del informe
es correcto y está al día; lo que falta volverá cuando la consulta que lo arma deje de agotar su
plazo."
```
o, si falla la columna vertebral (tipo de cambio / brecha), página de error explícita en vez de
cifras parciales (verificado en fase 00/01, ver "No son hallazgos" en `HALLAZGOS.md`). Ninguno de
los dos estados necesita cambios en esta fase — ya cumplen el criterio de no mostrar una cifra sin
evidencia.

## F02.5 — revisión heurística (sin participantes)

No hay usuarios disponibles para validar en este entorno — esto es una **revisión heurística**, no
una prueba con usuarios; no se declara como investigación con usuarios (ver especificación
`01_UX_Y_REORGANIZACION.md` → "Validación formativa"). Protocolo pendiente si en el futuro hay
participantes: tarea neutral "Encuentra cuántos días de brecha cambiaria hay registrados y compara
paralelo vs. oficial de hoy", sin mencionar la palabra "pestaña" ni "tab".

Resultado de la revisión heurística (heurísticas de Nielsen aplicadas al `tablist`):
- **Visibilidad del estado del sistema:** cumple — `aria-selected` y clase `tab-active` marcan la
  pestaña activa.
- **Coincidencia con el mundo real:** cumple — etiquetas de dominio, no técnicas.
- **Control y libertad del usuario:** parcial — con mouse/`Tab` se navega libremente; con flechas
  (patrón esperado del rol `tablist`) no, porque no está implementado (H01).
- **Consistencia y estándares:** falla en el mismo punto — el componente declara el rol ARIA
  estándar de pestañas pero no completa su contrato de teclado ni la relación
  `aria-controls`/`aria-labelledby`.
- **Prevención de errores / diseño minimalista:** cumple — no hay controles redundantes ni pasos de
  compensación.

No se ajusta el modelo de tareas a partir de esta revisión porque no reveló fricción de
organización, solo el problema de accesibilidad ya registrado como H01. Se entrega a fase 03 la
navegación actual sin cambios de agrupamiento, y a fase 04+ el cambio de contrato de `Tabs`/`SubTabs`
descrito en `DECISIONES.md`.
