# Matriz de cobertura — extensión al producto (fase 08)

## F08.1 — agrupar y ordenar

La zona pública **no tiene rutas múltiples que migrar por familias** — es una sola ruta (`/`,
`src/app/page.tsx`) organizada internamente por `Tabs`/`SubTabs`; todo lo que un visitante ve vive
dentro de esa página (confirmado: `find src/app -maxdepth 1 -type d` solo devuelve `admin`, `api` y
la raíz — cero rutas públicas adicionales). Esto simplifica la migración: al ser `Tabs`/`SubTabs` un
componente compartido (no duplicado, confirmado en fase 05), **las fases 04-07 ya se propagaron
automáticamente a todo su uso real**, incluido `trade-explorer.tsx` (el otro consumidor de
`SubTabs`, fase 01).

Familias reales dentro de esa única ruta:

| Familia | Componente compartido | Consumidores | Estado |
|---|---|---|---|
| Navegación por secciones/páginas | `Tabs`/`SubTabs` | `page.tsx` (7 secciones), `trade-explorer.tsx` (3 sub-páginas) | Ya cubierta por fases 04-07 (ARIA, contraste, responsive, movimiento) |
| Lista paginada | `Pager` | 4 de los 15 "explorers" (fase 01 corrigió el conteo original) | Auditada en esta fase — ver H06 abajo |
| El resto (11 explorers, mapa, nube de palabras, tarjetas de prensa, etc.) | componentes propios, sin patrón compartido con el piloto | cada uno su propio archivo | **Fuera de alcance de este kit** — no comparten componente con el piloto, migrarlos sería rediseñar cada pantalla desde cero, que la fase 08 pide evitar explícitamente |

## F08.2 — migrar la familia "lista paginada" (`Pager`)

`src/components/pager.tsx` ya era sólido: usa `<button disabled>` nativo (teclado y estado
deshabilitado correctos sin ARIA manual), `aria-label` distingue instancias múltiples con la misma
etiqueta (`where`), y el foco visible lo cubre la regla global `:where(button,...):focus-visible` sin
necesitar una excepción local. No se dupica el piloto por copia — `Pager` no necesitaba adoptar el
patrón `tablist` porque no es un widget de pestañas, es paginación simple.

**H06 (P2) encontrado y corregido:** `.pager-where` usaba `--ink-faint` (3.81:1 sobre `--panel`
blanco, bajo AA 4.5:1) para texto informativo real ("21–40 de 86 · página 1 de 5"), la misma causa
raíz que H04. Corregido a `--ink-soft` (7.4:1), mismo criterio que el piloto.

## H06b — hallazgo sistémico, deliberadamente NO corregido en este incremento

Al buscar la causa raíz de H06, `--ink-faint` aparece en **más de 60 reglas** de `globals.css`, fuera
de `Tabs`/`SubTabs`/`Pager` (grids, tarjetas, leyendas, metadatos de otras secciones). Revisar cada
una exige ver el contenido real renderizado para distinguir texto informativo (necesita AA) de texto
genuinamente decorativo/auxiliar (donde un contraste más bajo es una decisión de jerarquía visual
legítima, no un defecto) — sin datos reales disponibles en esta sesión (Neon sigue sin cuota), esa
distinción no se puede hacer con confianza para 60 casos.

**Decisión:** no se corrige en bloque. Corregir ciegamente convertiría un ajuste de contraste acotado
en un rediseño de la jerarquía visual de toda la aplicación, que excede el alcance de este piloto y
el mandato de "extender lo demostrado sin rediseñar cada pantalla desde cero" de esta misma fase.
Se registra como deuda de accesibilidad conocida, con su causa (token único, uso masivo, necesita
triage con datos reales) para que la fase 09 (accesibilidad y rendimiento) o una auditoría dedicada
lo retome con contexto completo — no se omite silenciosamente.

## F08.3 — compatibilidad

Ningún cambio de esta fase mueve, renombra ni redirige nada — son ajustes de contraste y de un
`border-radius` dentro de componentes existentes. No hay URLs, bookmarks ni permisos afectados.

## F08.4 — estados y contenido

No aplica un cambio nuevo: los estados de datos (vacío, error, secciones perdidas) ya se auditaron en
fases 00-02 y no cambiaron. `Pager` ya se oculta a sí mismo cuando `pages <= 1` en vez de mostrar un
control inútil — comportamiento correcto ya existente, no se tocó.

## F08.5 — retirar legado

No hay legado que retirar: no se creó ninguna versión paralela ni adaptador de compatibilidad en
ninguna fase de este piloto — todos los cambios fueron aditivos sobre los mismos archivos que ya
existían.

## Gate

**Cobertura completa del alcance acordado** (zona pública, sin `/admin`): la única ruta pública
comparte sus componentes de navegación entre sí, así que las fases 04-07 ya alcanzaron a todo su uso
real; esta fase auditó y corrigió la única familia adicional con patrón compartido (`Pager`, H06).
El resto de componentes de la zona pública no comparten patrón con el piloto y quedan fuera de
alcance por esa razón explícita, no por omisión. Deuda conocida y explícita: uso sistémico de
`--ink-faint` fuera del piloto (H06b), pendiente de triage con datos reales.
