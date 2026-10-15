---
name: tablero-premium
description: Use al crear o rediseñar cualquier panel, gráfico, filtro o pestaña del tablero público de observatorio-dashboard, y antes de dar un panel por terminado. Fija la anatomía única de panel, los tokens, las reglas de gráficos y el contrato de descargas.
---

# Tablero premium: un panel, una anatomía

Dirección: **institucional, como un banco central, con la voz de la prensa económica seria**
(NYT, FT). El producto se llama **DatosBolivia.com · Centro de Datos de Bolivia**
(«Observatorio Económico» era el nombre en clave y no aparece en ningún texto visible).
Identidad del manual de marca: tinta, oro envejecido y marfil; monograma DB
(`src/components/brand/monogram.tsx`). Minimalista, filetes en vez de tarjetas, un solo
acento de interfaz (oro profundo), gráficos de trazo fino.

**Redacción: `docs/estilo/LIBRO-DE-ESTILO.md` manda.** Tercera persona impersonal, dato antes
que adjetivo, sin jerga interna ni anglicismos, Bs/USD, coma decimal, siglas desarrolladas.

Fundamentos que esta skill concreta: `dataviz` (color computable, formas, marcas),
`frontend-design-system` (tokens en capas), `typography-systems`, `ui-visual-system`.
No sustituye al comprobador de paleta: lo exige.

## Reglas que no se negocian

1. **El `<h2>` dice la magnitud y la unidad**: «Dólar paralelo (Bs por USD)». Nunca una
   entradilla evocadora. La frase con la conclusión va en la entradilla de debajo.
2. **Todo gráfico lleva leyenda**, también con una sola serie (`ChartLegend`). Al añadir
   un panel hay que pasar `label` a las familias de líneas.
3. **No se toca un color a ojo.** Cualquier cambio de `--series-*`, `--up`, `--down`,
   `--seq-*`, `--ord-*` o `--adv-*` pasa por `validate_palette.js` en claro
   (`--surface "#f7f4ed"`, el marfil) y en oscuro (`--surface "#0e1011"`, negro editorial).
   Con `--pairs all` para mapas y pequeños múltiplos: solo las tres primeras casillas la
   pasan. `analysis-pdf.ts` repite la paleta clara: se resincroniza con
   `sync-palette.mjs` (lee `:root`), no a mano. La casilla 4 es petróleo, **no ámbar**:
   lo que significa «vigilar/advertencia» usa `--warning`/`--serious`.
4. **Filtros cruzados estilo PowerBI** en todo panel con varias dimensiones. Si el lector
   no puede recortar la vista, el panel no está terminado.
5. **Dos series del mismo tipo y la misma ventana de fechas van en `grid-pair`.**
6. **«Hoy»: cotización (USDT, USDC, Oficial) → tendencias → resto.** En móvil, una por
   fila y en grande. No se reordena sin preguntar.
7. **Nada de componentes de servidor `async` por pestaña.** Los datos entran con
   `useOnOpen` contra una ruta de `src/app/api/`. `Tabs` monta solo la pestaña activa.
8. **Un panel nuevo no inventa su cabecera, su leyenda, su pie ni su descarga**: usa `Panel`.

## Anatomía de un panel

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  (filete de tinta)
Título con la magnitud y la unidad                     [Descargar ▾]
Entradilla en serif: el hallazgo, con cifra y fecha
[ filtros del panel — una sola fila, encima del contenido ]
[ gráfico, mapa o tabla ]
── Serie A  ── Serie B                                 (leyenda siempre)
Fuente: BCB. Elaboración: DatosBolivia.com. Actualizado el 3-oct-2026.   (lo pone Panel)
```

`source` lleva solo el publicador real; `Panel` (vía `src/lib/export/pie.ts`) añade
«Elaboración: DatosBolivia.com» salvo que la fuente ya diga «cálculo de DatosBolivia.com».

La cabecera de sección (`TabHeader`) lleva **antetítulo** en versalitas oro profundo
(«ECONOMÍA · MERCADO CAMBIARIO»), que sale de la tabla `ANTETITULO` por `id`; una sección
nueva se añade ahí. La cabecera del sitio es `Masthead` y el pie, `SiteFooter`.

## Tokens (solo estos; ningún literal suelto)

- Tipografía: Newsreader (marca, títulos, entradillas, páginas del índice), Public Sans
  (interfaz y datos). Escala 1,2 sobre 16 px: `--text-xs … --text-3xl`. Cifras de héroe
  proporcionales; `tabular-nums` solo en tablas y ejes.
- **MAYÚSCULAS espaciadas solo** en el antetítulo de sección, la franja de secciones y el
  descriptor de la marca (`--kicker-size`, `--kicker-track`). Ningún otro rótulo.
- Espaciado `--s0 … --s6`. Radios de periódico: `--radius-sm` 2, `--radius-md` 3,
  `--radius-lg` 4 (`--radius-pill` solo para puntos y avatares).
- Superficies: `--paper`/`--panel` marfil (los paneles no son tarjetas), `--field` papel
  blanco (campos, menús, tooltip), `--panel-tint` arena clara.
- Una sola sombra, solo para capas flotantes (menús, popovers). Los paneles se separan
  por filete de tinta arriba, no por tarjetas.
- Un solo acento de interfaz: **`--accent`** (oro profundo #806337, 5,1:1): página abierta,
  foco, enlaces, selección. `--gold` (#aa884d, 3,0:1) es solo filete, monograma y adorno,
  **nunca texto**. `--series-*` es solo para datos. Los colores de estado son solo estado.
- Gráficos: retícula y ejes como línea fina sólida (nunca discontinua), líneas de 2 px,
  tooltip con el valor primero y la serie después, animación ≤ 400 ms y
  `prefers-reduced-motion` respetado.
- Tres puntos de corte: 640, 1024, 1280.

## Contrato de descargas

Todo panel tiene el menú **Descargar**: imagen PNG (2×) y SVG con título, unidad, leyenda,
fuente y marca, siempre en tema claro; datos CSV (UTF-8 con BOM, sin inyección de fórmulas,
columnas `fuente` y `consultado`) y Excel; copiar enlace. Los datos son **exactamente lo
que el panel muestra con los filtros aplicados**. Cada pestaña lleva «Descargar pestaña
(PDF)». Un flujo único `blob → clic` que avisa a `reportDownloadIntent`.

## Cierre de un panel (marcar todo antes de decir «listo»)

- [ ] Textos según `docs/estilo/LIBRO-DE-ESTILO.md` (lista de control del §9).
- [ ] Usa `Panel`; el `<h2>` imprime la unidad.
- [ ] Hay `.chart-legend` hermana de cada `.chart-frame`.
- [ ] Pie de fuente único con fecha.
- [ ] Descargas funcionando (imagen, datos, enlace).
- [ ] Filtros en `FilterBar` o en el riel unificado, y cruzados si hay varias dimensiones.
- [ ] Sin `style={{}}` de espaciado, sin cabecera ni leyenda locales.
- [ ] Capturas en 390, 768 y 1440 px, claro y oscuro, inspeccionadas (`visual-proof`).
- [ ] Contraste medido sobre el DOM (ojo: `getComputedStyle` devuelve `color(srgb …)` para
      `color-mix`) y axe sin hallazgos.

## Cómo se migra un panel antiguo (receta)

Las piezas ya existen: `src/components/ui/panel.tsx` (`Panel`), `ui/tab-header.tsx` (`TabHeader`),
`ui/panel-data.tsx` (los gráficos declaran sus cifras al `Panel` que los envuelve),
`lib/export/*` (CSV, Excel, afiche PNG/SVG). **Envolver el panel antiguo en `<Panel>` basta
para que se pueda bajar**: no hay que repetir los datos en `data` salvo que el contenido no sea un
gráfico de `charts.tsx` ni una `<table>` (tarjetas, listas).

1. **Cabecera**: `<div className="panel"><div className="tile-head|panel-head">…<h2>T</h2>…</div><p className="panel-sub">S</p>`
   pasa a `<Panel id="…" title="T con la unidad" lede="S" meta="…" source="…">`. Sin iconos en el
   título. El `h2` desaparece: el título del panel es un `h3` y lo pone `Panel`.
2. **Título = magnitud y unidad.** «Qué produce la economía» → «Peso de cada sector en el PIB (% del
   PIB)». La frase evocadora no se tira: va a `lede`. El comprobador exige un paréntesis con la unidad
   (`(Bs por USD)`, `(% del PIB)`, `(millones de USD)`, `(cantidad de empresas)`).
3. **`source` es verdad, no relleno.** Salió de algo que el componente o su API ya dice (`publisher`,
   `fuente`, un pie `card-note-source`/`chart-note`/`panel-sub` que empieza por «Fuente:»). Ese pie
   viejo se borra al subirlo a `source`. Si de verdad no se sabe: «Observatorio Económico de Bolivia
   (ver «Método»)». Nunca inventar un proveedor.
4. **Leyenda bajo cada gráfico**, también con una sola serie: `ChartLegend` (exportada de
   `charts.tsx`) con `items`; las familias de líneas la dibujan si se les pasa `label`. Mapas: la
   leyenda va dentro del panel, debajo.
5. **Filtros**: no se rediseña su lógica ni se quita ninguno. Los controles que ya existen
   (`.chip`, `.slicer`, `.rail-*`) conservan su comportamiento; solo se retira lo propio del panel
   (estilos en línea de espaciado, `GroupHead` copiado, `BarLegend` copiado).
6. **Estilos en línea de espaciado** (`style={{ marginTop: … }}`) y tamaños/colores literales: fuera;
   se usan las escalas (`--s*`, `--text-*`, `--radius-*`) o una clase.
7. **Cabecera de pestaña**: la sección de la pestaña (`*-section.tsx`) abre con `TabHeader`
   (título + una frase que dice qué hay y cuánto confiar). Si la pestaña tiene `SubTabs`, va encima.
8. **No tocar** `charts.tsx`, `globals.css` existente, `ui/*`, `icons.tsx`, `tabs.tsx`, `page.tsx` ni
   `/admin`. Si hace falta CSS nuevo: añadirlo **al final** de `globals.css` bajo un comentario con
   el nombre de la pestaña (solo añadir; nunca editar ni borrar reglas ajenas).

### Verificar (obligatorio antes de decir «listo»)

Los datos vienen de `test.datosbolivia.com`: las llamadas `/api/*` del build local se resuelven allí.
Las pestañas que arma el servidor desde la base (Hoy y Tipo de cambio) se prueban con una página de
sonda con datos sintéticos (no se commitea).

- `npm run typecheck`, `npm run test:unit`, `npm run lint` sin errores nuevos.
- `npm run build` y `npx next start -p <puerto propio>`.
- `node panel-audit.mjs <puerto> "<pestaña>" "<subpestaña>"` — sin ✗ en los paneles migrados.
- `node local-tab.mjs <puerto> "<pestaña>" "<subpestaña>" <etiqueta>` — capturas en claro/oscuro,
  escritorio y móvil; **mirarlas** (no basta con que compile).
- Descarga real de un panel con gráfico (PNG, CSV, Excel) abierta y revisada.

## Tablas → gráficos (`ViewToggle`)

Pedido del usuario (3-oct-2026): «se ven feas esas tablas, podrían verse gráficos». Regla: **donde una tabla es una clasificación, una serie o un desglose, se ve primero como gráfico y la tabla queda a un clic dentro del mismo panel.** Lo que es registro (un directorio, una lista de documentos con enlaces, normas con texto, un catálogo) sigue siendo tabla.

| La tabla es… | Se dibuja como… | Pieza de `charts.tsx` |
|---|---|---|
| un ranking (nombre → cifra) | barras horizontales | `ShareBars`, `ReachChart`, `DivergingBars` si hay signo |
| una serie en el tiempo (año/mes → cifra) | líneas o barras | `SeriesChart`, `YearlyBars`, `MonthlyBars`, `DatedLines` |
| un desglose que suma un total | barras apiladas | `StackedBars`, `YearStackBars` |
| varias series comparables | líneas | `WorldLines`, `DatedLines`, `RankLines` |
| dos dimensiones cruzadas | mapa de calor | `HeatGrid` |

Receta: `ViewToggle` (`@/components/ui/view-toggle`) recibe `chart` y `table` ya armados y enseña
uno a la vez (gráfico primero). Va **dentro** del `Panel`, donde iba la tabla. La tabla se conserva
tal cual (mismas filas, mismas columnas) y los datos que se bajan son los mismos en las dos vistas.

- Los datos del gráfico salen de las mismas filas que la tabla; no se calculan dos veces ni se cambia ningún cálculo.
- Leyenda (`ChartLegend`) bajo el gráfico, también con una sola serie; título con unidad.
- Un gráfico con más de ~12 categorías muestra las primeras y dice cuántas faltan; la tabla las tiene todas.
- Si la tabla tiene enlaces o texto largo por fila, **no** se convierte: se deja tabla.
- No se tocan `charts.tsx` ni `ui/*`: si falta un gráfico, se describe en el informe.
