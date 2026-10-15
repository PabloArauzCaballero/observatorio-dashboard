'use client';

import { useMemo, useState } from 'react';
import {
  ANY,
  accepts,
  additive,
  counts,
  picked,
  toggle as toggleChoice,
  without,
} from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { ChartLegend, MacroChart, ShareBars, WorldLines, seriesTone } from './charts';
import { TOP_TEN, TopTen } from './top-ten';
import { BarsKey, ChartKindSwitch, ShareSquares } from './chart-kind';
import type { ChartKind } from './chart-kind';
import { WorldTradeMap } from './world-trade-map';
import { DerivedReading } from './derived-reading';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import type { IconName } from './icons';
import { onOneAxis } from './department-lines';
import type { NamedLine } from './department-lines';
import { Panel } from '@/components/ui/panel';
import { nationalProductMix, nationalTopProducts } from '@/lib/departments-board';
import type { DepartmentBoard, ProductLine } from '@/lib/departments-board';
import {
  foreignTradeConclusions,
  partnerOptions,
  productChapterOptions,
} from '@/lib/foreign-trade-board';
import type { ForeignTradeBoard } from '@/lib/foreign-trade-board';
import { concentration } from '@/lib/exporters-board';
import type { ExportersBoard } from '@/lib/exporters-board';

/**
 * Comercio exterior: qué vende Bolivia, a quién, qué compra y quién lo vende.
 *
 * Eran dos pestañas —«Exportadoras» y «Comercio exterior»— y las separaba una
 * distinción metodológica real: una es un ránking sin dólares (un agregador
 * comercial) y la otra es producto y país con fuentes oficiales (INE,
 * Comtrade). Pero para el lector es una sola pregunta —qué comercia Bolivia
 * con el resto del mundo, y quién lo hace— y verla en dos pestañas obligaba a
 * dos clics para una historia que se cuenta en un scroll. Van juntas ahora:
 * arriba el panorama (producto, país, balanza), abajo quién exporta más.
 *
 * Los filtros de país, producto y años recortan el panorama; el ránking de
 * exportadoras no tiene ninguna de esas tres dimensiones en su fuente —el
 * agregador publica orden y cuota, no país ni producto ni serie anual— así
 * que sigue su propio dato, sin fingir un filtro que no puede cumplir.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** La cuota, con una decimal y el signo separado como se escribe en Bolivia. */
const percent = (value: number): string => `${number(value, 1)} %`;

/** Quién publica cada parte del capítulo: el pie de cada panel lo dice, sin inventar otra. */
const SOURCE_INE = 'Instituto Nacional de Estadística (INE), comercio exterior por departamento';
const SOURCE_COMTRADE = 'Naciones Unidas (Comtrade), comercio de bienes declarado por Bolivia';
const SOURCE_EXPORTERS =
  'Agregador comercial de registros aduaneros (puesto y cuota, sin montos en USD); ver «Método»';

/** Cuántos productos entran en la barra sin que deje de leerse. */
const SHOWN_PRODUCTS = 15;

/** Cuántos productos se siguen en el tiempo. Más de cinco líneas no se leen. */
const TOP = 5;

/** Cuántas exportadoras entran en la figura sin que deje de leerse. */
const SHOWN_EXPORTERS = 20;

/** Cuántos socios o capítulos se dibujan cuando el lector no eligió ninguno. */
const DEFAULT_DETAIL_SHOWN = 8;

/** «El país elegido» o «los 3 países elegidos», sin el «1 países» de un plural mecánico. */
const pickedLabel = (count: number, singular: string, plural: string): string =>
  count === 1
    ? `El ${singular} elegido en el filtro`
    : `Los ${count} ${plural} elegidos en el filtro`;

const CONCLUSION_ICON: Record<string, IconName> = {
  producto: 'camion',
  concentracion: 'barras',
  balanza: 'balanza',
  crecimiento: 'tendencia',
  coincide: 'diana',
};

/** Las líneas de un grupo de productos, listas para un mismo eje. */
function productLines(lines: readonly ProductLine[], unit: 'usd' | 'tonnes') {
  return onOneAxis(
    lines.map((line, index) => ({
      key: line.slug,
      label: line.label,
      values: line[unit],
      tone: seriesTone(index),
    })),
  );
}

const asMacroSeries = (points: readonly { year: number; value: number }[]) =>
  points.map((point) => ({ period: String(point.year), value: point.value }));

/** Los años que cubre cualquier serie de este capítulo, para los topes del filtro. */
function yearBounds(
  departmentBoard: DepartmentBoard,
  tradeBoard: ForeignTradeBoard | null,
): { min: number; max: number } {
  const years: number[] = [];
  for (const line of departmentBoard.products) {
    for (const point of line.usd) years.push(point.year);
  }
  if (tradeBoard) {
    for (const point of tradeBoard.exportsUsd) years.push(point.year);
    for (const point of tradeBoard.importsUsd) years.push(point.year);
    for (const entry of tradeBoard.partners)
      for (const point of entry.points) years.push(point.year);
    for (const entry of tradeBoard.products)
      for (const point of entry.points) years.push(point.year);
  }
  if (!years.length) return { min: 1992, max: new Date().getFullYear() };
  return { min: Math.min(...years), max: Math.max(...years) };
}

/** Un punto en millones de dólares, para no repetir la división cinco veces. */
const toMillions = (points: readonly { year: number; value: number }[]) =>
  points.map((point) => ({ year: point.year, value: point.value / 1_000_000 }));

/** La parte que ya existe: el producto nacional, sumando los nueve departamentos. */
function ProductChapter({ board, from, to }: { board: DepartmentBoard; from: number; to: number }) {
  const year = board.tradeYear ? Math.min(board.tradeYear, to) : null;
  const mixUsd = useMemo(() => nationalProductMix(board, year, 'usd'), [board, year]);
  const mixTonnes = useMemo(() => nationalProductMix(board, year, 'tonnes'), [board, year]);
  const leading = useMemo(() => nationalTopProducts(board, year, TOP), [board, year]);
  const leadingCropped = useMemo(
    () =>
      leading.map((line): ProductLine => ({
        ...line,
        usd: line.usd.filter((point) => point.year >= from && point.year <= to),
        tonnes: line.tonnes.filter((point) => point.year >= from && point.year <= to),
      })),
    [leading, from, to],
  );
  const leadingUsd = useMemo(() => productLines(leadingCropped, 'usd'), [leadingCropped]);
  const leadingTonnes = useMemo(() => productLines(leadingCropped, 'tonnes'), [leadingCropped]);
  const [usdKind, setUsdKind] = useState<ChartKind>('barras');
  const [tonnesKind, setTonnesKind] = useState<ChartKind>('barras');

  if (!board.products.length) {
    return (
      <div className="callout">
        Aún no hay datos de comercio exterior por departamento disponibles.
      </div>
    );
  }

  if (!mixUsd.length) {
    return (
      <div className="callout">
        No hay comercio por producto declarado para {year ?? 'el rango elegido'}. El detalle
        nacional por producto cubre de 2010 a {board.tradeYear ?? '—'}; para verlo, ampliar el
        filtro de años.
      </div>
    );
  }

  return (
    <div className="grid-pair">
      <Panel
        id="comercio-productos-usd"
        title={`Exportaciones por producto (millones de USD, ${year})`}
        lede={`Los ${Math.min(SHOWN_PRODUCTS, mixUsd.length)} productos principales de los ${mixUsd.length} que publica el INE, sumados los nueve departamentos. El cuadro original no trae el total nacional como fila propia.`}
        source={SOURCE_INE}
      >
        <div className="fx-filters">
          <ChartKindSwitch value={usdKind} onChange={setUsdKind} kinds={['barras', 'cuadrados']} />
        </div>
        {usdKind === 'cuadrados' ? (
          <ShareSquares data={mixUsd.slice(0, SHOWN_PRODUCTS)} unit="MM USD" height={420} />
        ) : (
          <>
            <ShareBars data={mixUsd.slice(0, SHOWN_PRODUCTS)} unit=" MM USD" height={420} />
            <BarsKey label={`Valor exportado, millones de USD (${year})`} />
          </>
        )}
      </Panel>
      <Panel
        id="comercio-productos-toneladas"
        title={`Exportaciones por producto, en peso (toneladas, ${year})`}
        lede="El mismo año, en peso neto. El orden difiere del que da el valor: los minerales pesan mucho por cada dólar exportado y el gas, poco."
        source={SOURCE_INE}
      >
        <div className="fx-filters">
          <ChartKindSwitch
            value={tonnesKind}
            onChange={setTonnesKind}
            kinds={['barras', 'cuadrados']}
          />
        </div>
        {mixTonnes.length ? (
          tonnesKind === 'cuadrados' ? (
            <ShareSquares data={mixTonnes.slice(0, SHOWN_PRODUCTS)} unit="t" height={420} />
          ) : (
            <>
              <ShareBars data={mixTonnes.slice(0, SHOWN_PRODUCTS)} unit=" t" height={420} />
              <BarsKey label={`Peso exportado, toneladas (${year})`} />
            </>
          )
        ) : (
          <div className="callout">Sin peso publicado para {year}.</div>
        )}
      </Panel>
      <Panel
        id="comercio-principales-usd"
        title={`Exportaciones de los ${leading.length} productos principales (millones de USD, ${from}-${to})`}
        lede={`Los productos de mayor valor exportado en ${year}, con su evolución en el rango de años seleccionado.`}
        source={SOURCE_INE}
      >
        {leadingUsd.data.length > 1 ? (
          <WorldLines
            data={leadingUsd.data}
            series={leadingUsd.series}
            format={(value) => number(value, 1)}
            tick={(value) => number(value, 0)}
          />
        ) : (
          <div className="callout">Sin serie suficiente para dibujar en este rango de años.</div>
        )}
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            «Otros productos» queda fuera: es la partida residual con la que cierra cada
            departamento, no un producto identificable.
          </p>
        </details>
      </Panel>
      <Panel
        id="comercio-principales-toneladas"
        title={`Exportaciones de los ${leading.length} productos principales, en peso (toneladas, ${from}-${to})`}
        lede="Separa el efecto precio del efecto volumen. Si el valor sube y el peso no, el producto se vendió más caro; no salió en mayor cantidad."
        source={SOURCE_INE}
      >
        {leadingTonnes.data.length > 1 ? (
          <WorldLines
            data={leadingTonnes.data}
            series={leadingTonnes.series}
            format={(value) => number(value, 0)}
            tick={(value) => number(value, 0)}
          />
        ) : (
          <div className="callout">Sin serie suficiente para dibujar en este rango de años.</div>
        )}
      </Panel>
    </div>
  );
}

/** La parte agregada: lo que Comtrade recoge de Bolivia, un número por año. */
function ComtradeChapter({
  board,
  from,
  to,
}: {
  board: ForeignTradeBoard | null;
  from: number;
  to: number;
}) {
  const exportsUsd = (board?.exportsUsd ?? []).filter(
    (point) => point.year >= from && point.year <= to,
  );
  const importsUsd = (board?.importsUsd ?? []).filter(
    (point) => point.year >= from && point.year <= to,
  );

  if (!board || (!board.exportsUsd.length && !board.importsUsd.length)) {
    return (
      <div className="callout">
        Aún no están disponibles las series de comercio exterior de Naciones Unidas (Comtrade).
      </div>
    );
  }

  return (
    <div className="grid-two">
      <Panel
        id="comercio-exportaciones-total"
        title="Exportaciones de bienes declaradas a Naciones Unidas (millones de USD)"
        lede="Total anual que Bolivia declara a la base Comtrade de Naciones Unidas desde 1992, sin desglose por producto ni por socio."
        source={SOURCE_COMTRADE}
      >
        {exportsUsd.length > 1 ? (
          <MacroChart
            data={asMacroSeries(exportsUsd).map((point) => ({
              ...point,
              value: point.value / 1_000_000,
            }))}
            unit="millones de USD"
            tone="var(--official)"
            label="Exportaciones de bienes"
          />
        ) : (
          <div className="callout">Sin serie de exportaciones agregadas en este rango de años.</div>
        )}
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            Coincide con el «total declarado» del INE por departamento en los años en que ambos
            publican.
          </p>
        </details>
      </Panel>
      <Panel
        id="comercio-importaciones-total"
        title="Importaciones de bienes declaradas a Naciones Unidas (millones de USD)"
        lede="Total anual de bienes importados por Bolivia, con la misma fuente y el mismo nivel de agregación."
        source={SOURCE_COMTRADE}
      >
        {importsUsd.length > 1 ? (
          <MacroChart
            data={asMacroSeries(importsUsd).map((point) => ({
              ...point,
              value: point.value / 1_000_000,
            }))}
            unit="millones de USD"
            tone="var(--parallel)"
            label="Importaciones de bienes"
          />
        ) : (
          <div className="callout">Sin serie de importaciones agregadas en este rango de años.</div>
        )}
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            La clasificación de exportadoras, más abajo, no cubre esta mitad del comercio.
          </p>
        </details>
      </Panel>
    </div>
  );
}

/** Las líneas de un grupo de socios o de capítulos, en millones de USD. */
function detailLines<
  T extends { code: string; label: string; points: { year: number; value: number }[] },
>(entries: readonly T[]): NamedLine[] {
  return entries.map((entry, index) => ({
    key: entry.code,
    label: entry.label,
    values: toMillions(entry.points),
    tone: seriesTone(index),
  }));
}

/** Los N con mayor valor reciente de un flujo, cuando el lector no filtró nada. */
function topOf<T extends { flow: 'X' | 'M'; points: { year: number; value: number }[] }>(
  entries: readonly T[],
  flow: 'X' | 'M',
  limit: number,
): T[] {
  return entries
    .filter((entry) => entry.flow === flow)
    .sort((left, right) => (right.points.at(-1)?.value ?? 0) - (left.points.at(-1)?.value ?? 0))
    .slice(0, limit);
}

/** El último año publicado dentro del rango, para las formas que muestran un solo año. */
function lastYearOf(entries: readonly { points: readonly { year: number }[] }[]): number | null {
  let year: number | null = null;
  for (const entry of entries) {
    for (const point of entry.points) if (year === null || point.year > year) year = point.year;
  }
  return year;
}

/** Una fila de socio o de capítulo, con la llave con que se filtra. */
interface DetailEntry {
  code: string;
  label: string;
  flow: 'X' | 'M';
  pick: string;
  points: { year: number; value: number }[];
}

/**
 * Un panel del detalle —socios o capítulos, un flujo— en la forma que elija el
 * lector.
 *
 * Líneas sigue al tiempo y por eso dibuja pocas: las elegidas en el filtro, o
 * las ocho mayores. Barras y cuadrados miran un solo año —el último del rango
 * con dato— y por eso pueden dibujar los veinte publicados a la vez; lo
 * elegido en el filtro queda marcado en vez de quedar solo, para que se vea
 * contra qué se compara. Tocar una barra o un cuadrado lo pone en el filtro.
 */
function DetailPanel({
  id,
  subject,
  noun,
  entries,
  chosen,
  onPick,
  from,
  to,
  hint,
}: {
  id: string;
  subject: string;
  noun: { singular: string; plural: string };
  entries: readonly DetailEntry[];
  chosen: Choice;
  onPick: (value: string, additive: boolean) => void;
  from: number;
  to: number;
  hint: string;
}) {
  const [kind, setKind] = useState<ChartKind>('lineas');
  const year = lastYearOf(entries);

  const lineEntries = chosen.size
    ? entries.filter((entry) => accepts(chosen, entry.pick))
    : topOf(entries, entries[0]?.flow ?? 'X', DEFAULT_DETAIL_SHOWN);
  const lines = onOneAxis(detailLines(lineEntries));

  const slices = entries
    .map((entry) => ({
      name: entry.label,
      value: (entry.points.find((point) => point.year === year)?.value ?? 0) / 1_000_000,
      pick: entry.pick,
      ...(chosen.size && accepts(chosen, entry.pick) ? { emphasis: true } : {}),
    }))
    .filter((slice) => slice.value > 0);

  const title =
    kind === 'lineas'
      ? `${subject} (millones de USD, ${from}-${to})`
      : `${subject} (millones de USD, ${year ?? to})`;

  const lede =
    kind === 'lineas'
      ? chosen.size
        ? `${pickedLabel(lineEntries.length, noun.singular, noun.plural)}.`
        : `Los ${lineEntries.length} ${noun.plural} con mayor valor en el último año, de ${entries.length} publicados.`
      : `Los ${slices.length} ${noun.plural} publicados en ${year ?? to}${
          chosen.size ? ', con los elegidos en el filtro resaltados' : ''
        }.`;

  /* Cómo tocar y cómo leer el área: la lectura detallada, plegada bajo la figura. */
  const note =
    kind === 'lineas'
      ? hint
      : `Al seleccionar uno se añade al filtro; con Ctrl/⌘ se suman varios.${
          kind === 'cuadrados'
            ? ' El área representa el valor; el porcentaje se calcula sobre lo dibujado.'
            : ''
        }`;

  return (
    <Panel id={id} title={title} lede={lede} source={SOURCE_COMTRADE}>
      <div className="fx-filters">
        <ChartKindSwitch value={kind} onChange={setKind} />
      </div>
      {kind === 'lineas' ? (
        lines.data.length > 1 ? (
          <WorldLines
            data={lines.data}
            series={lines.series}
            format={(value) => number(value, 1)}
            tick={(value) => number(value, 0)}
          />
        ) : (
          <div className="callout">
            {chosen.size
              ? `Sin comercio declarado de estos ${noun.plural} en el rango de años elegido.`
              : 'Sin serie suficiente para dibujar en este rango de años.'}
          </div>
        )
      ) : !slices.length ? (
        <div className="callout">Sin comercio declarado en {year ?? to}.</div>
      ) : kind === 'barras' ? (
        <>
          <ShareBars
            data={slices}
            unit=" MM USD"
            height={Math.max(260, slices.length * 24)}
            onPick={onPick}
          />
          <BarsKey label={`Valor declarado, millones de USD (${year ?? to})`} />
        </>
      ) : (
        <ShareSquares data={slices} unit="MM USD" height={380} onPick={onPick} />
      )}
      {note ? (
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>{note}</p>
        </details>
      ) : null}
    </Panel>
  );
}

/** Separa un grupo de filas por flujo, recortadas al rango de años. */
function byFlow(
  rows: readonly DetailEntry[],
  from: number,
  to: number,
): Record<'X' | 'M', DetailEntry[]> {
  const cropped = rows.map((row) => ({
    ...row,
    points: row.points.filter((point) => point.year >= from && point.year <= to),
  }));
  return {
    X: cropped.filter((row) => row.flow === 'X'),
    M: cropped.filter((row) => row.flow === 'M'),
  };
}

/** El detalle por socio comercial: qué países compran y qué países venden. */
function PartnerChapter({
  board,
  country,
  onPick,
  from,
  to,
}: {
  board: ForeignTradeBoard | null;
  country: Choice;
  onPick: (value: string, additive: boolean) => void;
  from: number;
  to: number;
}) {
  const flows = useMemo(
    () =>
      byFlow(
        (board?.partners ?? []).map((entry) => ({
          code: entry.code,
          label: entry.label,
          flow: entry.flow,
          pick: entry.country,
          points: entry.points,
        })),
        from,
        to,
      ),
    [board, from, to],
  );

  if (!board || !board.partners.length) {
    return (
      <div className="callout">
        Aún no está disponible el desglose de Comtrade por país socio.
      </div>
    );
  }

  const noun = { singular: 'país', plural: 'países' };
  return (
    <div className="grid-two">
      <DetailPanel
        id="comercio-socios-vende"
        subject="Exportaciones por país de destino"
        noun={noun}
        entries={flows.X}
        chosen={country}
        onPick={onPick}
        from={from}
        to={to}
        hint="El filtro de país y el mapa permiten elegir uno o varios países para ver solo esos."
      />
      <DetailPanel
        id="comercio-socios-compra"
        subject="Importaciones por país de origen"
        noun={noun}
        entries={flows.M}
        chosen={country}
        onPick={onPick}
        from={from}
        to={to}
        hint="El filtro de país también recorta este panel."
      />
    </div>
  );
}

/** El detalle por producto: qué capítulos del arancel se venden y se compran más. */
function ProductDetailChapter({
  board,
  chapter,
  onPick,
  from,
  to,
}: {
  board: ForeignTradeBoard | null;
  chapter: Choice;
  onPick: (value: string, additive: boolean) => void;
  from: number;
  to: number;
}) {
  const flows = useMemo(
    () =>
      byFlow(
        (board?.products ?? []).map((entry) => ({
          code: entry.code,
          label: `${entry.chapter} · ${entry.label}`,
          flow: entry.flow,
          pick: entry.chapter,
          points: entry.points,
        })),
        from,
        to,
      ),
    [board, from, to],
  );

  if (!board || !board.products.length) {
    return (
      <div className="callout">
        Aún no está disponible el desglose de Comtrade por capítulo del arancel.
      </div>
    );
  }

  const noun = { singular: 'capítulo', plural: 'capítulos' };
  return (
    <div className="grid-two">
      <DetailPanel
        id="comercio-capitulos-exporta"
        subject="Exportaciones por capítulo del arancel"
        noun={noun}
        entries={flows.X}
        chosen={chapter}
        onPick={onPick}
        from={from}
        to={to}
        hint="El filtro de producto permite elegir uno o varios capítulos para ver solo esos."
      />
      <DetailPanel
        id="comercio-capitulos-importa"
        subject="Importaciones por capítulo del arancel"
        noun={noun}
        entries={flows.M}
        chosen={chapter}
        onPick={onPick}
        from={from}
        to={to}
        hint="El filtro de producto también recorta este panel."
      />
    </div>
  );
}

type Partner = ForeignTradeBoard['partners'][number];

/**
 * El mapa de socios y, debajo, la ficha del país que se tocó.
 *
 * El mapa pinta un flujo en un año: el último del rango con dato. La ficha
 * contesta lo que el mapa no puede —cómo fue ese comercio en el tiempo, qué
 * parte del total es y si Bolivia le vende más de lo que le compra— y dice lo
 * que no hay: Comtrade no publica, para Bolivia, qué productos van a qué país.
 */
function WorldChapter({
  board,
  country,
  focus,
  onPick,
  from,
  to,
}: {
  board: ForeignTradeBoard | null;
  country: Choice;
  focus: string | null;
  onPick: (value: string, additive: boolean) => void;
  from: number;
  to: number;
}) {
  const [flow, setFlow] = useState<'X' | 'M'>('X');

  const inRange = useMemo(
    () =>
      (board?.partners ?? []).map((entry): Partner => ({
        ...entry,
        points: entry.points.filter((point) => point.year >= from && point.year <= to),
      })),
    [board, from, to],
  );

  if (!board || !board.partners.length) return null;

  const ofFlow = inRange.filter((entry) => entry.flow === flow);
  const year = lastYearOf(ofFlow);
  const rows = ofFlow.flatMap((entry) =>
    entry.iso3
      ? [
          {
            token: entry.country,
            iso3: entry.iso3,
            label: entry.label,
            value: (entry.points.find((point) => point.year === year)?.value ?? 0) / 1_000_000,
          },
        ]
      : [],
  );
  const subject =
    flow === 'X' ? 'exportaciones por país de destino' : 'importaciones por país de origen';

  return (
    <>
      <Panel
        id="comercio-mapa"
        title={`Mapa de ${subject} (millones de USD, ${year ?? to})`}
        lede="Cuanto más intenso el tono, mayor el valor comerciado con ese país en el último año del rango con datos."
        source={SOURCE_COMTRADE}
      >
        <div className="fx-filters">
          <div className="chart-kind" role="group" aria-label="Flujo representado en el mapa">
            {(
              [
                ['X', 'Exportaciones'],
                ['M', 'Importaciones'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={flow === key ? 'chip chip-on' : 'chip'}
                aria-pressed={flow === key}
                onClick={() => setFlow(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <WorldTradeMap
          rows={rows}
          unit="MM USD"
          label={`${flow === 'X' ? 'exportaciones' : 'importaciones'} de Bolivia por país en ${year ?? to}`}
          picked={country}
          onPick={onPick}
        />
        {focus ? null : (
          <p className="chart-note">
            Al seleccionar un país en el mapa o en el filtro se abre su ficha, con el comercio
            bilateral en el tiempo.
          </p>
        )}
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            La escala bajo el mapa indica qué extremo corresponde al mayor valor. Al seleccionar un
            país se añade al filtro de la izquierda y se abre su ficha debajo; con Ctrl/⌘ se suman
            varios. El año es el último del rango con datos.
          </p>
        </details>
      </Panel>
      {focus ? <CountryCard board={board} entries={inRange} token={focus} /> : null}
    </>
  );
}

/** Lo que Bolivia comercia con un país, en cifras y en el tiempo. */
function CountryCard({
  board,
  entries,
  token,
}: {
  board: ForeignTradeBoard;
  entries: readonly Partner[];
  token: string;
}) {
  const sold = entries.find((entry) => entry.country === token && entry.flow === 'X');
  const bought = entries.find((entry) => entry.country === token && entry.flow === 'M');
  const name = sold?.label ?? bought?.label ?? token;
  const year = lastYearOf([sold, bought].filter((entry): entry is Partner => entry !== undefined));

  const at = (entry: Partner | undefined): number | null =>
    year === null ? null : (entry?.points.find((point) => point.year === year)?.value ?? null);
  const exportValue = at(sold);
  const importValue = at(bought);
  const exportTotal = board.exportsUsd.find((point) => point.year === year)?.value ?? null;
  const importTotal = board.importsUsd.find((point) => point.year === year)?.value ?? null;

  const rankOf = (flow: 'X' | 'M', value: number): number =>
    entries.filter(
      (entry) =>
        entry.flow === flow &&
        (entry.points.find((point) => point.year === year)?.value ?? 0) > value,
    ).length + 1;

  const named: NamedLine[] = [];
  if (sold) {
    named.push({
      key: 'X',
      label: 'Exportaciones de Bolivia',
      values: toMillions(sold.points),
      tone: 'var(--official)',
    });
  }
  if (bought) {
    named.push({
      key: 'M',
      label: 'Importaciones de Bolivia',
      values: toMillions(bought.points),
      tone: 'var(--parallel)',
    });
  }
  const lines = onOneAxis(named);

  const millions = (value: number): string => `${number(value / 1_000_000, 1)} MM USD`;
  const balance = exportValue !== null && importValue !== null ? exportValue - importValue : null;

  return (
    <Panel
      id="comercio-ficha-pais"
      title={`Comercio de Bolivia con ${name}${year ? `, ${year}` : ''} (millones de USD)`}
      lede="Exportaciones e importaciones bilaterales, su peso en el total de Bolivia y su evolución."
      source={SOURCE_COMTRADE}
      data={() => ({
        etiqueta: `Cifras ${year ?? ''}`.trim(),
        unidad: 'millones de USD',
        columnas: ['Medida', 'Valor (millones de USD)', 'Parte del total (%)', 'Puesto'],
        filas: [
          [
            'Exportaciones',
            exportValue === null ? null : exportValue / 1_000_000,
            exportValue !== null && exportTotal ? (exportValue / exportTotal) * 100 : null,
            exportValue === null ? null : rankOf('X', exportValue),
          ],
          [
            'Importaciones',
            importValue === null ? null : importValue / 1_000_000,
            importValue !== null && importTotal ? (importValue / importTotal) * 100 : null,
            importValue === null ? null : rankOf('M', importValue),
          ],
          [
            'Saldo (exportaciones menos importaciones)',
            balance === null ? null : balance / 1_000_000,
            null,
            null,
          ],
        ],
      })}
    >
      <dl className="country-figures">
        <div>
          <dt>Exportaciones</dt>
          <dd>
            {exportValue !== null ? millions(exportValue) : 'fuera de los 20 principales destinos'}
          </dd>
          {exportValue !== null && exportTotal ? (
            <dd className="country-aside">
              {percent((exportValue / exportTotal) * 100)} de lo exportado · puesto{' '}
              {rankOf('X', exportValue)}
            </dd>
          ) : null}
        </div>
        <div>
          <dt>Importaciones</dt>
          <dd>
            {importValue !== null ? millions(importValue) : 'fuera de los 20 principales orígenes'}
          </dd>
          {importValue !== null && importTotal ? (
            <dd className="country-aside">
              {percent((importValue / importTotal) * 100)} de lo importado · puesto{' '}
              {rankOf('M', importValue)}
            </dd>
          ) : null}
        </div>
        <div>
          <dt>Saldo</dt>
          <dd>
            {balance === null
              ? '—'
              : `${balance >= 0 ? '+' : '−'}${number(Math.abs(balance) / 1_000_000, 1)} MM USD`}
          </dd>
          {balance !== null ? (
            <dd className="country-aside">
              {balance >= 0
                ? 'Superávit bilateral de Bolivia'
                : 'Déficit bilateral de Bolivia'}
            </dd>
          ) : (
            <dd className="country-aside">Requiere el dato de ambos flujos</dd>
          )}
        </div>
      </dl>
      {lines.data.length > 1 ? (
        <WorldLines
          data={lines.data}
          series={lines.series}
          format={(value) => `${number(value, 1)} MM USD`}
          tick={(value) => number(value, 0)}
        />
      ) : null}
      <p className="chart-note">
        Comtrade publica el comercio de Bolivia por país y por capítulo como dos recortes separados,
        sin cruce entre ellos; por eso aquí no figura qué productos van a {name}. La base aduanera
        del INE sí los cruza: en «Detalle aduanero (INE)», la ficha de cada país incluye sus
        productos y sus departamentos.
      </p>
    </Panel>
  );
}

/**
 * Quién exporta más: el ránking de las cien primeras, con su cuota.
 *
 * Sigue este capítulo y no lo abre uno aparte: contesta la mitad de la
 * pregunta que el resto de la pestaña deja sin nombre —quién, no sólo
 * qué—. Sin filtro propio porque su fuente no trae ni país ni producto ni
 * serie anual, sólo orden y cuota de una gestión.
 */
function ExportersRanking({ board }: { board: ExportersBoard }) {
  const bars = useMemo(
    () =>
      board.exporters.slice(0, SHOWN_EXPORTERS).map((row) => ({
        name: `${row.rank}. ${row.name}`,
        value: row.share,
        ...(board.crossings.some((cross) => cross.slug === row.slug) ? { emphasis: true } : {}),
      })),
    [board],
  );

  const marked = bars.filter((bar) => 'emphasis' in bar).length;
  const topTen = concentration(board, 10);
  const topRows = board.exporters.slice(0, TOP_TEN).map((row) => ({
    key: row.slug,
    rank: row.rank,
    name: row.name,
    detail: board.crossings.some((cross) => cross.slug === row.slug)
      ? 'También figura en el monitor Merco'
      : undefined,
    value: row.share,
    shown: `${row.share.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`,
    logo: true,
  }));

  return (
    <>
      {topRows.length ? (
        <Panel
          id="comercio-exportadoras-top"
          title={`Las ${topRows.length} mayores exportadoras, gestión ${board.exportYear ?? '—'} (% de las exportaciones)`}
          lede={`Las diez primeras suman el ${percent(topTen)} de lo exportado. La fuente publica una sola gestión, por lo que no hay comparación con el puesto del año anterior.`}
          ledeText={`Las diez primeras suman el ${percent(topTen)} de lo exportado en ${board.exportYear ?? 'la gestión'}.`}
          source={SOURCE_EXPORTERS}
          data={() => ({
            unidad: '% de las exportaciones',
            columnas: ['Puesto', 'Empresa', 'Cuota (%)'],
            filas: board.exporters.slice(0, TOP_TEN).map((row) => [row.rank, row.name, row.share]),
          })}
        >
          <TopTen
            rows={topRows}
            periods={board.exportYear === null ? [] : [board.exportYear]}
            period={board.exportYear ?? 0}
            onPeriod={() => undefined}
            previous={null}
            legend="Cuota de las exportaciones (%)"
          />
        </Panel>
      ) : null}
      <Panel
        id="comercio-exportadoras"
        title={`Cuota de las principales exportadoras (% de las exportaciones, gestión ${board.exportYear ?? '—'})`}
        lede={`Las diez primeras exportadoras concentran el ${percent(topTen)} de lo exportado. La lista abarca las cien primeras, con su puesto y su cuota.`}
        source={SOURCE_EXPORTERS}
      >
        <div className="callout">
          <strong>Bolivia no publica sus exportaciones por empresa.</strong> El INE desagrega por
          producto, departamento y país de destino —el panorama de arriba—. La Aduana Nacional
          publica agregados, y el <em>Anuario de Minería</em> separa por actor productivo (estatal,
          privado, cooperativo), nunca por razón social: la declaración aduanera individual está
          amparada por reserva. Esta lista procede de un agregador comercial de registros
          aduaneros, y de ella se publican{' '}
          <strong>el puesto y la cuota, no los montos en USD</strong>: el total que esa fuente
          declara para {board.exportYear ?? 'la gestión'} no coincide con el del INE y no indica
          sobre qué base se calcula.
        </div>
        <ShareBars data={bars} unit="%" height={520} />
        <ChartLegend
          items={
            marked
              ? [
                  { color: 'var(--official)', label: 'Cuota (%) de las que también midió Merco' },
                  { color: 'var(--series-rest)', label: 'Cuota (%) del resto' },
                ]
              : [{ color: 'var(--official)', label: 'Cuota de las exportaciones (%)' }]
          }
        />
        <p className="chart-note">
          Se muestran las {Math.min(SHOWN_EXPORTERS, board.exporters.length)} primeras de{' '}
          {board.exporters.length}. Las barras resaltadas corresponden a empresas que también evaluó
          el monitor de reputación Merco en alguna edición: {marked} en el gráfico,{' '}
          {board.crossings.length} en la lista completa. El cruce completo está en la pestaña
          «Reputación empresarial».
        </p>
      </Panel>
    </>
  );
}

export function ForeignTradeExplorer({
  departmentBoard,
  tradeBoard,
  tradeFailed,
  exportersBoard,
  exportersFailed,
}: {
  departmentBoard: DepartmentBoard;
  tradeBoard: ForeignTradeBoard | null;
  tradeFailed: boolean;
  exportersBoard: ExportersBoard | null;
  exportersFailed: boolean;
}) {
  const conclusions = useMemo(
    () => foreignTradeConclusions(departmentBoard, tradeBoard),
    [departmentBoard, tradeBoard],
  );

  const bounds = useMemo(
    () => yearBounds(departmentBoard, tradeBoard),
    [departmentBoard, tradeBoard],
  );
  const countryChoices = useMemo(
    () => (tradeBoard ? partnerOptions(tradeBoard) : []),
    [tradeBoard],
  );
  const chapterChoices = useMemo(
    () => (tradeBoard ? productChapterOptions(tradeBoard) : []),
    [tradeBoard],
  );

  const [country, setCountry] = useState<Choice>(ANY);
  const [chapter, setChapter] = useState<Choice>(ANY);
  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);
  /** El último país tocado, para la ficha del mapa; sólo cuenta mientras siga en el filtro. */
  const [lastPicked, setLastPicked] = useState<string | null>(null);
  const from = yearFrom ?? bounds.min;
  const to = yearTo ?? bounds.max;

  const active =
    counts(country) + counts(chapter) + (from !== bounds.min ? 1 : 0) + (to !== bounds.max ? 1 : 0);

  /*
   * País y producto conviven a propósito: elegir uno no apaga el otro. Pero el
   * desglose de Comtrade que llegó hoy publica el socio y el capítulo como dos
   * recortes separados del mismo total —no hay, para Bolivia, cuánto le vendió
   * a China del capítulo 27—, así que cuando el lector activa los dos a la vez
   * se lo decimos en vez de fingir un cruce que la fuente no sostiene.
   */
  const crossFilterGap = country.size > 0 && chapter.size > 0;

  const focus =
    lastPicked && country.has(lastPicked) ? lastPicked : ([...country].sort()[0] ?? null);

  /** Tocar un país en el mapa o en un gráfico es lo mismo que tocarlo en el carril. */
  const pickCountry = (value: string, add: boolean) => {
    setCountry((current) => toggleChoice(current, value, add));
    setLastPicked(value);
  };
  const pickChapter = (value: string, add: boolean) =>
    setChapter((current) => toggleChoice(current, value, add));

  return (
    <>
      <header className="page-intro">
        <h3 className="page-intro-title">Comercio exterior: productos, socios y exportadoras</h3>
        <p className="page-intro-lede">
          Exportaciones e importaciones de bienes por producto y país socio, según el INE y
          Naciones Unidas, y la clasificación de las principales exportadoras. Las cifras oficiales
          están en USD; la clasificación por empresa publica solo puesto y cuota.
        </p>
        <details className="panel-note">
          <summary>Qué cubre esta página y qué no</summary>
          <p>
            La página reúne el total nacional por producto desde 2010, el agregado de exportaciones
            e importaciones declarado ante Naciones Unidas desde 1992, el desglose por socio y por
            capítulo desde 2020 y la clasificación de las principales exportadoras. Cada pieza llega
            hasta donde su fuente lo permite.
          </p>
          <p>
            <strong>Bolivia declara su comercio exterior en dólares estadounidenses (USD).</strong>{' '}
            Aquí figuran producto, país y año, con fuentes oficiales. El detalle por partida de la
            Nomenclatura Común Andina (NANDINA), país, departamento y mes, con cruces entre esas
            dimensiones y un mapa con todos los países, está en la pestaña «Detalle aduanero (INE)».
            El valor exportado por cada empresa no se publica: está amparado por reserva legal, y
            por eso la clasificación de exportadoras muestra solo puesto y cuota.
          </p>
        </details>
        {/*
         * Sólo se ve en vertical. La regla del tablero es «el informe primero,
         * los filtros después» —a un scroll de distancia en el resto de las
         * páginas—, pero este capítulo junta nueve gráficos y el ránking de
         * cien exportadoras: apilado pasa de 7.000 px antes de llegar al
         * carril, que ya no es «un scroll», son quince. El salto no adelanta
         * el carril ni lo oculta, sólo evita la caminata.
         */}
        <a className="jump-to-filters" href="#comercio-filtros">
          <Icon name="filtro" size={14} />
          Ir a los filtros
        </a>
      </header>
      <DerivedReading
        id="comercio-lectura"
        title="Qué dicen estos datos"
        note="Cada frase se calcula con las series de esta página, sin filtros, y se actualiza con cada carga de datos. Describe lo ocurrido y su comparación; no explica causas ni hace proyecciones."
        conclusions={conclusions}
        icons={CONCLUSION_ICON}
        defaultOpen={false}
        source="INE (comercio exterior por departamento) y Naciones Unidas (Comtrade); cálculo de DatosBolivia.com"
      />

      <div className="workspace">
        <aside className="rail" id="comercio-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}
            </span>
          </div>

          <FilterHint>
            Se aplican al panorama de comercio; la clasificación de exportadoras no cambia.
          </FilterHint>

          {active ? (
            <div className="rail-sec">
              <div className="rail-head">
                <Icon name="capas" size={13} />
                Selección activa
              </div>
              <div className="rail-pills">
                {[...country].sort().map((value) => (
                  <button
                    key={`country-${value}`}
                    type="button"
                    className="chip chip-on chip-wide"
                    onClick={() => setCountry((current) => without(current, value))}
                    title={`Quitar ${countryChoices.find((option) => option.value === value)?.label ?? value} del filtro`}
                  >
                    <Icon name="mapa" size={12} />
                    <span className="chip-text">
                      {countryChoices.find((option) => option.value === value)?.label ?? value}
                    </span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
                {[...chapter].sort().map((value) => (
                  <button
                    key={`chapter-${value}`}
                    type="button"
                    className="chip chip-on chip-wide"
                    onClick={() => setChapter((current) => without(current, value))}
                    title={`Quitar ${chapterChoices.find((option) => option.value === value)?.label ?? value} del filtro`}
                  >
                    <Icon name="camion" size={12} />
                    <span className="chip-text">
                      {chapterChoices.find((option) => option.value === value)?.label ??
                        `Capítulo ${value}`}
                    </span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
                {from === bounds.min && to === bounds.max ? null : (
                  <button
                    type="button"
                    className="chip chip-on"
                    onClick={() => {
                      setYearFrom(null);
                      setYearTo(null);
                    }}
                    title="Quitar este filtro"
                  >
                    <Icon name="calendario" size={12} />
                    <span className="chip-text">
                      {from}-{to}
                    </span>
                    <span aria-hidden="true">×</span>
                  </button>
                )}
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    setCountry(ANY);
                    setChapter(ANY);
                    setYearFrom(null);
                    setYearTo(null);
                  }}
                >
                  Limpiar todo
                </button>
              </div>
            </div>
          ) : null}

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="mapa" size={13} />
              País socio
              <PickedCount choice={country} />
            </div>
            {countryChoices.length ? (
              <>
                <FilterHint />
                <div
                  className={countryChoices.length > 9 ? 'rail-list rail-list-cut' : 'rail-list'}
                >
                  {countryChoices.map((option) => {
                    const on = picked(country, option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={on ? 'rail-item rail-item-on' : 'rail-item'}
                        aria-pressed={on}
                        onClick={(event) => pickCountry(option.value, additive(event))}
                      >
                        <Icon name="mapa" size={16} />
                        <span className="rail-name">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="rail-hint">Desglose por país aún no disponible.</p>
            )}
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="camion" size={13} />
              Producto (capítulo del arancel)
              <PickedCount choice={chapter} />
            </div>
            {chapterChoices.length ? (
              <>
                <FilterHint />
                <div
                  className={chapterChoices.length > 9 ? 'rail-list rail-list-cut' : 'rail-list'}
                >
                  {chapterChoices.map((option) => {
                    const on = picked(chapter, option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={on ? 'rail-item rail-item-on' : 'rail-item'}
                        aria-pressed={on}
                        onClick={(event) => pickChapter(option.value, additive(event))}
                      >
                        <Icon name="camion" size={16} />
                        <span className="rail-name">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="rail-hint">Desglose por producto aún no disponible.</p>
            )}
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Años: {from}-{to}
            </div>
            <div className="rail-field">
              <input
                type="range"
                aria-label={`Año inicial: ${from}`}
                min={bounds.min}
                max={to}
                value={from}
                onChange={(event) => setYearFrom(Math.min(Number(event.target.value), to))}
              />
            </div>
            <div className="rail-field rail-field-next">
              <input
                type="range"
                aria-label={`Año final: ${to}`}
                min={from}
                max={bounds.max}
                value={to}
                onChange={(event) => setYearTo(Math.max(Number(event.target.value), from))}
              />
            </div>
          </div>
        </aside>

        <div className="workspace-main guest-board">
          {crossFilterGap ? (
            <div className="callout">
              <strong>En esta página, país y producto no se cruzan.</strong> Comtrade publica el
              comercio boliviano por socio y por capítulo del arancel como dos recortes separados del
              mismo total. El cruce —cuánto de ese comercio corresponde al capítulo elegido— existe
              en la base del INE, en la pestaña «Detalle aduanero (INE)». Abajo, cada filtro se
              aplica por separado: el país, en los paneles por país de destino y de origen; el
              producto, en los paneles por capítulo del arancel.
            </div>
          ) : null}

          {tradeFailed ? null : (
            <WorldChapter
              board={tradeBoard}
              country={country}
              focus={focus}
              onPick={pickCountry}
              from={from}
              to={to}
            />
          )}

          <ProductChapter board={departmentBoard} from={from} to={to} />
          <ComtradeChapter board={tradeBoard} from={from} to={to} />

          {tradeFailed ? (
            <div className="callout">
              No se pudo leer el comercio exterior agregado. Recargar la página o volver en unos
              minutos; el resto de la página no se ve afectado.
            </div>
          ) : (
            <>
              <PartnerChapter
                board={tradeBoard}
                country={country}
                onPick={pickCountry}
                from={from}
                to={to}
              />
              <ProductDetailChapter
                board={tradeBoard}
                chapter={chapter}
                onPick={pickChapter}
                from={from}
                to={to}
              />
            </>
          )}

          {exportersFailed ? (
            <div className="callout">
              No se pudo leer la clasificación de exportadoras. Recargar la página o volver en unos
              minutos; el resto de la página no se ve afectado.
            </div>
          ) : exportersBoard && exportersBoard.exporters.length ? (
            <ExportersRanking board={exportersBoard} />
          ) : (
            <div className="callout">
              Aún no está disponible la clasificación de exportadoras.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
