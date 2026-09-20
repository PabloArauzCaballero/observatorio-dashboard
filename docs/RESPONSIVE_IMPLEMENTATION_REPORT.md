# Informe de implementación — auditoría y mejora responsiva

Fecha: 2026-09-20 (dos pasadas: auditoría + implementación inicial, y una segunda pasada de cierre
de pendientes). Ver también `RESPONSIVE_AUDIT_AND_IMPLEMENTATION_PLAN.md`,
`RESPONSIVE_DESIGN_SYSTEM.md` y `RESPONSIVE_TEST_MATRIX.md`.

## 0. Hallazgo fuera de alcance que hay que leer igual: vulnerabilidad crítica corregida

Al configurar ESLint (sección 3) `npm audit` reveló que la versión de Next.js fijada en el
proyecto (**15.5.23**) tiene una vulnerabilidad **crítica** publicada: ejecución remota de código
no autenticada en servidores Windows, más otra RCE no autenticada en la API de optimización de
imágenes con archivos AVIF ([GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36),
[GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)). No es algo introducido
en esta sesión — estaba en el `package.json` ya commiteado.

**Se corrigió**: `next` actualizado a **15.5.25**, el backport oficial de seguridad para la misma
serie 15.5.x (no es un salto de versión mayor). `npm audit fix` adicional resolvió una
vulnerabilidad alta heredada de `sharp`. Verificado con `npm run typecheck` y `npm run build`
después del cambio — ambos limpios. Queda **una vulnerabilidad alta sin corregir** (`postcss`,
heredada de `next`) cuyo único arreglo disponible es saltar a Next 16, un cambio mayor que está
fuera del alcance de esta sesión — no se fuerza sin que el equipo lo decida.

Esto no tiene relación con el diseño responsivo, pero descartarlo habría sido negligente.

## 1. Resumen de cambios

El diagnóstico inicial encontró una app ya construida con disciplina responsiva. El trabajo real
fue cerrar brechas puntuales, y una segunda pasada — pedida explícitamente para no dejar nada
pendiente — reemplazó varias conclusiones "revisado, sin verificación visual disponible" por
verificación real en Chromium, encontró un bug genuino que la primera pasada había descartado por
error, y cerró dos huecos de herramientas (lint roto, dependencia vulnerable).

1. Navegación del panel admin: menú colapsable — **verificado visualmente** en 390/850/1280px.
2. Tokens de z-index y referencia de breakpoints documentada.
3. `.card-sector` ya no se superpone con los botones de `.card-tools` en pantallas de 320px con
   el rótulo de sector más largo real del catálogo — **bug encontrado y corregido en esta
   segunda pasada**, verificado antes/después.
4. Sombra de scroll en tablas anchas (`.table-wrap`, `.admin-scroll`) — implementada y verificada
   visualmente, algo que la primera pasada había evaluado y descartado por falta de herramientas.
5. Cobertura E2E extendida al sitio público (0 → 15 tests).
6. ESLint configurado (no existía) y Next.js actualizado por la vulnerabilidad crítica (sección 0).

## 2. Problemas detectados

Ver tabla completa en `RESPONSIVE_AUDIT_AND_IMPLEMENTATION_PLAN.md` sección 5, actualizada con el
resultado real de cada uno tras la verificación visual.

## 3. Problemas resueltos

| ID | Resuelto cómo | Verificación |
|---|---|---|
| H1 | Nav admin colapsable (`admin-shell.tsx`, `admin.css`). | Capturas en 390/850/1280px, overflow medido en 0 en los cuatro estados (cerrado/abierto/tablet/desktop). |
| H5 | Sombra de scroll en `.table-wrap` y `.admin-scroll`. | Capturas antes/después de desplazar a 390px; confirmado que aparece/desaparece en el borde correcto. |
| M1 | `.card-head:has(.card-toggle) .card-sector { max-width: calc(100% - 6rem) }`. | Bug reproducido con el rótulo real más largo a 320px, corregido, reverificado en 320/360/390/430px y confirmado sin efecto en tarjetas sin `.card-toggle`. |
| H3 / B1 | Tokens `--z-*` y referencia de breakpoints. | `npm run build` limpio; mismos valores numéricos, cero cambio visual por construcción. |
| — | ESLint configurado (`.eslintrc.json`, `eslint-config-next` fijado a `^15.5.25` tras un primer intento que instaló la versión 16 e hizo fallar el comando). | `npm run lint` corre limpio: 0 errores, 12 warnings preexistentes. |
| — | Next.js 15.5.23 → 15.5.25 (vulnerabilidad crítica). | `npm audit`, `npm run typecheck`, `npm run build`. |

## 4. Problemas revisados y descartados (con evidencia, no con suposición)

| ID | Por qué no se tocó |
|---|---|
| H4 (`.rail` 264px) | Medido en Chromium en 7 anchos entre 721-1280px: nunca hay overflow, y por debajo de 900px el `.rail` nunca es de 264px (la propia regla `@media (max-width:900px)` ya lo pone en columna). La severidad "Alto" original estaba mal calibrada — no había banda de riesgo real. |
| M2 (`.slicer` range 200px) | El bloque CSS `.slicer`/`.slicers`/`.slicer-row`/`.slicer-grow` no lo usa ningún componente — confirmado por grep exhaustivo de `className`. Los controles de rango reales (`macro-explorer.tsx`, `world-explorer.tsx`) usan `.rail-field` con `style={{width:'100%'}}` inline. El ajuste igual se aplicó (inocuo) pero no tiene efecto observable. |
| M3, M5 | Ambos viven solo en `src/components/places-explorer.tsx`, no importado desde ninguna ruta. |
| M4 | `places-map.tsx` ya tiene `ResizeObserver` + listener de `resize`. |

## 5. Archivos modificados

- `src/app/globals.css` — tokens de z-index, referencia de breakpoints, fix de `.slicer` range,
  sombra de scroll en `.table-wrap`, reserva de espacio en `.card-sector`.
- `src/app/admin/admin.css` — nav colapsable, z-index del modal tokenizado, sombra de scroll en
  `.admin-scroll`.
- `src/components/admin/admin-shell.tsx` — estado del menú, botón de disclosure, cierre al
  navegar.
- `tests/e2e/admin-visual.spec.ts` — un test nuevo (regresión del menú colapsable).
- `package.json` / `package-lock.json` — `next` 15.5.23→15.5.25, `eslint` y
  `eslint-config-next` (`^15.5.25`) añadidos como devDependencies.
- `.eslintrc.json` — nuevo, generado por `next lint --strict`.
- `docs/*.md` — los 4 documentos de esta auditoría.
- `tests/e2e/public-visual.spec.ts` — nuevo, cobertura de overflow/zoom/accesibilidad del sitio
  público.

## 6. Componentes creados / refactorizados

Ningún componente React nuevo ni dividido. Todo el trabajo de CSS y un cambio de estado local en
`admin-shell.tsx` (ya `'use client'`).

## 7. Breakpoints utilizados

Ninguno nuevo introducido en reglas existentes; se documentó la escala ya en uso. Ver
`RESPONSIVE_DESIGN_SYSTEM.md`.

## 8. Estrategias aplicadas

- **Tablas**: scroll horizontal contenido + sombra de scroll (gradientes CSS,
  `background-attachment: local/scroll`), sin JS.
- **Navegación**: admin pasa a disclosure colapsable con `display:contents` para no alterar un
  solo píxel del desktop.
- **Tarjetas**: `.card-sector` reserva espacio con `:has()` cuando hay controles flotantes
  encima — mismo mecanismo (`:has()`) que el proyecto ya usaba en `.card:has(.card-table)`.
- **Accesibilidad**: el toggle nuevo usa `aria-expanded`/`aria-controls`, hereda el catch-all de
  `:focus-visible` existente, y sigue la convención de iconos `desplegar`/`plegar` ya usada en 4
  componentes.

## 9. Cómo se verificó (sin el MCP de Playwright ni la extensión de Chrome)

Ninguno de los dos conectó esta sesión — el MCP de Playwright se desconectó a mitad de la primera
pasada (un `taskkill //F` mío, usado para liberar un puerto, mató el proceso Node del que
dependía; en pasadas posteriores usé `taskkill //PID <pid> //F` dirigido a un solo proceso). En
vez de declarar la verificación visual imposible, se usó el paquete `playwright-core` — ya
instalado como dependencia del proyecto — directamente desde scripts Node cortos
(`chromium.launch()`), cargando arneses HTML estáticos que enlazan los CSS reales del proyecto por
`file://`. Esto no requiere base de datos ni servidor corriendo, así que no lo bloqueó la cuota de
Neon agotada. Cada captura se inspeccionó con la herramienta de lectura de imágenes, una por una,
antes de dar por buena una regla CSS.

Lo único que esto **no** pudo cubrir: el flujo real autenticado del panel admin (login necesita la
base de datos) y el sitio público con datos reales — para eso sigue haciendo falta que la cuota de
Neon se libere.

## 10. Pruebas ejecutadas — resultado real

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | ✅ limpio, en cada grupo de cambios |
| `npm run build` | ✅ compila las 26 rutas |
| `npm run lint` | ✅ 0 errores, 12 warnings preexistentes (imports sin usar en `page.tsx`, un `exhaustive-deps` en `places-map.tsx`) — ninguno introducido aquí, ninguno tocado |
| `npm audit` | ✅ 0 críticas (era 1), 0 altas de `sharp` (era 1); queda 1 alta de `postcss` que exige Next 16 |
| `npx playwright test --list` | ✅ 15 tests descubiertos |
| Verificación visual (`playwright-core` scripteado) | ✅ H1, H4, H5, M1 verificados con capturas reales, no solo con lectura de CSS |
| `public-visual.spec.ts` / `admin-visual.spec.ts` contra datos reales | ❌ bloqueado por cuota de Neon agotada — reconfirmado al cierre de la sesión, sigue sin liberarse; **límite externo, no accionable desde este repo** |

## 11. Riesgos o limitaciones restantes

- **La suite E2E no corrió en verde contra datos reales** — el único pendiente que de verdad
  queda fuera de mi alcance, porque depende de la cuota de facturación de Neon, no de nada en este
  repositorio. Recomendación: correr `npx playwright test` en cuanto se libere.
- **Vulnerabilidad alta de `postcss`** sin corregir — requiere Next 16 (cambio mayor), decisión
  del equipo, no de esta sesión.
- El menú admin y el resto de los cambios se verificaron con arneses HTML aislados (CSS real,
  markup real, pero fuera del árbol de React/Next) en vez del flujo de la app corriendo de punta a
  punta — la diferencia práctica es mínima (mismo CSS, mismo HTML resultante) pero no es
  exactamente lo mismo que verlo en `next dev` con datos reales.

## 12. Recomendaciones de mantenimiento

- Antes de añadir un nuevo `@media`, usar uno de los anchos ya documentados en
  `RESPONSIVE_DESIGN_SYSTEM.md`.
- Al añadir un `z-index`, usar uno de los 4 tokens `--z-*`.
- El bloque CSS `.slicer`/`.slicers`/`.slicer-row`/`.slicer-grow` (globals.css, ~805-940) no lo usa
  ningún componente — candidato a eliminar en una limpieza aparte (no se tocó aquí por no ser
  parte del alcance).
- Revisar la responsividad de `markets-explorer.tsx`, `payments-explorer.tsx`,
  `social-explorer.tsx`, `territory-explorer.tsx`, `trade-explorer.tsx` y `places-explorer.tsx`
  si alguno se conecta a una ruta real — quedaron fuera de esta auditoría por no ser alcanzables.
- Correr `npx playwright test tests/e2e/public-visual.spec.ts tests/e2e/admin-visual.spec.ts` en
  cuanto haya cuota de base de datos disponible.
- Decidir si actualizar a Next 16 para cerrar la vulnerabilidad de `postcss` restante, evaluando
  el costo de migración aparte de este trabajo.
