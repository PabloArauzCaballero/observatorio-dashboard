# Transporte Integral de Bolivia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar parque automotor histórico, actividad GNV, tarifas interdepartamentales y fletes verificables dentro de Transporte.

**Architecture:** El núcleo normaliza archivos oficiales en tres modelos de lectura y el dashboard los consume por una sola interfaz `readRoadTransport()`. La presentación deriva series y filtros en funciones puras; Fletes reutiliza el tablero exógeno existente fijado a su familia, sin duplicar lecturas.

**Tech Stack:** TypeScript estricto, NestJS/Sequelize/PostgreSQL/Zod/Jest en el núcleo; Next.js 15/React 19/Recharts/node:test en el dashboard; Python 3 para el recolector XLSX reproducible.

**Spec:** `docs/superpowers/specs/2026-10-03-transporte-integral-design.md`

## Global Constraints

- Publicar sólo cifras verificables de archivos fuente; conservar URL, recuperación, SHA-256 y tabla o resolución.
- Tratar bandas ATT como regulación, no como precios observados; cero no ofrecido se vuelve `null`.
- No mezclar flete implícito, índices y cotizaciones aisladas como una misma serie.
- Preservar las modificaciones ajenas de los checkouts compartidos; trabajar sólo en los worktrees dedicados.
- No añadir dependencias de producción para leer XLSX.

## Review Focus

- Un año preliminar o incompleto debe rotularse y no compararse como año cerrado.
- Filas `TOTAL` no deben sumarse otra vez con sus aperturas.
- Tildes y variantes (`POTOSÍ`/`POTOSI`, `Público`/`PUBLICO`) deben normalizarse sin perder el rótulo legible.
- Una categoría tarifaria con cero debe quedar ausente, no aparecer gratis.
- Un modelo nuevo ausente durante un despliegue escalonado debe degradar sólo esa subpestaña.

---

### Task 1: Snapshot oficial y contrato del núcleo

**Files:**
- Create: `EcomicDataCenter/scripts/transport/build_road_transport_seed.py`
- Create: `EcomicDataCenter/src/database/seeds/boot/bolivia-transport-network/road-transport.json`
- Modify: `EcomicDataCenter/src/database/seeds/schemas/bolivia-transport-network.schema.ts`
- Test: `EcomicDataCenter/src/database/seeds/tests/road-transport.spec.ts`

**Interfaces:**
- Produces: `roadTransportSeedSchema`, `RoadTransportSeed`, `FleetPoint`, `GnvPoint`, `FareBand`.

- [ ] **Step 1: Write failing schema and invariant tests** for source hashes, 2003/2025 endpoints, national totals, bus/micro/minibus presence, GNV preliminary flags, 30 ATT routes and null service categories.
- [ ] **Step 2: Run `yarn test road-transport.spec.ts --runInBand`** and confirm failure because the schema and seed do not exist.
- [ ] **Step 3: Implement the strict Zod contract and XLSX/table collector** with no new runtime dependency; generate the JSON snapshot.
- [ ] **Step 4: Run the focused test and schema validators** and confirm all official literals match.
- [ ] **Step 5: Commit the snapshot, collector, contract and test.**

### Task 2: Persistencia y modelos de lectura

**Files:**
- Create: `EcomicDataCenter/src/database/seeds/runners/boot-seed.bolivia-transport-network.road.ts`
- Modify: `EcomicDataCenter/src/database/seeds/runners/boot-seed.bolivia-transport-network.ts`
- Modify: `EcomicDataCenter/src/database/seeds/manifest.ts`
- Create: `EcomicDataCenter/src/database/migration-sql/0098-read-the-road-transport-economy.view.ts`
- Create: `EcomicDataCenter/src/database/migrations/0098-read-the-road-transport-economy.ts`
- Test: `EcomicDataCenter/src/database/seeds/tests/road-transport.spec.ts`

**Interfaces:**
- Consumes: `RoadTransportSeed` and `writeTransportRows(...)`.
- Produces: `read_models.vehicle_fleet`, `read_models.gnv_activity`, `read_models.intercity_fare_band`.

- [ ] **Step 1: Add failing tests** that inspect the loader payloads and migration view contract through exported pure row builders.
- [ ] **Step 2: Run the focused suite** and observe missing exports.
- [ ] **Step 3: Implement artifact-aware row builders, loader, manifest bump, views, indexes and grants.**
- [ ] **Step 4: Run focused tests, migration verification, typecheck and lint.**
- [ ] **Step 5: Commit the storage/read-model slice.**

### Task 3: Interfaz profunda y tablero derivado

**Files:**
- Modify: `observatorio-dashboard/src/lib/transport.ts`
- Modify: `observatorio-dashboard/src/lib/transport-board.ts`
- Test: `observatorio-dashboard/tests/unit/road-transport.test.mjs`

**Interfaces:**
- Produces: `readRoadTransport(): Promise<RoadTransportData>` and `buildRoadTransportBoard(data: RoadTransportData): RoadTransportBoard`.

- [ ] **Step 1: Write failing node tests** for latest metrics, hierarchy-safe totals, bus/micro/minibus grouping, tariff nulls and year-over-year change.
- [ ] **Step 2: Run `node --test tests/unit/road-transport.test.mjs`** and confirm the missing exports fail.
- [ ] **Step 3: Implement the three-query adapter behind `readRoadTransport` and pure board builder.**
- [ ] **Step 4: Run focused and full dashboard unit suites.**
- [ ] **Step 5: Commit the dashboard data seam.**

### Task 4: Automotor y pasajes en la interfaz

**Files:**
- Create: `observatorio-dashboard/src/app/api/transporte-terrestre/route.ts`
- Create: `observatorio-dashboard/src/components/road-transport-explorer.tsx`
- Create: `observatorio-dashboard/src/components/road-transport-section.tsx`
- Modify: `observatorio-dashboard/src/components/transport-section.tsx`
- Modify: `observatorio-dashboard/src/app/globals.css`

**Interfaces:**
- Consumes: `{ board: RoadTransportBoard }` from `/api/transporte-terrestre`.

- [ ] **Step 1: Add the route and explorer against the tested board interface.**
- [ ] **Step 2: Add metrics, view/filter controls, charts, complete tables and methodology/source cards.**
- [ ] **Step 3: Insert `Automotor y pasajes` as the first Transport subtab and verify loading/empty/error states.**
- [ ] **Step 4: Run typecheck, lint and build; fix only failures caused by this slice.**
- [ ] **Step 5: Commit the user-facing page.**

### Task 5: Fletes integrados y exportación

**Files:**
- Modify: `observatorio-dashboard/src/components/exogenous-explorer.tsx`
- Create: `observatorio-dashboard/src/components/freight-section.tsx`
- Modify: `observatorio-dashboard/src/components/transport-section.tsx`
- Modify: `observatorio-dashboard/src/app/api/export/route.ts`
- Modify: `observatorio-dashboard/src/lib/asistente/alcance.ts`
- Modify: `observatorio-dashboard/src/lib/asistente/guia.ts`
- Test: `observatorio-dashboard/tests/unit/road-transport.test.mjs`

**Interfaces:**
- Produces: `ExogenousExplorer({ board, fixedGroup?: 'FREIGHT' })`; export dataset `transporte-terrestre`.

- [ ] **Step 1: Add failing tests** for complete export rows and assistant classification of parque automotor, pasajes, micros and interdepartamental.
- [ ] **Step 2: Run tests and observe the expected missing behavior.**
- [ ] **Step 3: Reuse the exogenous freight family in a fixed Transport subtab; add same-source CSV/JSON export and assistant vocabulary.**
- [ ] **Step 4: Run focused and full unit suites, typecheck, lint and build.**
- [ ] **Step 5: Commit fletes, export and discoverability.**

### Task 6: Integración, despliegue y comprobación real

**Files:**
- Modify only deployment metadata if the existing test workflow requires it.

**Interfaces:**
- Consumes: both completed feature branches.
- Produces: healthy `test` branches and a verified `https://test.datosbolivia.com` deployment.

- [ ] **Step 1: Run all core tests, dashboard tests, both typechecks, lints and builds; record exact results.**
- [ ] **Step 2: Review both branch diffs for unrelated files, secrets, generated junk and source/data mismatches.**
- [ ] **Step 3: Push only the two feature branches and integrate them into each remote `test` branch without overwriting concurrent work.**
- [ ] **Step 4: Monitor the existing CI/deployment path until both test deployments finish.**
- [ ] **Step 5: Verify HTTP health and browser behavior on `test.datosbolivia.com`, including the new tabs, API payloads and one CSV download.**

