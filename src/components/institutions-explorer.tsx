'use client';

import { DivergingBars, ShareBars, WorldLines, seriesTone } from './charts';
import type { WorldLinePoint, WorldLineSeries } from './charts';
import { DerivedReading } from './derived-reading';
import type { IconName } from './icons';
import {
  INSTITUTION_GROUP_LABEL,
  INSTITUTION_INDICATORS,
  REGIME_LABEL,
  freedomStatus,
  indicatorOf,
  type InstitutionGroup,
  type InstitutionsBoard,
} from '@/lib/institutions-board';
import { useSinceYear } from './year-floor';

/**
 * The legal and political situation, drawn from the indices that rate it.
 *
 * Reading first, then one panel per publisher: the Fraser Institute's
 * economic freedom and its five areas, Freedom House's political rights and
 * civil liberties with the seven subcategories under them and the ratings
 * back to 1972, V-Dem's anatomy of democracy, and the World Bank's six
 * governance estimates against the world mean. Each chart states its scale
 * and which way is better, because these indices do not agree on either.
 */

const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const CONCLUSION_ICON: Record<string, IconName> = {
  'libertad-economica': 'maletin',
  'libertad-politica': 'personas',
  historia: 'calendario',
  democracia: 'balanza',
  regimen: 'banco',
  'estado-de-derecho': 'escudo',
  gobernanza: 'edificio',
};

function lines(
  board: InstitutionsBoard,
  codes: readonly string[],
  fromYear = 0,
): { data: WorldLinePoint[]; series: WorldLineSeries[] } {
  const present = codes.filter((code) => (board.series[code]?.length ?? 0) > 0);
  const years = new Set<number>();
  for (const code of present) {
    for (const point of board.series[code] ?? []) if (point.year >= fromYear) years.add(point.year);
  }
  const data = [...years]
    .sort((left, right) => left - right)
    .map((year) => {
      const row: WorldLinePoint = { year: String(year) };
      for (const code of present) {
        row[code] = board.series[code]?.find((point) => point.year === year)?.value ?? null;
      }
      return row;
    });
  const series = present.map((code, index) => ({
    key: code,
    label: indicatorOf(code)?.label ?? code,
    tone: seriesTone(index),
    emphasis: index === 0,
  }));
  return { data, series };
}

function Latest({ code, board }: { code: string; board: InstitutionsBoard }) {
  const meta = indicatorOf(code);
  const reading = board.series[code]?.at(-1);
  if (!meta || !reading) return null;
  return (
    <div className="stat">
      <span className="stat-label">{meta.label}</span>
      <span className="stat-value">{number(reading.value, meta.decimals)}</span>
      <span className="stat-hint">
        de {number(meta.max, 0)}
        {meta.higherIsBetter ? '' : ', menos es mejor'} · {reading.year}
      </span>
    </div>
  );
}

function GroupHead({ group, children }: { group: InstitutionGroup; children: React.ReactNode }) {
  return (
    <div className="panel-head">
      <h2>{INSTITUTION_GROUP_LABEL[group]}</h2>
      <p className="panel-sub">{children}</p>
    </div>
  );
}

const twoDecimals = (value: number): string => number(value, 2);
const threeDecimals = (value: number): string => number(value, 3);
const whole = (value: number): string => number(value, 0);

export function InstitutionsExplorer({ board: entire }: { board: InstitutionsBoard }) {
  /* El «desde» de la barra de filtros de encima; sin barra, el tablero entero. */
  const board = useSinceYear(entire);
  const economic = lines(board, [
    'EFW_SUMMARY_INDEX',
    'EFW_SIZE_OF_GOVERNMENT',
    'EFW_LEGAL_SYSTEM_PROPERTY_RIGHTS',
    'EFW_SOUND_MONEY',
    'EFW_FREEDOM_TO_TRADE',
    'EFW_REGULATION',
  ]);
  const political = lines(board, [
    'FH_TOTAL_SCORE',
    'FH_POLITICAL_RIGHTS_SCORE',
    'FH_CIVIL_LIBERTIES_SCORE',
  ]);
  const ratings = lines(board, ['FH_POLITICAL_RIGHTS_RATING', 'FH_CIVIL_LIBERTIES_RATING']);
  const democracy = lines(
    board,
    [
      'VDEM_LIBERAL_DEMOCRACY_INDEX',
      'VDEM_ELECTORAL_DEMOCRACY_INDEX',
      'VDEM_JUDICIAL_CONSTRAINTS_INDEX',
      'VDEM_LEGISLATIVE_CONSTRAINTS_INDEX',
      'VDEM_FREEDOM_OF_EXPRESSION_INDEX',
      'VDEM_RULE_OF_LAW_INDEX',
    ],
    1952,
  );
  const governance = lines(board, [
    'RULE_OF_LAW_SCORE',
    'CONTROL_OF_CORRUPTION_SCORE',
    'GOVERNMENT_EFFECTIVENESS_SCORE',
    'REGULATORY_QUALITY_SCORE',
    'POLITICAL_STABILITY_SCORE',
    'VOICE_AND_ACCOUNTABILITY_SCORE',
  ]);

  const subcategories = INSTITUTION_INDICATORS.filter(
    (entry) => entry.group === 'POLITICA' && entry.max <= 16 && entry.min === 0,
  ).flatMap((entry) => {
    const reading = board.series[entry.code]?.at(-1);
    if (!reading) return [];
    return [
      {
        name: entry.label,
        value: (reading.value / entry.max) * 100,
        parts: [
          { name: 'puntaje', value: reading.value },
          { name: 'techo', value: entry.max },
        ],
        note: `${number(reading.value, 0)} de ${entry.max} en ${reading.year}`,
      },
    ];
  });

  const governanceLatest = INSTITUTION_INDICATORS.filter(
    (entry) => entry.group === 'GOBERNANZA' && entry.max === 2.5,
  ).flatMap((entry) => {
    const reading = board.series[entry.code]?.at(-1);
    return reading ? [{ name: entry.label, value: reading.value, meta: String(reading.year) }] : [];
  });

  const ratingP = board.series.FH_POLITICAL_RIGHTS_RATING?.at(-1);
  const ratingC = board.series.FH_CIVIL_LIBERTIES_RATING?.at(-1);
  const status = ratingP && ratingC ? freedomStatus(ratingP.value, ratingC.value) : null;
  const regime = board.series.POLITICAL_REGIME_CLASSIFICATION?.at(-1);
  const missingLabels = board.missing.map((code) => indicatorOf(code)?.label ?? code);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Situación jurídica y política</h2>
          <p className="panel-sub">
            Qué tan libre es el país, en qué sentido, y qué parte de esa libertad se movió. Cuatro
            instituciones lo califican con métodos publicados y cada índice se muestra con las
            partes que lo componen: el total esconde justo lo que cambia. El dato más reciente es de{' '}
            {board.asOfYear ?? '—'}.
          </p>
        </div>
        <DerivedReading
          title="Qué dicen estos índices"
          note="Cada frase sale de las series de este capítulo y se recalcula con cada carga. Dice qué nivel hay, contra qué techo y desde cuándo; no dice por qué ni qué va a pasar."
          conclusions={board.conclusions}
          icons={CONCLUSION_ICON}
        />
        {missingLabels.length ? (
          <div className="callout">
            Todavía no llegan al tablero: {missingLabels.join(', ')}. Las recoge el núcleo del
            observatorio y aparecen aquí en cuanto su carga las publique.
          </div>
        ) : null}
      </div>

      {economic.series.length ? (
        <div className="panel">
          <GroupHead group="ECONOMICA">
            Índice de libertad económica del Fraser Institute, de 0 a 10, y las cinco áreas que
            promedia. Diez es la economía más libre. Las áreas discrepan más de lo que el resumen
            deja ver: esa discrepancia es la lectura.
          </GroupHead>
          <div className="stat-strip">
            <Latest code="EFW_SUMMARY_INDEX" board={board} />
            <Latest code="EFW_SIZE_OF_GOVERNMENT" board={board} />
            <Latest code="EFW_LEGAL_SYSTEM_PROPERTY_RIGHTS" board={board} />
            <Latest code="EFW_SOUND_MONEY" board={board} />
            <Latest code="EFW_FREEDOM_TO_TRADE" board={board} />
            <Latest code="EFW_REGULATION" board={board} />
          </div>
          <WorldLines
            data={economic.data}
            series={economic.series}
            format={twoDecimals}
            tick={whole}
          />
        </div>
      ) : null}

      {political.series.length || ratings.series.length ? (
        <div className="grid-two">
          <div className="panel">
            <GroupHead group="POLITICA">
              Freedom in the World: derechos políticos sobre 40, libertades civiles sobre 60 y el
              total sobre 100. Cada subcategoría se dibuja como parte de su propio techo, porque un
              6 sobre 16 y un 6 sobre 12 no son la misma cosa.
              {status ? (
                <>
                  {' '}
                  Estado actual: <b>{status}</b>.
                </>
              ) : null}
            </GroupHead>
            <div className="stat-strip">
              <Latest code="FH_TOTAL_SCORE" board={board} />
              <Latest code="FH_POLITICAL_RIGHTS_SCORE" board={board} />
              <Latest code="FH_CIVIL_LIBERTIES_SCORE" board={board} />
            </div>
            {subcategories.length ? (
              <ShareBars data={subcategories} tone="var(--official)" />
            ) : null}
            {political.data.length > 1 ? (
              <WorldLines
                data={political.data}
                series={political.series}
                format={whole}
                tick={whole}
              />
            ) : null}
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Medio siglo de calificaciones</h2>
              <p className="panel-sub">
                Las calificaciones de 1 a 7 que Freedom House publica desde 1972, donde{' '}
                <b>1 es la más libre</b> y 7 la menos: aquí la línea sube cuando la libertad baja.
                El promedio de las dos define el estado: hasta 2,5 «libre», hasta 5 «parcialmente
                libre», más allá «no libre».
              </p>
            </div>
            {ratings.data.length > 1 ? (
              <WorldLines data={ratings.data} series={ratings.series} format={whole} tick={whole} />
            ) : null}
          </div>
        </div>
      ) : null}

      {democracy.series.length ? (
        <div className="panel">
          <GroupHead group="DEMOCRACIA">
            Los índices de V-Dem, de 0 a 1, desde 1952. La democracia liberal es la electoral más
            los contrapesos —control judicial y legislativo del Ejecutivo, libertades individuales—
            y la distancia entre las dos líneas es cuánto pesan los contrapesos.
            {regime ? (
              <>
                {' '}
                Régimen en {regime.year}: <b>{REGIME_LABEL[regime.value] ?? regime.value}</b>.
              </>
            ) : null}
          </GroupHead>
          <div className="stat-strip">
            <Latest code="VDEM_LIBERAL_DEMOCRACY_INDEX" board={board} />
            <Latest code="VDEM_ELECTORAL_DEMOCRACY_INDEX" board={board} />
            <Latest code="VDEM_JUDICIAL_CONSTRAINTS_INDEX" board={board} />
            <Latest code="VDEM_LEGISLATIVE_CONSTRAINTS_INDEX" board={board} />
            <Latest code="VDEM_FREEDOM_OF_EXPRESSION_INDEX" board={board} />
            <Latest code="VDEM_POLITICAL_CORRUPTION_INDEX" board={board} />
          </div>
          <WorldLines
            data={democracy.data}
            series={democracy.series}
            format={threeDecimals}
            tick={twoDecimals}
          />
        </div>
      ) : null}

      {governance.series.length ? (
        <div className="grid-two">
          <div className="panel">
            <GroupHead group="GOBERNANZA">
              Las seis estimaciones de gobernanza del Banco Mundial, en desviaciones típicas
              respecto de la media mundial: cero es el país mediano del mundo, y casi todo va de
              −2,5 a 2,5. Las barras son el último año; la línea, la historia.
            </GroupHead>
            {governanceLatest.length ? <DivergingBars data={governanceLatest} unit="σ" /> : null}
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Las seis dimensiones en el tiempo</h2>
              <p className="panel-sub">
                La misma escala, año a año desde 1996. Una línea que baja es una dimensión en la que
                el país se aleja de la media mundial.
              </p>
            </div>
            <WorldLines
              data={governance.data}
              series={governance.series}
              format={twoDecimals}
              tick={twoDecimals}
            />
            <div className="stat-strip">
              <Latest code="CORRUPTION_PERCEPTIONS_INDEX" board={board} />
              <Latest code="STATE_CAPACITY_INDEX" board={board} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
