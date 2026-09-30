# Inventario — observatorio-dashboard

> Fase 00 · F00.2 y F00.3.

## Stack real (observado, no supuesto)

- **Framework**: Next.js 15.5.25, App Router, React 19.1.1. `next.config.mjs` habilita
  `experimental.serverActions`.
- **Lenguaje**: TypeScript 5.9.2, `tsc --noEmit` como check de tipos.
- **Acceso a datos**: `pg` 8.16.3 directo (sin ORM) contra Postgres, módulo `src/lib/db.ts`.
- **Gráficos**: `recharts` 3.10.1.
- **Lint**: ESLint 9 vía `next lint` (deprecado en Next 16, migración pendiente con
  `@next/codemod@canary next-lint-to-eslint-cli`).
- **Pruebas**: `@playwright/test` + `@axe-core/playwright` (accesibilidad). No hay script `test` en
  `package.json`; se invoca Playwright directo.
- **Gestor de paquetes**: npm, con `package-lock.json` presente (no crear otro lockfile). Node
  requerido ≥22.16.0 (`engines`); entorno real: Node v22.23.1, npm 10.9.8.
- **Despliegue**: Docker (`Dockerfile`, build `standalone` de Next servido con `node server.js`),
  `docker-compose.coolify.yml`, `render.yaml`, dos workflows de GitHub Actions
  (`.github/workflows/deploy.yml`, `inspect-coolify.yml`).

## Comandos reales

| Comando | Script | Resultado observado |
|---|---|---|
| Instalar | `npm install` | no ejecutado (node_modules ya presente en el checkout) |
| Desarrollo | `npm run dev` | ✅ arranca, sirve HTTP 200 en `http://localhost:3000/` (ver BASELINE.md) |
| Build | `npm run build` | ✅ compila y prerrenderiza en ~unos segundos, sin errores |
| Tipos | `npm run typecheck` | ✅ sin errores |
| Lint | `npm run lint` | ✅ corre, 11 warnings (sin errores) — detalle en BASELINE.md |
| Arrancar compilado | `npm run start` | no ejecutado |
| Pruebas e2e | `npx playwright test` | no ejecutado (requiere navegadores Playwright instalados y, para varias specs, datos reales) |

## Variables de entorno (nombres, sin valores)

- `DASHBOARD_DATABASE_URL` — cadena de conexión de solo lectura a `economic_observatory`.
- `DASHBOARD_DATABASE_SSL` — opcional, `false` solo en red Docker privada sin TLS.
- `DASHBOARD_DATABASE_POOL_MAX`, `DASHBOARD_DATABASE_ACQUIRE_MS`, `DASHBOARD_DATABASE_STATEMENT_MS`
  — ajustes opcionales del pool (`src/lib/db.ts`).
- `ADMIN_SESSION_SECRET` — firma de la cookie de sesión admin, ≥32 caracteres.
- `ADMIN_ENVIRONMENT_LABEL` — etiqueta mostrada en el shell admin (opcional, `src/app/admin/(private)/layout.tsx`).
- `PABLO_H310_TAILSCALE_AUTHKEY`, `PABLO_H310_COOLIFY_WEBHOOK`, `PABLO_H310_COOLIFY_TOKEN` — despliegue
  (documentadas en README, no confirmadas línea por línea contra el workflow en esta fase).
- Variables del cliente admin al núcleo (`src/lib/admin/core-client.ts`, `core-token.ts`) — no
  enumeradas nombre por nombre en esta fase. [pendiente, marcar en fase 01 si es relevante]

## Rutas (App Router)

### Públicas
- `/` (`src/app/page.tsx`, 15.4k líneas repartidas entre esta y los componentes que importa) — tarea
  principal: leer cifras del día, series, brecha, mapa de plazas, contexto macro.
- `/api/lugares`, `/api/mundo`, `/api/prensa`, `/api/analytics`, `/api/readers`, `/api/export`,
  `/api/version` — contratos de lectura pública. No se leyó el cuerpo de cada handler en esta fase.
- `/admin/login` — único punto de entrada sin sesión a la zona privada.

### Privadas (bajo `src/app/admin/(private)/`, todas detrás del guard de `layout.tsx`)
- `/admin` (panel), `/admin/audit`, `/admin/downloads`, `/admin/health`, `/admin/ingestion` (+
  `/admin/ingestion/runs/[agentRunId]`), `/admin/metadata`, `/admin/quality` (+
  `/admin/quality/issues/[dataIssueId]`), `/admin/seeds` (+ `/admin/seeds/runs/[seedRunId]`),
  `/admin/traffic`.
- `/api/admin/jwks`, `/api/admin/session`, `/api/admin/seeds/reconciliations`,
  `/api/admin/seeds/runs/[seedRunId]`, `/api/admin/seeds/validations`.

No se detectaron rutas huérfanas ni duplicadas en esta pasada; no se hizo un cruce exhaustivo contra
enlaces internos (pendiente para fase 01/02 si se decide reorganizar navegación).

## Tres tareas recorridas (código, sin datos reales por la cuota agotada)

1. **Principal — leer el estado cambiario del día** (`/`): compone `series`, `daily-analysis`,
   `macro-*`, `charts`, `market-cards`, `fx-explorer`. Depende de `read_models` vía `src/lib/series.ts`
   y `src/lib/daily-analysis.ts`. Estado observado: falla con mensaje de error legible cuando la base
   no responde (ver BASELINE.md), nunca cifras a medias.
2. **Consulta frecuente — explorar plazas/lugares** (`places-explorer.tsx`, `places-map.tsx`,
   `city-places-explorer.tsx`, `/api/lugares`): mapa + tabla, expuesto también en descarga
   (`map-download.ts`, `download.tsx`).
3. **Recuperación/edición — operar semillas (seeds) en admin** (`/admin/seeds`,
   `seed-console.tsx`, `seed-difference.tsx`, `/api/admin/seeds/*`): flujo de reconciliación y
   validación de datos con antes/después (`seed-difference.tsx`), propio de trabajo recurrente de un
   operador.

## Componentes y patrones repetidos

- Explorers con el mismo patrón de paginación/filtrado: `places-explorer`, `press-explorer`,
  `world-explorer`, `markets-explorer`, `trade-explorer`, `subjects-explorer`, `sources-explorer`,
  `summary-explorer`, `social-explorer`, `payments-explorer`, `macro-explorer`, `territory-explorer`,
  `filing-explorer`, `city-places-explorer` — todos usan `pager.tsx` y `tabs.tsx` como base común.
  Fuerte candidato a un patrón compartido explícito (fase 02/04), a confirmar que no ocultan
  diferencias reales de contrato de datos entre sí.
- `charts.tsx` y `macro-analysis-charts.tsx` concentran el uso de `recharts`.
- Estilos: `src/app/globals.css` (global) + `src/app/admin/admin.css` (zona admin aparte). No se
  detectó un sistema de tokens de diseño explícito en esta pasada — a confirmar en fase 03.
- `icons.tsx` centraliza iconografía propia (no se detectó librería de iconos externa en
  `package.json`).

## Funciones a preservar / contratos a respetar

- El principio del README: **nunca mostrar una cifra sin evidencia**, y **nunca promediar
  estadísticos distintos** (punto medio vs. lectura puntual, mediana discreta). Esto es lógica de
  dominio en `src/lib/series.ts`, `daily-analysis.ts`, `econometrics.ts`, `macro-stats.ts` — no
  debe tocarse por motivos visuales.
- Autocorrección de la base de datos en `src/lib/db.ts` (ver comentarios del propio archivo): si la
  cadena declarada apunta a `postgres` (mantenimiento) se corrige a `economic_observatory`, y si la
  corrección es rechazada por el servidor vuelve a la cadena declarada. Comportamiento a preservar
  tal cual; documentado en memoria de proyecto como incidente ya resuelto.
- Auth admin: guard de servidor en el layout privado, cookie firmada `HttpOnly`, CSRF por cabecera
  (`x-obs-csrf`), sesión de 60 minutos. No debilitar al tocar la UI admin.
- `/api/export` y `/api/series.csv` (mencionado en README, confirmar ruta exacta en fase 01) como
  contrato de descarga pública — preservar formato de columnas.
