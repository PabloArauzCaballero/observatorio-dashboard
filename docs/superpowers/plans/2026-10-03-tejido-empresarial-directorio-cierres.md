# Tejido empresarial: directorio y cierres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al tejido empresarial un directorio nominal descargable como Excel, una nube de palabras de razones sociales y una lectura destacada y actualizada de cierres empresariales.

**Architecture:** El núcleo amplía la serie oficial de cancelaciones con las memorias del SEPREC; el tablero consulta los registros nominales del SEPREC ya publicados en `read_models.national_place`, declara su cobertura parcial y genera el Excel en el servidor. La página carga directorio y nube bajo demanda, manteniendo liviana la API agregada existente.

**Tech Stack:** TypeScript, Node.js 22, PostgreSQL, Next.js 15, React 19, ExcelJS, Jest, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-03-tejido-empresarial-directorio-cierres-design.md`

## Global Constraints

- No rotular el directorio como completo mientras sólo estén cargados los registros nominales disponibles.
- No exportar teléfonos, correos ni otros datos personales excluidos por los colectores actuales.
- «Cierre empresarial» significa cancelación de matrícula; no significa falta de renovación, quiebra ni insolvencia.
- Conservar filtros, lenguaje visual, fuentes visibles y estados de error del tablero existente.
- El archivo descargado debe ser `.xlsx` real, con hojas `Empresas` y `Metadatos`.
- Años o dimensiones no publicados permanecen ausentes, nunca se convierten en cero.

## Review Focus

- Razones sociales con tildes, puntuación, siglas y formas societarias: la nube debe unir variantes sin perder la forma legible.
- Matrículas o identificadores con ceros iniciales: el Excel debe conservarlos como texto.
- Registros repetidos entre entregas: el directorio debe devolver una sola fila por `place_id`.
- Filtros sin resultados: la API y la interfaz deben informar cero sin generar un libro vacío engañoso.
- Fuente nominal no disponible o sin permisos: la página agregada debe seguir funcionando y declarar el estado del directorio.

---

### Task 1: Completar cancelaciones oficiales de 2022 y 2023

**Files (EcomicDataCenter):**
- Modify: `scripts/business/registry-flow-sources.ts`
- Modify: `scripts/business/registry-flow-seprec.ts`
- Modify: `scripts/business/collect-registry-flows.ts`
- Modify: `src/database/seeds/boot/business-registry-flows.json`
- Create: `src/database/seeds/tests/business-registry-flows.spec.ts`

**Interfaces:**
- Consumes: filas devueltas por `pdfRows` y el tipo `Candidate` del colector existente.
- Produces: `seprecCancelled(rows: readonly PdfRow[], year: string): SeprecFigure[]` y candidatos `FIRMS_CANCELLED_*` para 2022 y 2023.

- [ ] **Step 1: Write the failing parser and series tests**

Probar con filas literales que 2022 produce el total consistente `3339` (gráfico nacional y suma de nueve departamentos; la frase `2491` es una errata interna documentada), que 2023 produce total `3945` y departamentos como La Paz `1299`, y que un desglose cuya suma no coincide con el total es rechazado.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- --runTestsByPath src/database/seeds/tests/business-registry-flows.spec.ts`

Expected: FAIL porque `seprecCancelled` no existe.

- [ ] **Step 3: Implement the official-memory readers**

Declarar las dos memorias oficiales y sus páginas en `registry-flow-sources.ts`; implementar `seprecCancelled` en `registry-flow-seprec.ts`; convertir sus lecturas a candidatos con publicador, URL, huella y fecha en `collect-registry-flows.ts`.

- [ ] **Step 4: Regenerate the flow seed and verify GREEN**

Run: `npm run business:flows`

Run: `npm test -- --runTestsByPath src/database/seeds/tests/business-registry-flows.spec.ts`

Expected: PASS; la semilla contiene cancelaciones nacionales 2022/2023 y los desgloses sostenidos por cada memoria.

- [ ] **Step 5: Commit**

```bash
git add scripts/business/registry-flow-sources.ts scripts/business/registry-flow-seprec.ts scripts/business/collect-registry-flows.ts src/database/seeds/boot/business-registry-flows.json src/database/seeds/tests/business-registry-flows.spec.ts
git commit -m "feat: completar cierres empresariales del SEPREC"
```

### Task 2: Modelo y API del directorio nominal

**Files (observatorio-dashboard):**
- Create: `src/lib/business-directory-words.ts`
- Create: `src/lib/business-directory.ts`
- Create: `src/app/api/tejido-empresarial/directorio/route.ts`
- Create: `tests/unit/tejido-directorio.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `BusinessDirectoryRow`, `BusinessDirectoryMeta`, `BusinessNameTerm`, `readBusinessDirectory(filters)` y `businessNameTerms(names, limit)`.
- API: `GET /api/tejido-empresarial/directorio?departamento=&municipio=&buscar=&palabra=&pagina=` devuelve `{ rows, total, terms, meta, page, pageSize }`.

- [ ] **Step 1: Write failing word-normalization and filter-contract tests**

Probar que `S.A.`, `SRL`, `Empresa`, `Comercial`, `Servicios`, `Bolivia`, conectores, números y tokens cortos no aparecen; `Águila` y `AGUILA` se suman; el límite es 40 y las frecuencias se ordenan de mayor a menor. Añadir una prueba del contrato de consulta que deduplica dos filas con el mismo `place_id`, conserva una matrícula textual y devuelve cero filas con metadatos `PARCIAL` cuando el filtro no coincide.

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test tests/unit/tejido-directorio.test.mjs`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implement normalization, the database reader and paginated route**

Consultar `read_models.national_place` con `publisher = 'SEPREC'`, `status = 'PUBLISHED'`, `NOT superseded` y `NOT outside_country`; seleccionar únicamente identificador, nombre, departamento, municipio, dirección, familia, licencia y fecha disponible. Deduplicar por `place_id`, parametrizar todos los filtros y devolver `coverage: 'PARCIAL'` con el total exacto.

- [ ] **Step 4: Verify GREEN and type safety**

Run: `node --test tests/unit/tejido-directorio.test.mjs`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/business-directory-words.ts src/lib/business-directory.ts src/app/api/tejido-empresarial/directorio/route.ts tests/unit/tejido-directorio.test.mjs package.json
git commit -m "feat: exponer directorio empresarial nominal"
```

### Task 3: Excel real con todas las filas autorizadas

**Files (observatorio-dashboard):**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/business-directory-workbook.ts`
- Create: `src/app/api/tejido-empresarial/excel/route.ts`
- Modify: `tests/unit/tejido-directorio.test.mjs`

**Interfaces:**
- Consumes: `BusinessDirectoryRow[]`, `BusinessDirectoryMeta` y filtros de Task 2.
- Produces: `writeBusinessDirectoryWorkbook(stream, rows, meta)` y `GET /api/tejido-empresarial/excel?...` con MIME XLSX y nombre fechado.

- [ ] **Step 1: Write the failing workbook test**

Generar un libro con dos empresas, reabrirlo con ExcelJS y afirmar hojas `Empresas`/`Metadatos`, tildes intactas, identificador `00123` como texto, autofiltro y ausencia de teléfono/correo. Añadir casos que rechacen una exportación sin filas y metadatos que permitan descarga cuando `redistributable` sea falso.

- [ ] **Step 2: Run test to verify RED**

Run: `node --test tests/unit/tejido-directorio.test.mjs`

Expected: FAIL porque el escritor no existe.

- [ ] **Step 3: Install ExcelJS and implement server-side workbook generation**

Run: `npm install exceljs`

Usar el escritor XLSX de ExcelJS; congelar encabezados, aplicar autofiltro, añadir metadatos de fuente/cobertura/corte y rechazar exportaciones sin filas. La ruta reutiliza exactamente los filtros de Task 2.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/unit/tejido-directorio.test.mjs`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/business-directory-workbook.ts src/app/api/tejido-empresarial/excel/route.ts tests/unit/tejido-directorio.test.mjs
git commit -m "feat: descargar empresas en Excel"
```

### Task 4: Nube de nombres y cierres destacados en la interfaz

**Files (observatorio-dashboard):**
- Create: `src/components/business-directory-panel.tsx`
- Modify: `src/components/business-fabric-explorer.tsx`
- Modify: `src/components/business.module.css`
- Modify: `src/lib/asistente/guia.ts`
- Modify: `tests/unit/tejido-empresarial.test.mjs`

**Interfaces:**
- Consumes: API paginada y API Excel de Tasks 2–3, `FabricBoard.firms` con `CANCELLED` de Task 1.
- Produces: panel buscable/paginado, nube de 40 nombres pulsables y bloque «Cierres (cancelaciones de matrícula)» con último total y serie.

- [ ] **Step 1: Write failing presentation-model tests**

Añadir aserciones para el rótulo de cierres, para conservar ausencias como `null` y para que filtros y enlace de Excel serialicen los mismos parámetros. Añadir un caso de API nominal no disponible que mantenga visible el tablero agregado con un aviso recuperable.

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test tests/unit/tejido-empresarial.test.mjs tests/unit/tejido-directorio.test.mjs`

Expected: FAIL por faltar el modelo/enlace nuevo.

- [ ] **Step 3: Implement the directory panel and closure emphasis**

El panel muestra cobertura y cantidad exacta, buscador, filtros disponibles, nube accesible, tabla paginada y botón Excel. En el explorador, renombrar la medida a «Cierres» y añadir una tarjeta/panel dedicado que explique qué mide y qué no mide.

- [ ] **Step 4: Verify GREEN, responsive behavior and accessibility**

Run: `node --test tests/unit/tejido-empresarial.test.mjs tests/unit/tejido-directorio.test.mjs`

Run: `npm run typecheck`

Run: `npm run build`

Expected: PASS, sin errores ni avisos nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/components/business-directory-panel.tsx src/components/business-fabric-explorer.tsx src/components/business.module.css src/lib/asistente/guia.ts tests/unit/tejido-empresarial.test.mjs tests/unit/tejido-directorio.test.mjs
git commit -m "feat: mostrar nube de empresas y cierres"
```

### Task 5: Verificación integrada, publicación en `test` y comprobación real

**Files:**
- Modify only if verification exposes a defect covered by a new failing test.

**Interfaces:**
- Consumes: commits de Tasks 1–4.
- Produces: ramas `test` de ambos repositorios y despliegue verificable en `https://test.datosbolivia.com`.

- [ ] **Step 1: Run complete verification in EcomicDataCenter**

Run: `npm test`

Run: `npm run typecheck`

Run: `npm run build`

Expected: exit 0 for all commands.

- [ ] **Step 2: Run complete verification in observatorio-dashboard**

Run: `npm run test:unit`

Run: `npm run typecheck`

Run: `npm run build`

Expected: exit 0 for all commands.

- [ ] **Step 3: Review the complete diff against the spec**

Confirmar uno por uno: cobertura honesta, datos personales excluidos, Excel real, nube filtrable, cierres 2022/2023, ausencias no convertidas en cero y fuentes visibles.

- [ ] **Step 4: Push isolated commits and integrate without overwriting remote work**

Actualizar referencias remotas, comprobar que `origin/test` no se movió de forma incompatible, integrar mediante fast-forward o merge normal y ejecutar `git push origin test` en cada repositorio. Nunca usar force-push.

- [ ] **Step 5: Confirm deployed behavior**

Esperar el despliegue de Contabo y verificar en `https://test.datosbolivia.com`: `/api/version`, `/api/tejido-empresarial`, `/api/tejido-empresarial/directorio`, descarga XLSX con firma ZIP (`PK`) y la página pública sin mensaje de error de base.

- [ ] **Step 6: Record final evidence**

Informar hashes publicados, comandos y resultados de pruebas, hora de arranque/despliegue observada, conteo real del directorio, cobertura declarada y años disponibles de cierres.
