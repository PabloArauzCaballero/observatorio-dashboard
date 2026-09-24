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
import { MacroChart, ShareBars, WorldLines, seriesTone } from './charts';
import { ChartKindSwitch, ShareSquares } from './chart-kind';
import type { ChartKind } from './chart-kind';
import { WorldTradeMap } from './world-trade-map';
import { DerivedReading } from './derived-reading';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import type { IconName } from './icons';
import { onOneAxis } from './department-lines';
import type { NamedLine } from './department-lines';
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
  count === 1 ? `El ${singular} elegido en el filtro` : `Los ${count} ${plural} elegidos en el filtro`;

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
    for (const entry of tradeBoard.partners) for (const point of entry.points) years.push(point.year);
    for (const entry of tradeBoard.products) for (const point of entry.points) years.push(point.year);
  }
  if (!years.length) return { min: 1992, max: new Date().getFullYear() };
  return { min: Math.min(...years), max: Math.max(...years) };
}

/** Un punto en millones de dólares, para no repetir la división cinco veces. */
const toMillions = (points: readonly { year: number; value: number }[]) =>
  points.map((point) => ({ year: point.year, value: point.value / 1_000_000 }));

/** La parte que ya existe: el producto nacional, sumando los nueve departamentos. */
function ProductChapter({
  board,
  from,
  to,
}: {
  board: DepartmentBoard;
  from: number;
  to: number;
}) {
  const year = board.tradeYear ? Math.min(board.tradeYear, to) : null;
  const mixUsd = useMemo(() => nationalProductMix(board, year, 'usd'), [board, year]);
  const mixTonnes = useMemo(() => nationalProductMix(board, year, 'tonnes'), [board, year]);
  const leading = useMemo(() => nationalTopProducts(board, year, TOP), [board, year]);
  const leadingCropped = useMemo(
    () =>
      leading.map(
        (line): ProductLine => ({
          ...line,
          usd: line.usd.filter((point) => point.year >= from && point.year <= to),
          tonnes: line.tonnes.filter((point) => point.year >= from && point.year <= to),
        }),
      ),
    [leading, from, to],
  );
  const leadingUsd = useMemo(() => productLines(leadingCropped, 'usd'), [leadingCropped]);
  const leadingTonnes = useMemo(() => productLines(leadingCropped, 'tonnes'), [leadingCropped]);
  const [usdKind, setUsdKind] = useState<ChartKind>('barras');
  const [tonnesKind, setTonnesKind] = useState<ChartKind>('barras');

  if (!board.products.length) {
    return (
      <div className="callout">
        Todavía no hay comercio exterior por departamento cargado; este panel se llena solo cuando
        el núcleo lo siembre.
      </div>
    );
  }

  if (!mixUsd.length) {
    return (
      <div className="callout">
        Sin comercio por producto declarado para {year ?? 'el rango elegido'}. Ajustá el filtro de
        años: el detalle nacional por producto cubre desde 2010 hasta {board.tradeYear ?? '—'}.
      </div>
    );
  }

  return (
    <div className="grid-three">
      <div className="panel">
        <div className="panel-head panel-head-kind">
          <div>
            <h2>Qué exporta Bolivia, por producto ({year}, millones de USD)</h2>
            <p className="panel-sub">
              Los {Math.min(SHOWN_PRODUCTS, mixUsd.length)} productos principales de{' '}
              {mixUsd.length} que el INE publica, sumando los nueve departamentos. Es el total
              nacional que no viene como una fila abierta en el cuadro original.
            </p>
          </div>
          <ChartKindSwitch value={usdKind} onChange={setUsdKind} kinds={['barras', 'cuadrados']} />
        </div>
        {usdKind === 'cuadrados' ? (
          <ShareSquares data={mixUsd.slice(0, SHOWN_PRODUCTS)} unit="MM USD" height={420} />
        ) : (
          <ShareBars data={mixUsd.slice(0, SHOWN_PRODUCTS)} unit=" MM USD" height={420} />
        )}
      </div>
      <div className="panel">
        <div className="panel-head panel-head-kind">
          <div>
            <h2>Cuánto pesa lo que exporta (toneladas, {year})</h2>
            <p className="panel-sub">
              El mismo año en peso neto. El orden cambia frente al de dólares: el gas no pesa nada
              en un puerto y el mineral pesa mucho sin valer lo mismo.
            </p>
          </div>
          <ChartKindSwitch value={tonnesKind} onChange={setTonnesKind} kinds={['barras', 'cuadrados']} />
        </div>
        {mixTonnes.length ? (
          tonnesKind === 'cuadrados' ? (
            <ShareSquares data={mixTonnes.slice(0, SHOWN_PRODUCTS)} unit="t" height={420} />
          ) : (
            <ShareBars data={mixTonnes.slice(0, SHOWN_PRODUCTS)} unit=" t" height={420} />
          )
        ) : (
          <div className="callout">Sin peso publicado para {year}.</div>
        )}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>
            Los {leading.length} productos principales en el tiempo (millones de USD, {from}-{to})
          </h2>
          <p className="panel-sub">
            Los que más valieron en {year}, seguidos hacia atrás dentro del rango de años elegido.
            «Otros productos» queda fuera: es el residuo con el que cierra cada departamento, no un
            producto que se pueda seguir.
          </p>
        </div>
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
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Los mismos productos, en peso (toneladas, {from}-{to})</h2>
          <p className="panel-sub">
            Separa precio de volumen: una línea de dólares que sube mientras la de toneladas no
            dice que el mismo producto se vendió más caro, no que salió más.
          </p>
        </div>
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
      </div>
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
  const exportsUsd = (board?.exportsUsd ?? []).filter((point) => point.year >= from && point.year <= to);
  const importsUsd = (board?.importsUsd ?? []).filter((point) => point.year >= from && point.year <= to);

  if (!board || (!board.exportsUsd.length && !board.importsUsd.length)) {
    return (
      <div className="callout">
        Todavía no hay comercio exterior agregado de Naciones Unidas cargado; este panel espera a
        que el núcleo siembre las series de Comtrade.
      </div>
    );
  }

  return (
    <div className="grid-two">
      <div className="panel">
        <div className="panel-head">
          <h2>Exportaciones de bienes ante Naciones Unidas (millones de USD)</h2>
          <p className="panel-sub">
            Lo que Bolivia declaró a Comtrade desde 1992, agregado: sin producto ni socio. Coincide
            con el «total declarado» del INE por departamento en los años en que ambos publican.
          </p>
        </div>
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
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Importaciones de bienes ante Naciones Unidas (millones de USD)</h2>
          <p className="panel-sub">
            Lo que compró Bolivia afuera, mismo agregado y misma fuente: la mitad del comercio que
            el ránking de exportadoras, más abajo, nunca puede mostrar.
          </p>
        </div>
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
      </div>
    </div>
  );
}

/** Las líneas de un grupo de socios o de capítulos, en millones de USD. */
function detailLines<T extends { code: string; label: string; points: { year: number; value: number }[] }>(
  entries: readonly T[],
): NamedLine[] {
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
  subject,
  noun,
  entries,
  chosen,
  onPick,
  from,
  to,
  hint,
}: {
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

  const sub =
    kind === 'lineas'
      ? chosen.size
        ? `${pickedLabel(lineEntries.length, noun.singular, noun.plural)}.`
        : `Los ${lineEntries.length} ${noun.plural} con mayor valor reciente, de ${entries.length} publicados; ${hint}`
      : `Los ${slices.length} ${noun.plural} publicados en ${year ?? to}${
          chosen.size ? ', con los elegidos en el filtro marcados' : ''
        }. Tocá uno para ponerlo en el filtro; Ctrl/⌘ suma.${
          kind === 'cuadrados' ? ' El área es el valor y el porcentaje es sobre lo dibujado.' : ''
        }`;

  return (
    <div className="panel">
      <div className="panel-head panel-head-kind">
        <div>
          <h2>{title}</h2>
          <p className="panel-sub">{sub}</p>
        </div>
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
        <ShareBars data={slices} unit=" MM USD" height={Math.max(260, slices.length * 24)} onPick={onPick} />
      ) : (
        <ShareSquares data={slices} unit="MM USD" height={380} onPick={onPick} />
      )}
    </div>
  );
}

/** Separa un grupo de filas por flujo, recortadas al rango de años. */
function byFlow(rows: readonly DetailEntry[], from: number, to: number): Record<'X' | 'M', DetailEntry[]> {
  const cropped = rows.map((row) => ({
    ...row,
    points: row.points.filter((point) => point.year >= from && point.year <= to),
  }));
  return { X: cropped.filter((row) => row.flow === 'X'), M: cropped.filter((row) => row.flow === 'M') };
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
        Todavía no hay comercio exterior por socio comercial cargado; este panel espera a que el
        núcleo siembre el desglose de Comtrade por país.
      </div>
    );
  }

  const noun = { singular: 'país', plural: 'países' };
  return (
    <div className="grid-two">
      <DetailPanel
        subject="A quién le vende Bolivia"
        noun={noun}
        entries={flows.X}
        chosen={country}
        onPick={onPick}
        from={from}
        to={to}
        hint="elegí uno o varios en el filtro de país, o en el mapa, para ver exactamente esos."
      />
      <DetailPanel
        subject="A quién le compra Bolivia"
        noun={noun}
        entries={flows.M}
        chosen={country}
        onPick={onPick}
        from={from}
        to={to}
        hint="el filtro de país también recorta este panel."
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
        Todavía no hay comercio exterior por capítulo del arancel cargado; este panel espera a que
        el núcleo siembre el desglose de Comtrade por producto.
      </div>
    );
  }

  const noun = { singular: 'capítulo', plural: 'capítulos' };
  return (
    <div className="grid-two">
      <DetailPanel
        subject="Qué capítulos exporta más Bolivia"
        noun={noun}
        entries={flows.X}
        chosen={chapter}
        onPick={onPick}
        from={from}
        to={to}
        hint="elegí uno o varios en el filtro de producto para ver exactamente esos."
      />
      <DetailPanel
        subject="Qué capítulos importa más Bolivia"
        noun={noun}
        entries={flows.M}
        chosen={chapter}
        onPick={onPick}
        from={from}
        to={to}
        hint="el filtro de producto también recorta este panel."
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
      (board?.partners ?? []).map(
        (entry): Partner => ({
          ...entry,
          points: entry.points.filter((point) => point.year >= from && point.year <= to),
        }),
      ),
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
  const verb = flow === 'X' ? 'le vende' : 'le compra';

  return (
    <div className="panel">
      <div className="panel-head panel-head-kind">
        <div>
          <h2>
            A qué países {verb} Bolivia: mapa de calor (millones de USD, {year ?? to})
          </h2>
          <p className="panel-sub">
            El tono dice cuánto, y la clave de debajo dice qué extremo es el mayor. Tocá un país para ponerlo en el filtro de la izquierda
            y abrir su ficha aquí debajo; Ctrl/⌘ suma varios. El año es el último del rango con
            dato.
          </p>
        </div>
        <div className="chart-kind" role="group" aria-label="Flujo que pinta el mapa">
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
      {focus ? (
        <CountryCard board={board} entries={inRange} token={focus} />
      ) : (
        <p className="chart-note">
          Todavía no elegiste ningún país: la ficha con su comercio en el tiempo aparece al tocar uno
          en el mapa o en el filtro.
        </p>
      )}
    </div>
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
        entry.flow === flow && (entry.points.find((point) => point.year === year)?.value ?? 0) > value,
    ).length + 1;

  const named: NamedLine[] = [];
  if (sold) {
    named.push({
      key: 'X',
      label: 'Bolivia le vende',
      values: toMillions(sold.points),
      tone: 'var(--official)',
    });
  }
  if (bought) {
    named.push({
      key: 'M',
      label: 'Bolivia le compra',
      values: toMillions(bought.points),
      tone: 'var(--parallel)',
    });
  }
  const lines = onOneAxis(named);

  const millions = (value: number): string => `${number(value / 1_000_000, 1)} MM USD`;
  const balance = exportValue !== null && importValue !== null ? exportValue - importValue : null;

  return (
    <div className="country-card">
      <h3>
        Bolivia y {name}
        {year ? `, ${year}` : ''} (millones de USD)
      </h3>
      <dl className="country-figures">
        <div>
          <dt>Le vende</dt>
          <dd>{exportValue !== null ? millions(exportValue) : 'no está entre los 20 destinos'}</dd>
          {exportValue !== null && exportTotal ? (
            <dd className="country-aside">
              {percent((exportValue / exportTotal) * 100)} de lo exportado · puesto{' '}
              {rankOf('X', exportValue)}
            </dd>
          ) : null}
        </div>
        <div>
          <dt>Le compra</dt>
          <dd>{importValue !== null ? millions(importValue) : 'no está entre los 20 orígenes'}</dd>
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
                ? 'Bolivia le vende más de lo que le compra'
                : 'Bolivia le compra más de lo que le vende'}
            </dd>
          ) : (
            <dd className="country-aside">Hace falta el dato de los dos flujos</dd>
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
        Qué productos van a {name} no está publicado: Comtrade da, para Bolivia, el comercio por
        país y por capítulo como dos recortes separados que no se cruzan.
      </p>
    </div>
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

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Quién exporta más</h2>
        <p className="panel-sub">
          Orden y cuota de las cien primeras exportadoras en la gestión {board.exportYear ?? '—'}.
          Las diez primeras concentran el {percent(topTen)} de lo exportado.
        </p>
      </div>
      <div className="callout">
        <strong>Bolivia no publica sus exportaciones por empresa.</strong> El INE llega a producto,
        departamento y país de destino —el panorama de arriba—; la Aduana Nacional publica
        agregados; el Anuario de Minería separa por actor productivo —estatal, privado,
        cooperativo— pero nunca por razón social, porque la declaración aduanera individual está
        amparada por reserva. Esta lista viene de un agregador comercial de registros aduaneros, y
        de ella se publica <strong>el orden y la cuota, no los dólares</strong>: el total que esa
        misma fuente declara para {board.exportYear ?? 'la gestión'} no cuadra con el del INE y no
        dice sobre qué base está calculado.
      </div>
      <ShareBars data={bars} unit="%" height={520} />
      <p className="panel-sub">
        Se dibujan las {Math.min(SHOWN_EXPORTERS, board.exporters.length)} primeras de{' '}
        {board.exporters.length}. Las barras marcadas son las que además están medidas por el
        monitor de reputación: {marked} aquí, {board.crossings.length} en la lista entera. El cruce
        completo está en la pestaña «Reputación empresarial».
      </p>
    </div>
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

  const bounds = useMemo(() => yearBounds(departmentBoard, tradeBoard), [departmentBoard, tradeBoard]);
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

  const active = counts(country) + counts(chapter) + (from !== bounds.min ? 1 : 0) + (to !== bounds.max ? 1 : 0);

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
      <div className="panel">
        <div className="panel-head">
          <h2>Comercio exterior: qué vende Bolivia, a quién, y quién lo vende</h2>
          <p className="panel-sub">
            Producto, país y empresa en un mismo capítulo: el total nacional por producto desde
            2010, el agregado de exportaciones e importaciones ante Naciones Unidas desde 1992, el
            desglose por socio y por capítulo desde 2020, y el ránking de quién exporta más. Van
            juntos porque contestan la misma pregunta —qué comercia Bolivia con el resto del
            mundo, y quién lo hace— con las piezas que cada fuente sí puede sostener.
          </p>
        </div>
        <div className="callout">
          <strong>Bolivia declara su comercio exterior en dólares estadounidenses (USD).</strong>{' '}
          Lo que hay: producto, país y año, con fuentes oficiales. Lo que no hay y no va a haber:
          el valor en dólares que exporta cada empresa —es secreto por ley, así que el ránking de
          más abajo sólo publica orden y cuota— y la granularidad mensual, porque ni el INE ni
          Comtrade publican comercio exterior por mes.
        </div>
        <DerivedReading
          title="Qué dicen estos datos"
          note="Cada frase sale de las series de este capítulo, sin filtrar, y se recalcula con cada carga. Dice qué se vendió y contra qué se compara; no dice por qué ni qué va a pasar."
          conclusions={conclusions}
          icons={CONCLUSION_ICON}
          defaultOpen={false}
        />
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
      </div>

      <div className="workspace">
        <aside className="rail" id="comercio-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}
            </span>
          </div>

          <FilterHint>Recortan el panorama de arriba; el ránking de exportadoras no cambia.</FilterHint>

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
                <div className={countryChoices.length > 9 ? 'rail-list rail-list-cut' : 'rail-list'}>
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
              <p className="rail-hint">Esperando el desglose por país.</p>
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
                <div className={chapterChoices.length > 9 ? 'rail-list rail-list-cut' : 'rail-list'}>
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
              <p className="rail-hint">Esperando el desglose por producto.</p>
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
                aria-label={`Desde qué año se dibujan los gráficos: ${from}`}
                min={bounds.min}
                max={to}
                value={from}
                onChange={(event) => setYearFrom(Math.min(Number(event.target.value), to))}
                style={{ width: '100%' }}
              />
            </div>
            <div className="rail-field" style={{ marginTop: '0.4rem' }}>
              <input
                type="range"
                aria-label={`Hasta qué año se dibujan los gráficos: ${to}`}
                min={from}
                max={bounds.max}
                value={to}
                onChange={(event) => setYearTo(Math.max(Number(event.target.value), from))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </aside>

        <div className="workspace-main">
          {crossFilterGap ? (
            <div className="callout">
              <strong>País y producto no se cruzan todavía.</strong> Comtrade publica el comercio
              boliviano por socio y por capítulo del arancel como dos recortes separados del mismo
              total —no hay, para el país elegido, cuánto de ese comercio fue del capítulo
              elegido—. Abajo se ve cada filtro aplicado por su cuenta: el país en «A quién le
              vende/compra Bolivia» y el producto en «Qué capítulos exporta/importa más».
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
              No se pudo leer el comercio exterior agregado. El resto del informe sigue al día.
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
              No se pudo leer el registro de exportadoras. El resto del informe sigue al día.
            </div>
          ) : exportersBoard && exportersBoard.exporters.length ? (
            <ExportersRanking board={exportersBoard} />
          ) : (
            <div className="callout">
              Todavía no hay registro de exportadoras cargado. Esta sección se llena sola cuando el
              núcleo haya sembrado el ránking.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
