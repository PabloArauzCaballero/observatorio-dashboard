# Fichas de decisión — fase 02

## D01 — no reorganizar la navegación de la zona pública

- **Ubicación anterior:** `Tabs` de 7 secciones (Resumen, Tipo de cambio, Macroeconomía, Empresas,
  Ciudades, Prensa, Método) bajo `/`, con `SubTabs` contextuales en Macroeconomía y Prensa.
- **Ubicación nueva:** la misma. Sin cambios.
- **Razón:** ninguna fase previa (00, 01) encontró evidencia de que las etiquetas o el agrupamiento
  actual generen fricción, dudas o retrocesos. Las etiquetas ya son de dominio (no "gestión" ni
  nombres de carpeta de código). La especificación de UX indica explícitamente no reorganizar sin
  evidencia de problema.
- **Usuarios afectados:** ninguno — no hay cambio.
- **Compatibilidad:** no aplica.
- **Prueba de descubribilidad:** no aplica; se revisará solo si una fase posterior (03-08) presenta
  evidencia nueva.
- **Nivel de confianza:** alto (ausencia de evidencia verificada activamente en fase 01, no solo no
  buscada).

## D02 — corregir el contrato de teclado/ARIA de `Tabs`/`SubTabs` (resuelve H01)

- **Ubicación anterior:** `src/components/tabs.tsx` — declara `role="tablist"`/`role="tab"` pero solo
  soporta activación por `Tab`+clic/`Enter` en cada botón; no hay `ArrowLeft`/`ArrowRight`/`Home`/`End`
  entre pestañas del mismo `tablist`, y no hay `aria-controls`/`id`/`aria-labelledby` enlazando tab
  con panel.
- **Ubicación nueva:** mismo archivo, mismo componente — no se mueve, se completa el contrato que ya
  declara. Consumidores (`page.tsx`, `trade-explorer.tsx`) no cambian su API pública.
- **Razón:** el componente ya se anuncia a tecnología asistida como un `tablist` estándar (WAI-ARIA
  APG); cumplir solo la mitad del patrón es peor que no declarar el rol, porque genera una expectativa
  de teclado que no se cumple. Afecta al componente más usado de toda la zona pública (100% de las
  visitas pasan por `Tabs` en `page.tsx`).
- **Alcance de datos afectado:** ninguno — es interacción de UI, no toca `src/lib/*` ni contratos de
  API.
- **Usuarios afectados:** visitantes que navegan por teclado o lector de pantalla. Sin efecto para
  navegación por mouse/touch (sigue funcionando igual).
- **Compatibilidad:** aditivo — se agregan atributos y manejador de teclado; no se retiran props ni
  se cambia la firma de `labels`/`icons`/`children`. Cero riesgo de romper otros consumidores.
- **Prueba de descubribilidad:** verificación manual con teclado (flechas mueven el foco entre tabs
  del mismo `tablist`, `Home`/`End` van al primero/último, `Enter`/`Espacio` activan); `axe-core`
  cuando haya navegadores Playwright instalados (no disponible en este entorno, ver `HALLAZGOS.md`).
- **Fase de implementación:** 06 (flujo vertical piloto) — es el componente y consumidor elegidos
  como piloto en fase 01 (`HALLAZGOS.md` → F01.5).
- **Reversión:** revertir `tabs.tsx` a la versión actual; `page.tsx` sigue funcionando sin los
  atributos nuevos porque la API no cambia.

## D03 — `pager.tsx` no es el piloto (ya decidido en fase 01, se registra aquí por trazabilidad de IA)

- No es una decisión de esta fase; se documenta para que fase 04+ no reabra la pregunta sin releer
  `HALLAZGOS.md`. `pager.tsx` beneficia a 4 explorers confirmados (`city-places`, `macro`, `sources`,
  `world`), no a los ~13-14 que asumía el inventario original de fase 00. Se aborda en fase 08
  (migración del producto), no en el piloto de fase 06.
