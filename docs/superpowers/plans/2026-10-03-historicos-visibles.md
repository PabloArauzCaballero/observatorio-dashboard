# Históricos visibles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer inmediatamente los históricos de empresarios, pasajes y fletes bolivianos.

**Architecture:** Reordenar presentación y valores iniciales sin modificar contratos de API ni inventar datos. Extraer la tabla de pasajes a un componente/página reutilizable y mantener el tablero automotor concentrado en parque, clases, capacidad, GNV y fuentes.

**Tech Stack:** Next.js 15, React 19, TypeScript, node:test, Playwright CLI.

**Spec:** `docs/superpowers/specs/2026-10-03-historicos-visibles-design.md`

## Global Constraints

- Preservar los contratos actuales de `/api/empresarios`, `/api/transporte-terrestre` y `/api/exogenas`.
- No unir referencias de fletes con unidades incompatibles en una serie falsa.
- Mantener carga diferida por página mediante `useOnOpen`.
- No sobrescribir cambios ajenos.

## Review Focus

- Un tablero de empresarios vacío no debe intentar seleccionar una persona inexistente.
- El empresario inicial debe provenir del último año, no del orden de carga.
- Pasajes debe seguir mostrando ambas regulaciones y sus 60 filas.
- Fletes sin `FREIGHT_BO` debe conservar un producto inicial válido.
- Navegación por URL debe abrir `Transporte › Pasajes` y conservar los destinos existentes.

---

### Task 1: Ficha histórica de empresarios visible

**Files:**
- Modify: `src/components/business-owners-explorer.tsx`
- Modify: `src/components/business.module.css`
- Test: `tests/unit/tejido-empresarial.test.mjs`

**Interfaces:**
- Consumes: `OwnersBoard.histories`, `OwnersBoard.estimates`, `OwnersBoard.podiums`.
- Produces: selección inicial estable y ficha visible antes del podio.

- [ ] **Step 1: Write the failing test** que exige selector de nombres, selección inicial y ficha antes del podio.
- [ ] **Step 2: Run test to verify it fails** con `node --test tests/unit/tejido-empresarial.test.mjs`.
- [ ] **Step 3: Implement** la selección inicial, el selector visible, el reordenamiento y el desplazamiento/foco al cambiar desde ranking o podio.
- [ ] **Step 4: Run test to verify it passes** con el mismo comando.
- [ ] **Step 5: Commit** `feat: hacer visible el historial de empresarios`.

### Task 2: Pasajes como página principal

**Files:**
- Create: `src/components/fares-explorer.tsx`
- Create: `src/components/fares-section.tsx`
- Modify: `src/components/road-transport-explorer.tsx`
- Modify: `src/components/transport-section.tsx`
- Modify: `src/lib/asistente/guia.ts`
- Test: `tests/unit/road-transport.test.mjs`
- Test: `tests/unit/asistente-enlaces.test.mjs`

**Interfaces:**
- Consumes: `RoadTransportBoard.fares` desde `/api/transporte-terrestre`.
- Produces: página principal `Pasajes`, componente `FaresExplorer` y navegación directa.

- [ ] **Step 1: Write the failing test** para la pestaña principal, 60 tarifas y eliminación de la subpestaña escondida.
- [ ] **Step 2: Run tests to verify they fail** con `node --test tests/unit/road-transport.test.mjs tests/unit/asistente-enlaces.test.mjs`.
- [ ] **Step 3: Implement** extracción, carga diferida y actualización de guía/navegación.
- [ ] **Step 4: Run tests to verify they pass** con el mismo comando.
- [ ] **Step 5: Commit** `feat: mostrar pasajes como pagina de transporte`.

### Task 3: Histórico boliviano de fletes por defecto

**Files:**
- Modify: `src/components/exogenous-explorer.tsx`
- Test: `tests/unit/road-transport.test.mjs`

**Interfaces:**
- Consumes: series `FREIGHT_BO` con ámbito `BOLIVIA_CUSTOMS`.
- Produces: producto inicial recomendado y referencias nacionales antes de las series mundiales.

- [ ] **Step 1: Write the failing test** para el producto inicial `FREIGHT_BO`, ámbito boliviano, primera lectura total y orden de referencias.
- [ ] **Step 2: Run test to verify it fails** con `node --test tests/unit/road-transport.test.mjs`.
- [ ] **Step 3: Implement** valores iniciales resilientes y reordenamiento de referencias.
- [ ] **Step 4: Run test to verify it passes** con el mismo comando.
- [ ] **Step 5: Commit** `feat: priorizar el historico boliviano de fletes`.

### Task 4: Verificación, integración y despliegue

**Files:**
- Verify only unless a regression requires a TDD fix.

**Interfaces:**
- Consumes: commits de Tasks 1–3.
- Produces: `origin/test` desplegado y comprobado públicamente.

- [ ] **Step 1: Run** `npm run test:unit`, `npm run typecheck` y `npm run build`.
- [ ] **Step 2: Review** el diff completo contra esta especificación.
- [ ] **Step 3: Push** la rama e integrar con fast-forward o cherry-pick seguro en `test`.
- [ ] **Step 4: Wait for Contabo** hasta que el despliegue termine y el contenedor nuevo esté saludable.
- [ ] **Step 5: Verify** APIs y las tres vistas con Playwright CLI.
