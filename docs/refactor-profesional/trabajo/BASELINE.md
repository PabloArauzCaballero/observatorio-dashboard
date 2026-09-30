# Baseline — observatorio-dashboard

> Fase 00 · F00.4. Punto de partida antes de cualquier cambio. Todo lo aquí anotado se ejecutó
> realmente en esta sesión, sobre el checkout en rama `dev`, working tree limpio antes de copiar
> el kit (`git log` más reciente: `3a81e25 Give the admin nav a mobile shape...`).

## Checks ejecutados

| Comando | Resultado | Detalle |
|---|---|---|
| `npm run typecheck` | ✅ OK | Sin salida de `tsc --noEmit` → sin errores de tipos. |
| `npm run lint` | ✅ OK (con warnings) | 11 warnings, 0 errores. `next lint` avisa que está deprecado en Next 16 y sugiere migrar a la CLI de ESLint — anotar como deuda técnica, no como regresión futura. |
| `npm run build` | ✅ OK | Compila en ~3.3s, prerrenderiza 3 páginas estáticas, resto dinámicas (`ƒ`). Mismos 11 warnings de lint durante el build. |
| `npm run dev` + `curl http://localhost:3000/` | ✅ arranca, responde `HTTP 200` | Ver defecto preexistente abajo: la portada respondió 200 mostrando su propio estado de error, no las cifras. |
| `npx playwright test` (suite completa) | **No ejecutado** | Requiere navegadores de Playwright instalados y, para varias specs, una base con datos reales. Queda para fase 09/10 o antes si se decide instalar navegadores. |
| Captura de escritorio/móvil | **No ejecutado** | No se tomó captura en esta fase; el HTML servido se guardó como texto (`/tmp/home.html`, 26 879 bytes), no como imagen. |

## Warnings de lint (detalle, no bloqueantes)

`src/app/page.tsx`: 10 variables/imports sin usar (`Download`, `readChannelMix`,
`readTradeCoverage`, `readTradeGap`, `readTradeReadings`, `ChannelMix`, `TradeCoverage`, `TradeGap`,
`TradeReading`, `Stat`, `latestByIndicator`).

`src/components/places-map.tsx:633`: `useLayoutEffect` con dependencias incompletas
(`react-hooks/exhaustive-deps`) — riesgo real de actualización en cadena, no solo estilo.

## Defecto preexistente confirmado en esta sesión (no confundir con regresión futura)

**La base de datos configurada en `.env.local` no tiene cuota disponible (proveedor Neon):**

```
[observatorio] lectura fallida error: Your project has exceeded the data transfer quota.
Upgrade your plan to increase limits.
  at async buildGap (src\lib\series.ts:199:20)
  code: '53000'
```

Con esto, `npm run dev` sirve la portada igual, con `HTTP 200` y el propio mensaje de error del
producto ("no shows figures it cannot verify" — el README lo describe como comportamiento
intencional: *"Los errores no se muestran... la página dice que no pudo leerla"*). Esto **no es un
defecto de UX que la refactorización deba resolver como bug**: es el comportamiento diseñado del
producto ante una base inalcanzable. Sí es una limitación real de esta sesión: **no se pudo
observar el tablero con datos reales**, así que cualquier evidencia visual de "portada con cifras"
queda pendiente hasta tener una base con cuota o una base local poblada.

Coincide con una nota ya registrada en memoria de proyecto (sesiones previas: "Neon sin cuota en
local"), así que no es nuevo, pero se deja registrado aquí con la traza exacta de este intento.

## Medición de carga/interacción

No se instrumentó ninguna métrica de rendimiento (Lighthouse, Web Vitals de laboratorio, etc.) en
esta fase por falta de herramienta configurada y de datos reales para ejercitar una carga
representativa. Cualquier cifra de rendimiento que se reporte en fases posteriores debe declarar
explícitamente que es de laboratorio y con qué configuración se obtuvo — no hay baseline numérico
todavía.

## Estado de accesibilidad

No ejecutado (`tests/diagnostics/axe-report.spec.ts` existe pero no se corrió; requiere Playwright
instalado). Se registra como pendiente, no como "sin problemas".
