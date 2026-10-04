---
name: tablero-premium
description: Use al crear o rediseñar cualquier panel, gráfico, filtro o pestaña del tablero público de observatorio-dashboard, y antes de dar un panel por terminado. Fija la anatomía única de panel, los tokens, las reglas de gráficos y el contrato de descargas.
---

# Tablero premium: un panel, una anatomía

Dirección: **editorial financiero** (FT, The Economist, Bloomberg). Minimalista, mucho aire,
un solo acento de interfaz, gráficos de trazo fino. El único gesto audaz es la cabecera de
cada pestaña; todo lo demás queda callado.

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
   (`--surface "#ffffff"`) y en oscuro (`--surface "#151a21"`). Con `--pairs all` para
   mapas y pequeños múltiplos: solo las tres primeras casillas la pasan.
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
Título con la magnitud y la unidad                     [Descargar ▾]
Entradilla: una línea con lo que dicen los datos
──────────────────────────────────────────────────────────────
[ filtros del panel — una sola fila, encima del contenido ]
[ gráfico, mapa o tabla ]
── Serie A  ── Serie B                                 (leyenda siempre)
Fuente: … · actualizado 3-oct-2026                     (pie único)
```

## Tokens (solo estos; ningún literal suelto)

- Tipografía: Newsreader (títulos de pestaña y de panel), Public Sans (todo lo demás).
  Escala 1,2 sobre 16 px: `--text-xs … --text-3xl`. Cifras de héroe proporcionales;
  `tabular-nums` solo en tablas y ejes. Sin monoespaciado en etiquetas de datos y sin
  micro-etiquetas en MAYÚSCULAS: sans en minúscula de oración.
- Espaciado `--s0 … --s6`. Radios `--radius-sm` 4, `--radius-md` 8, `--radius-pill`.
- Una sola sombra, solo para capas flotantes (menús, popovers). Los paneles son
  secciones separadas por línea fina, no tarjetas con sombra.
- Un solo acento de interfaz (`--series-1`): pestaña activa, foco, enlaces, selección.
  Los colores de estado son solo estado.
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
