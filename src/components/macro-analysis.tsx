'use client';

import { useMemo, useRef, useState } from 'react';
import { MacroChart } from './charts';
import { Icon } from './icons';
import {
  DensityHistogram,
  LagBars,
  ScatterTrend,
  VariationHeat,
  ViolinPlot,
  compactNumber,
} from './macro-analysis-charts';
import type { ScatterDatum, VariationCell } from './macro-analysis-charts';
import {
  headlineValue,
  number,
  sectorIcon,
  sectorLabel,
  sectorTone,
  unitLabel,
} from './macro-vocabulary';
import { DEFINITION_AUTHOR, GLOSSARY, UNIT_MEANING } from '@/lib/indicator-glossary';
import { captureBlock, captureFigure, printAnalysis } from '@/lib/analysis-pdf';
import type { PdfFigure } from '@/lib/analysis-pdf';
import {
  autocorrelation,
  density,
  histogram,
  linearFit,
  macroStats,
  significanceBand,
} from '@/lib/macro-stats';
import type { MacroStats } from '@/lib/macro-stats';
import type { MacroPoint } from '@/lib/series';

/**
 * Un indicador abierto entero.
 *
 * La tabla resume cada serie en una fila de estadísticos, y un estadístico es
 * una afirmación que el lector no puede comprobar: «asimetría 2,4» no se
 * verifica leyéndola otra vez. Esta vista es el respaldo de esa fila —la
 * distribución dibujada de dos maneras, los años atípicos con nombre y año, y
 * cuánto arrastra la serie su propio pasado— y se abre desde la celda cuya
 * pregunta contesta.
 *
 * Es una vista y no una ventana emergente. Un modal obliga a elegir entre leer
 * el análisis o volver a la tabla, y aquí el recorrido normal es mirar una
 * serie, volver, y mirar la siguiente: la vista reemplaza el cuerpo del panel,
 * conserva los filtros de la izquierda y vuelve con un solo control.
 *
 * Todo se calcula sobre la selección que el lector tenía en pantalla. Un
 * informe que dijera «desde 1960» debajo de un gráfico que arranca en 1990
 * sería dos documentos presentados como uno.
 */

export function MacroAnalysis({
  point,
  series,
  onBack,
}: {
  /** La última lectura del indicador: de ella salen nombre, unidad y fuente. */
  point: MacroPoint;
  /** La serie completa dentro del filtro, en cualquier orden. */
  series: MacroPoint[];
  onBack: () => void;
}) {
  const unit = unitLabel(point.unit);
  const tone = sectorTone(point.sector);
  const definition = GLOSSARY[point.indicatorCode];

  const ordered = useMemo(
    () => [...series].sort((left, right) => left.period.localeCompare(right.period)),
    [series],
  );
  const stats = useMemo(() => macroStats(ordered), [ordered]);
  const values = stats.spark;

  const bins = useMemo(() => histogram(values), [values]);
  const curve = useMemo(() => density(values), [values]);

  /** El nivel contra el año: la tendencia de fondo, sin suavizar. */
  const levelPoints = useMemo(
    (): ScatterDatum[] =>
      ordered.map((row) => ({ x: Number(row.period), y: row.value, period: row.period })),
    [ordered],
  );
  const levelFit = useMemo(() => linearFit(levelPoints), [levelPoints]);

  /**
   * La variación de cada año contra la del anterior.
   *
   * Es la pregunta que el nivel no contesta: si un año malo suele venir seguido
   * de otro malo, o si la serie rebota. Una pendiente positiva es persistencia;
   * una negativa, reversión a la media.
   */
  const changePoints = useMemo((): ScatterDatum[] => {
    const out: ScatterDatum[] = [];
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]?.changePercent;
      const current = ordered[index]?.changePercent;
      const period = ordered[index]?.period;
      if (previous === null || previous === undefined) continue;
      if (current === null || current === undefined || !period) continue;
      out.push({ x: previous, y: current, period });
    }
    return out;
  }, [ordered]);
  const changeFit = useMemo(() => linearFit(changePoints), [changePoints]);

  const lags = useMemo(() => autocorrelation(values), [values]);
  const band = significanceBand(stats.n);

  const heatCells = useMemo(
    (): VariationCell[] =>
      ordered.map((row) => ({ period: row.period, change: row.changePercent })),
    [ordered],
  );

  /** Qué figura está en pantalla dentro del bloque de correlación. */
  const [angle, setAngle] = useState<'nivel' | 'variacion' | 'rezagos' | 'reticula'>('nivel');

  /*
   * Las cajas de las que el PDF copia las figuras.
   *
   * El informe no vuelve a dibujar nada: toma el SVG que ya está en pantalla.
   * Eso obliga a que la figura esté montada cuando se pulsa descargar, y por
   * eso las cuatro lecturas de correlación se montan todas y se ocultan con
   * `hidden` en vez de desmontarse —una pestaña desmontada no tiene SVG que
   * copiar, y el informe saldría con un hueco donde el lector espera su figura.
   */
  const trendBox = useRef<HTMLDivElement>(null);
  const densityBox = useRef<HTMLDivElement>(null);
  const violinBox = useRef<HTMLDivElement>(null);
  const levelBox = useRef<HTMLDivElement>(null);
  const changeBox = useRef<HTMLDivElement>(null);
  const lagBox = useRef<HTMLDivElement>(null);
  const heatBox = useRef<HTMLDivElement>(null);

  const reading = useMemo(() => narrate(stats, point, unit), [stats, point, unit]);

  const download = (): void => {
    const figures: PdfFigure[] = [
      {
        caption: `Figura 1 — La serie, ${stats.firstPeriod}–${stats.lastPeriod}`,
        markup: captureFigure(trendBox.current),
        note: `Máximo ${headlineValue(stats.max.value, point.unit)} ${unit} en ${stats.max.period}; mínimo ${headlineValue(stats.min.value, point.unit)} ${unit} en ${stats.min.period}.`,
      },
      {
        caption: 'Figura 2 — Densidad e histograma',
        markup: captureFigure(densityBox.current),
        note: 'Las barras cuentan años por intervalo; la curva es la densidad por núcleo gaussiano llevada a esa misma escala.',
      },
      {
        caption: 'Figura 3 — Violín con caja intercuartílica',
        markup: captureFigure(violinBox.current),
        portrait: true,
        note: stats.outliers.length
          ? `Caja Q1–Q3, línea negra la mediana, línea naranja la media. Los puntos son ${
              stats.outliers.length === 1
                ? 'el único año que queda'
                : `los ${stats.outliers.length} años que quedan`
            } fuera de los bigotes.`
          : 'Caja Q1–Q3, línea negra la mediana, línea naranja la media. Ningún año queda fuera de los bigotes.',
      },
      {
        caption: 'Figura 4 — Nivel contra año',
        markup: captureFigure(levelBox.current),
        note: `r = ${number(levelFit.r, 3)}, R² = ${number(levelFit.r2, 3)} sobre ${levelFit.n} pares.`,
      },
      {
        caption: 'Figura 5 — Variación contra la del año anterior',
        markup: captureFigure(changeBox.current),
        note: `r = ${number(changeFit.r, 3)}, R² = ${number(changeFit.r2, 3)} sobre ${changeFit.n} pares.`,
      },
      {
        caption: 'Figura 6 — Autocorrelación por rezago',
        markup: captureFigure(lagBox.current),
        note: `Banda de ruido a ±${number(band, 3)}, que es 1,96 sobre la raíz de ${stats.n}.`,
      },
      {
        caption: 'Figura 7 — Variación interanual por década',
        markup: captureBlock(heatBox.current?.querySelector('.heat-scroll')),
        note: 'Cada celda es un año; el color, el signo de su variación, y la intensidad, su magnitud relativa.',
      },
    ];

    printAnalysis({
      title: point.name ?? point.indicatorCode,
      code: point.indicatorCode,
      sector: sectorLabel(point.sector),
      unit: UNIT_MEANING[point.unit] ?? unit,
      publisher: point.publisher,
      sourceUrl: point.sourceUrl,
      span: `${stats.firstPeriod}–${stats.lastPeriod}`,
      stats,
      reading,
      definitionAuthor: DEFINITION_AUTHOR,
      definition: definition
        ? {
            what: definition.what,
            howToRead: definition.howToRead,
            ...(definition.caveat ? { caveat: definition.caveat } : {}),
          }
        : null,
      groups: [
        {
          heading: 'Tendencia central',
          items: [
            { label: 'Media', value: headlineValue(stats.mean, point.unit), hint: unit },
            { label: 'Mediana', value: headlineValue(stats.median, point.unit), hint: unit },
            {
              label: 'Media recortada',
              value: headlineValue(stats.trimmedMean, point.unit),
              hint: '10 % por cola',
            },
            {
              label: 'Moda',
              value: stats.mode === null ? '—' : headlineValue(stats.mode, point.unit),
              hint: 'intervalo más poblado',
            },
          ],
        },
        {
          heading: 'Dispersión',
          items: [
            {
              label: 'Desviación estándar',
              value: headlineValue(stats.sd, point.unit),
              hint: unit,
            },
            {
              label: 'Coef. de variación',
              value: stats.cv === null ? '—' : `${number(stats.cv * 100, 1)} %`,
              hint: 'σ sobre la media',
            },
            { label: 'RIC', value: headlineValue(stats.iqr, point.unit), hint: 'Q3 − Q1' },
            {
              label: 'Recorrido',
              value: headlineValue(stats.range, point.unit),
              hint: 'máx − mín',
            },
          ],
        },
        {
          heading: 'Forma y extremos',
          items: [
            {
              label: 'Asimetría',
              value: number(stats.skewness, 2),
              hint: skewWord(stats.skewness),
            },
            {
              label: 'Curtosis',
              value: number(stats.kurtosis, 2),
              hint: kurtosisWord(stats.kurtosis),
            },
            {
              label: 'Máximo',
              value: headlineValue(stats.max.value, point.unit),
              hint: stats.max.period,
            },
            {
              label: 'Mínimo',
              value: headlineValue(stats.min.value, point.unit),
              hint: stats.min.period,
            },
          ],
        },
      ],
      figures,
      tables: [
        {
          caption: `Años atípicos (${stats.outliers.length})`,
          head: ['Año', 'Valor', 'Lado', 'Desvíos (σ)', 'Var. anual'],
          numeric: [0, 1, 3, 4],
          rows: stats.outliers.length
            ? stats.outliers.map((row) => {
                const change = ordered.find((item) => item.period === row.period)?.changePercent;
                return [
                  row.period,
                  `${headlineValue(row.value, point.unit)} ${unit}`,
                  row.side === 'alto' ? 'por encima' : 'por debajo',
                  number(row.z, 2),
                  change === null || change === undefined
                    ? '—'
                    : `${change > 0 ? '+' : ''}${number(change, 2)} %`,
                ];
              })
            : [['—', 'Ninguna observación cae fuera de los bigotes', '—', '—', '—']],
          note: `Bigotes de Tukey: por debajo de ${headlineValue(stats.lowFence, point.unit)} o por encima de ${headlineValue(stats.highFence, point.unit)} ${unit}.`,
        },
        {
          caption: 'Cuantiles',
          head: ['Mínimo', 'Q1', 'Mediana', 'Q3', 'Máximo', 'MAD'],
          numeric: [0, 1, 2, 3, 4, 5],
          rows: [
            [
              headlineValue(stats.min.value, point.unit),
              headlineValue(stats.q1, point.unit),
              headlineValue(stats.median, point.unit),
              headlineValue(stats.q3, point.unit),
              headlineValue(stats.max.value, point.unit),
              headlineValue(stats.mad, point.unit),
            ],
          ],
          note: `Todo en ${unit}. MAD: desviación absoluta mediana, la dispersión que los años atípicos no mueven.`,
        },
      ],
    });
  };

  return (
    <div className="analysis">
      <div className="analysis-bar">
        <button type="button" className="download-btn" onClick={onBack}>
          <Icon name="plegar" size={13} /> Volver a la tabla
        </button>
        <span className="analysis-crumb">
          <Icon name={sectorIcon(point.sector)} size={14} /> {sectorLabel(point.sector)}
        </span>
        <span className="tile-hint">
          {stats.n} observaciones · {stats.firstPeriod}–{stats.lastPeriod}
        </span>
        <div className="download">
          <button type="button" className="download-btn download-btn-on" onClick={download}>
            <Icon name="descarga" size={13} /> Descargar análisis (PDF)
          </button>
        </div>
      </div>

      <header className="analysis-head">
        <h2>{point.name ?? point.indicatorCode}</h2>
        <p className="analysis-sub">
          <code>{point.indicatorCode}</code> · {UNIT_MEANING[point.unit] ?? unit} ·{' '}
          {point.publisher ?? 'fuente citada'}
          {point.sourceUrl ? (
            <>
              {' · '}
              <a href={point.sourceUrl} target="_blank" rel="noreferrer noopener">
                ver la serie publicada
              </a>
            </>
          ) : null}
        </p>
        <p className="analysis-reading">{reading}</p>
      </header>

      <StatBlock heading="Medidas de tendencia central" icon="diana">
        <StatTile label="Media" value={headlineValue(stats.mean, point.unit)} hint={unit} />
        <StatTile label="Mediana" value={headlineValue(stats.median, point.unit)} hint={unit} />
        <StatTile
          label="Media recortada"
          value={headlineValue(stats.trimmedMean, point.unit)}
          hint="sin el 10 % de cada cola"
        />
        <StatTile
          label="Moda"
          value={stats.mode === null ? '—' : headlineValue(stats.mode, point.unit)}
          hint="centro del intervalo más poblado"
        />
      </StatBlock>

      <StatBlock heading="Medidas de dispersión" icon="balanza">
        <StatTile
          label="Desviación estándar"
          value={headlineValue(stats.sd, point.unit)}
          hint={unit}
        />
        <StatTile
          label="Varianza"
          value={compactNumber(stats.variance)}
          hint={`${unit} al cuadrado`}
        />
        <StatTile
          label="Coef. de variación"
          value={stats.cv === null ? '—' : `${number(stats.cv * 100, 1)} %`}
          hint="σ sobre la media"
        />
        <StatTile label="RIC" value={headlineValue(stats.iqr, point.unit)} hint="Q3 − Q1" />
        <StatTile
          label="Recorrido"
          value={headlineValue(stats.range, point.unit)}
          hint="máximo − mínimo"
        />
        <StatTile
          label="MAD"
          value={headlineValue(stats.mad, point.unit)}
          hint="desviación absoluta mediana"
        />
      </StatBlock>

      <StatBlock heading="Medidas de forma y extremos" icon="sigma">
        <StatTile
          label="Asimetría"
          value={number(stats.skewness, 2)}
          hint={skewWord(stats.skewness)}
        />
        <StatTile
          label="Curtosis (exceso)"
          value={number(stats.kurtosis, 2)}
          hint={kurtosisWord(stats.kurtosis)}
        />
        <StatTile
          label="Máximo"
          value={headlineValue(stats.max.value, point.unit)}
          hint={`en ${stats.max.period}`}
          tone="var(--down)"
        />
        <StatTile
          label="Mínimo"
          value={headlineValue(stats.min.value, point.unit)}
          hint={`en ${stats.min.period}`}
          tone="var(--up)"
        />
        <StatTile
          label="Atípicos"
          value={String(stats.outliers.length)}
          hint={`fuera de ${headlineValue(stats.lowFence, point.unit)} – ${headlineValue(stats.highFence, point.unit)}`}
          {...(stats.outliers.length ? { tone: 'var(--up)' } : {})}
        />
        <StatTile
          label="Observaciones"
          value={String(stats.n)}
          hint={`${stats.firstPeriod}–${stats.lastPeriod}`}
        />
      </StatBlock>

      <section className="analysis-figure" ref={trendBox}>
        <div className="strap">
          <Icon name="linea" size={17} />
          <h2>La serie</h2>
          <span className="tile-hint">
            máximo en {stats.max.period} · mínimo en {stats.min.period}
          </span>
        </div>
        <MacroChart
          data={ordered.map((row) => ({ period: row.period, value: row.value }))}
          unit={point.unit}
          tone={tone}
        />
      </section>

      <div className="analysis-pair">
        <section className="analysis-figure" ref={densityBox}>
          <div className="strap">
            <Icon name="barras" size={17} />
            <h2>Densidad e histograma</h2>
            <span className="tile-hint">dónde se acumulan los años</span>
          </div>
          <DensityHistogram bins={bins} curve={curve} stats={stats} unit={unit} />
        </section>

        <section className="analysis-figure" ref={violinBox}>
          <div className="strap">
            <Icon name="area" size={17} />
            <h2>Violín</h2>
            <span className="tile-hint">densidad, caja y atípicos</span>
          </div>
          <ViolinPlot curve={curve} stats={stats} unit={unit} tone={tone} />
        </section>
      </div>

      <section className="analysis-figure">
        <div className="strap">
          <Icon name="pulso" size={17} />
          <h2>Correlación</h2>
          <span className="tile-hint">
            la serie contra el tiempo y contra sí misma
            {/*
              La retícula es por década y no por mes a propósito: estas series
              son anuales y no existe un eje mensual que rellenar. Decirlo aquí
              evita que un lector busque un desglose que la fuente no publica.
            */}
          </span>
          <div className="download">
            {(
              [
                ['nivel', 'Nivel ↔ año'],
                ['variacion', 'Variación ↔ año previo'],
                ['rezagos', 'Autocorrelación'],
                ['reticula', 'Retícula por década'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={angle === key ? 'download-btn download-btn-on' : 'download-btn'}
                onClick={() => setAngle(key)}
                aria-pressed={angle === key}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={pane(angle, 'nivel')} aria-hidden={angle !== 'nivel'} ref={levelBox}>
          <ScatterTrend
            points={levelPoints}
            fit={levelFit}
            xLabel="Año"
            yLabel="Valor"
            xScale="año"
            tone={tone}
          />
        </div>
        <div
          className={pane(angle, 'variacion')}
          aria-hidden={angle !== 'variacion'}
          ref={changeBox}
        >
          <ScatterTrend
            points={changePoints}
            fit={changeFit}
            xLabel="Var. del año anterior"
            yLabel="Var. del año"
            xScale="porcentaje"
            yScale="porcentaje"
            tone={tone}
          />
        </div>
        <div className={pane(angle, 'rezagos')} aria-hidden={angle !== 'rezagos'} ref={lagBox}>
          <LagBars lags={lags} band={band} label="Autocorrelación" />
          <p className="chart-note">
            Banda de ruido a ±{number(band, 3)}. Una barra que no la supera no distingue la serie de
            un sorteo.
          </p>
        </div>
        <div className={pane(angle, 'reticula')} aria-hidden={angle !== 'reticula'} ref={heatBox}>
          <VariationHeat cells={heatCells} unit={unit} />
        </div>
      </section>

      <section className="analysis-figure">
        <div className="strap">
          <Icon name="campana" size={17} />
          <h2>Años atípicos</h2>
          <span className="tile-hint">
            fuera de los bigotes de Tukey · {stats.outliers.length} de {stats.n}
          </span>
        </div>
        {stats.outliers.length ? (
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th className="num">Año</th>
                  <th className="num">Valor</th>
                  <th>Lado</th>
                  <th className="num">Desvíos (σ)</th>
                  <th className="num">Var. anual</th>
                </tr>
              </thead>
              <tbody>
                {stats.outliers.map((row) => {
                  const change = ordered.find((item) => item.period === row.period)?.changePercent;
                  return (
                    <tr key={row.period}>
                      <td className="num">{row.period}</td>
                      <td className="num">
                        {headlineValue(row.value, point.unit)}{' '}
                        <span className="cell-code">{unit}</span>
                      </td>
                      <td>
                        <span className={row.side === 'alto' ? 'delta-up' : 'delta-down'}>
                          {row.side === 'alto' ? 'por encima' : 'por debajo'}
                        </span>
                      </td>
                      <td className="num">{number(row.z, 2)}</td>
                      <td className="num">
                        {change === null || change === undefined ? (
                          '—'
                        ) : (
                          <span className={change >= 0 ? 'delta-up' : 'delta-down'}>
                            {change > 0 ? '+' : ''}
                            {number(change, 2)} %
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>
                    Bigotes: por debajo de {headlineValue(stats.lowFence, point.unit)} o por encima
                    de {headlineValue(stats.highFence, point.unit)} {unit}.
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="callout">
            Ninguna observación cae fuera de los bigotes de Tukey. El recorrido de la serie se
            explica por su propia dispersión.
          </div>
        )}
      </section>

      {definition ? (
        <div className="card-note analysis-note">
          <p>
            <b>Qué mide.</b> {definition.what}
          </p>
          <p>
            <b>Cómo leerlo.</b> {definition.howToRead}
          </p>
          {definition.caveat ? (
            <p className="card-note-caveat">
              <Icon name="info" size={12} /> {definition.caveat}
            </p>
          ) : null}
          <p className="card-note-source">
            <b>Definición:</b> redactada por el {DEFINITION_AUTHOR} a partir del concepto estándar.
            No es la del publicador.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * La pestaña que no está elegida se aparta, pero se sigue dibujando.
 *
 * `hidden` la desmontaría a efectos de medida: una caja de ancho cero hace que
 * el contenedor elástico de la librería de gráficos no dibuje ningún SVG, y el
 * informe —que copia lo que hay en pantalla— saldría con tres figuras en
 * blanco. Apartada con posición absoluta conserva su ancho, su SVG existe, y el
 * lector no la ve ni la alcanza con el tabulador.
 */
const pane = (angle: string, key: string): string =>
  angle === key ? 'analysis-pane' : 'analysis-pane analysis-pane-off';

function StatBlock({
  heading,
  icon,
  children,
}: {
  heading: string;
  icon: Parameters<typeof Icon>[0]['name'];
  children: React.ReactNode;
}) {
  return (
    <section className="stat-block">
      <div className="stat-block-head">
        <Icon name={icon} size={14} />
        {heading}
      </div>
      <div className="stat-grid">{children}</div>
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <b className="stat-tile-value" style={tone ? { color: tone } : undefined}>
        {value}
      </b>
      {hint ? <span className="stat-tile-hint">{hint}</span> : null}
    </div>
  );
}

/** Cómo se llama una asimetría, para que el número no viaje solo. */
function skewWord(value: number): string {
  if (value > 1) return 'cola derecha larga';
  if (value > 0.35) return 'sesgo leve a la derecha';
  if (value < -1) return 'cola izquierda larga';
  if (value < -0.35) return 'sesgo leve a la izquierda';
  return 'prácticamente simétrica';
}

/**
 * La misma asimetría, conjugada.
 *
 * `skewWord` devuelve un sintagma nominal, que es lo que cabe bajo una cifra en
 * una casilla. En medio de una frase ese sintagma no concuerda —«la
 * distribución está cola izquierda larga»— y la prosa del informe es lo que más
 * se lee de esta vista, así que aquí va la versión con verbo.
 */
function skewPhrase(value: number): string {
  if (value > 1) return 'estira una cola larga hacia la derecha';
  if (value > 0.35) return 'se inclina levemente a la derecha';
  if (value < -1) return 'estira una cola larga hacia la izquierda';
  if (value < -0.35) return 'se inclina levemente a la izquierda';
  return 'es prácticamente simétrica';
}

/** La curtosis conjugada, por la misma razón que la asimetría. */
function kurtosisPhrase(value: number): string {
  if (value > 1) return 'tiene colas pesadas: los años extremos no son raros';
  if (value > 0.3) return 'pesa algo más en las colas que una normal';
  if (value < -0.8) return 'tiene colas ligeras y el cuerpo ancho';
  return 'se comporta como una normal en las colas';
}

/** Lo mismo para la curtosis, que se reporta en exceso: cero es la normal. */
function kurtosisWord(value: number): string {
  if (value > 1) return 'colas pesadas';
  if (value > 0.3) return 'algo más pesada que la normal';
  if (value < -0.8) return 'colas ligeras, cuerpo ancho';
  return 'cercana a la normal';
}

/**
 * El párrafo que traduce la fila de estadísticos.
 *
 * Se arma con reglas y no con plantillas sueltas porque tiene que ser cierto
 * para los 1.620 indicadores, incluidos los que tienen doce observaciones o una
 * hiperinflación dentro. Dice solo lo que los números sostienen: dónde está el
 * centro, cuán dispersa es la serie, hacia qué lado se estira y qué años se
 * salen. Ninguna causa, porque de la causa estos datos no saben nada.
 */
function narrate(stats: MacroStats, point: MacroPoint, unit: string): string {
  if (stats.n < 3) {
    return `La selección deja ${stats.n} observación${stats.n === 1 ? '' : 'es'} de esta serie: no alcanzan para describir una distribución. Ampliá el período desde el filtro de período.`;
  }

  const centre =
    Math.abs(stats.mean - stats.median) > 0.5 * stats.sd
      ? `La media (${headlineValue(stats.mean, point.unit)}) y la mediana (${headlineValue(stats.median, point.unit)}) se separan, señal de que unos pocos años tiran del promedio`
      : `La media y la mediana casi coinciden (${headlineValue(stats.median, point.unit)} ${unit}), así que el centro de la serie es un valor típico y no un promedio de extremos`;

  const spread =
    stats.cv === null
      ? `El RIC es de ${headlineValue(stats.iqr, point.unit)} ${unit}`
      : stats.cv > 0.5
        ? `Es una serie dispersa: la desviación estándar equivale al ${number(stats.cv * 100, 0)} % de su media, y la mitad central cabe en ${headlineValue(stats.iqr, point.unit)} ${unit}`
        : `Es una serie estable: la desviación estándar es el ${number(stats.cv * 100, 0)} % de su media, y la mitad central cabe en ${headlineValue(stats.iqr, point.unit)} ${unit}`;

  const shape = `La distribución ${skewPhrase(stats.skewness)} (asimetría ${number(stats.skewness, 2)}) y ${kurtosisPhrase(stats.kurtosis)} (curtosis en exceso ${number(stats.kurtosis, 2)})`;

  const extremes = `El máximo, ${headlineValue(stats.max.value, point.unit)} ${unit}, es de ${stats.max.period}; el mínimo, ${headlineValue(stats.min.value, point.unit)} ${unit}, de ${stats.min.period}`;

  const odd = stats.outliers.length
    ? `. Quedan ${stats.outliers.length} año${stats.outliers.length === 1 ? '' : 's'} fuera de los bigotes de Tukey: ${stats.outliers
        .slice(0, 4)
        .map((row) => row.period)
        .join(', ')}${stats.outliers.length > 4 ? ' y otros' : ''}.`
    : '. Ningún año cae fuera de los bigotes de Tukey.';

  return `${centre}. ${spread}. ${shape}. ${extremes}${odd}`;
}
