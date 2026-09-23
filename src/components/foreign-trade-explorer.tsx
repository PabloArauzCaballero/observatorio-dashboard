'use client';

import { useMemo } from 'react';
import { MacroChart, ShareBars, WorldLines, seriesTone } from './charts';
import { DerivedReading } from './derived-reading';
import type { IconName } from './icons';
import { onOneAxis } from './department-lines';
import { nationalProductMix, nationalTopProducts } from '@/lib/departments-board';
import type { DepartmentBoard, ProductLine } from '@/lib/departments-board';
import { foreignTradeConclusions } from '@/lib/foreign-trade-board';
import type { ComtradeDetail, ForeignTradeBoard } from '@/lib/foreign-trade-board';

/**
 * Qué vende Bolivia afuera y qué compra, por producto y por país.
 *
 * Falta desde siempre en «Empresas»: la pestaña «Exportadoras» contesta quién
 * exporta más —el ránking de un agregador comercial, en orden y cuota, nunca
 * en dólares— y esta contesta una pregunta distinta, qué se exporta, con qué
 * lo compara el INE y qué le compra el país al resto del mundo. Va al lado de
 * «Exportadoras» y no dentro de «Bolivia ante el mundo» porque esa pestaña ya
 * tiene su «Comercio» —canales de compra de los hogares, encuestas de
 * `MarketsExplorer`— y es una pregunta enteramente distinta a ésta; meter las
 * dos bajo el mismo rótulo confundiría comercio interno con comercio exterior.
 *
 * **Lo que hay.** El total nacional por producto no lo publica el INE como
 * una fila abierta —«TOTAL» y «NATIONAL» son un solo número— así que se
 * construye sumando las nueve líneas departamentales que comparten producto;
 * `departments-board.ts` explica por qué esa suma es exacta y no una
 * aproximación. Es la serie 2010-{`board.tradeYear`}, en dólares y en
 * toneladas. El agregado de importaciones y exportaciones sale de Comtrade,
 * la base de comercio de Naciones Unidas, desde 1992.
 *
 * **Lo que no hay y por qué.** Ninguna fila de aquí tiene nombre de empresa
 * —Bolivia no publica esa cifra, la declaración aduanera individual está
 * amparada por reserva— ni granularidad mensual —el INE y Comtrade publican
 * por gestión, no por mes—. El desglose por producto y por socio desde 2020
 * está en camino desde el núcleo; hasta que llegue, ese panel dice que está
 * esperando la carga en vez de inventar una estructura.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Cuántos productos entran en la barra sin que deje de leerse. */
const SHOWN_PRODUCTS = 15;

/** Cuántos productos se siguen en el tiempo. Más de cinco líneas no se leen. */
const TOP = 5;

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

/** La parte que ya existe: el producto nacional, sumando los nueve departamentos. */
function ProductChapter({ board }: { board: DepartmentBoard }) {
  const year = board.tradeYear;
  const mixUsd = useMemo(() => nationalProductMix(board, year, 'usd'), [board, year]);
  const mixTonnes = useMemo(() => nationalProductMix(board, year, 'tonnes'), [board, year]);
  const leading = useMemo(() => nationalTopProducts(board, year, TOP), [board, year]);
  const leadingUsd = useMemo(() => productLines(leading, 'usd'), [leading]);
  const leadingTonnes = useMemo(() => productLines(leading, 'tonnes'), [leading]);

  if (!mixUsd.length) {
    return (
      <div className="callout">
        Todavía no hay comercio exterior por departamento cargado; este panel se llena solo cuando
        el núcleo lo siembre.
      </div>
    );
  }

  return (
    <div className="grid-three">
      <div className="panel">
        <div className="panel-head">
          <h2>Qué exporta Bolivia, por producto ({year}, millones de USD)</h2>
          <p className="panel-sub">
            Los {Math.min(SHOWN_PRODUCTS, mixUsd.length)} productos principales de{' '}
            {mixUsd.length} que el INE publica, sumando los nueve departamentos. Es el total
            nacional que no viene como una fila abierta en el cuadro original.
          </p>
        </div>
        <ShareBars data={mixUsd.slice(0, SHOWN_PRODUCTS)} unit=" MM USD" height={420} />
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Cuánto pesa lo que exporta (toneladas, {year})</h2>
          <p className="panel-sub">
            El mismo año en peso neto. El orden cambia frente al de dólares: el gas no pesa nada en
            un puerto y el mineral pesa mucho sin valer lo mismo.
          </p>
        </div>
        {mixTonnes.length ? (
          <ShareBars data={mixTonnes.slice(0, SHOWN_PRODUCTS)} unit=" t" height={420} />
        ) : (
          <div className="callout">Sin peso publicado para {year}.</div>
        )}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>
            Los {leading.length} productos principales en el tiempo (millones de USD, desde 2010)
          </h2>
          <p className="panel-sub">
            Los que más valieron en {year}, seguidos hacia atrás. «Otros productos» queda fuera: es
            el residuo con el que cierra cada departamento, no un producto que se pueda seguir.
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
          <div className="callout">Sin serie suficiente para dibujar.</div>
        )}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Los mismos productos, en peso (toneladas, desde 2010)</h2>
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
          <div className="callout">Sin serie suficiente para dibujar.</div>
        )}
      </div>
    </div>
  );
}

/** La parte agregada: lo que Comtrade recoge de Bolivia, un número por año. */
function ComtradeChapter({ board }: { board: ForeignTradeBoard | null }) {
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
            Lo que Bolivia declaró a Comtrade desde 1992, agregado: sin producto ni socio todavía.
            Coincide con el «total declarado» del INE por departamento en los años en que ambos
            publican.
          </p>
        </div>
        {board.exportsUsd.length > 1 ? (
          <MacroChart
            data={asMacroSeries(board.exportsUsd).map((point) => ({
              ...point,
              value: point.value / 1_000_000,
            }))}
            unit="millones de USD"
            tone="var(--official)"
            label="Exportaciones de bienes"
          />
        ) : (
          <div className="callout">Sin serie de exportaciones agregadas.</div>
        )}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Importaciones de bienes ante Naciones Unidas (millones de USD)</h2>
          <p className="panel-sub">
            Lo que compró Bolivia afuera, mismo agregado y misma fuente. Es la mitad que
            «Exportadoras» nunca mostró: nada en este tablero decía hasta hoy qué le compra el
            país al resto del mundo.
          </p>
        </div>
        {board.importsUsd.length > 1 ? (
          <MacroChart
            data={asMacroSeries(board.importsUsd).map((point) => ({
              ...point,
              value: point.value / 1_000_000,
            }))}
            unit="millones de USD"
            tone="var(--parallel)"
            label="Importaciones de bienes"
          />
        ) : (
          <div className="callout">Sin serie de importaciones agregadas.</div>
        )}
      </div>
    </div>
  );
}

/** El detalle por producto y por socio desde 2020, cuando el núcleo lo siembre. */
function DetailChapter({ detail }: { detail: readonly ComtradeDetail[] }) {
  if (!detail.length) {
    return (
      <div className="callout">
        <strong>Esperando la carga.</strong> El desglose por producto y por país desde 2020 lo está
        sembrando el núcleo en paralelo a este capítulo. Cuando lleguen las primeras series con
        código <code>COMTRADE_</code> distinto de los dos agregados, este panel las dibuja solo; por
        ahora no hay ninguna, y no es un fallo del tablero.
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Detalle de Comtrade por producto y por socio ({detail.length} series)</h2>
        <p className="panel-sub">
          Recién sembrado: se lista sin agrupar mientras el capítulo aprende la forma exacta de los
          códigos nuevos.
        </p>
      </div>
      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Serie</th>
              <th className="num">Último año</th>
              <th className="num">Valor</th>
            </tr>
          </thead>
          <tbody>
            {detail.map((entry) => {
              const last = entry.points.at(-1);
              return (
                <tr key={entry.code}>
                  <td>
                    {entry.name ?? entry.code}
                    <br />
                    <span className="stat-hint">
                      <code>{entry.code}</code>
                    </span>
                  </td>
                  <td className="num">{last?.year ?? '—'}</td>
                  <td className="num">{last ? number(last.value, 0) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ForeignTradeExplorer({
  departmentBoard,
  tradeBoard,
  tradeFailed,
}: {
  departmentBoard: DepartmentBoard;
  tradeBoard: ForeignTradeBoard | null;
  tradeFailed: boolean;
}) {
  const conclusions = useMemo(
    () => foreignTradeConclusions(departmentBoard, tradeBoard),
    [departmentBoard, tradeBoard],
  );

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Comercio exterior: qué vende Bolivia y qué compra</h2>
          <p className="panel-sub">
            Producto y país, no empresa: el total nacional por producto desde 2010, sumando los
            nueve departamentos, y el agregado de exportaciones e importaciones que Bolivia declara
            ante Naciones Unidas desde 1992. El detalle por país y por producto desde 2020 llega
            cuando el núcleo termine de sembrarlo.
          </p>
        </div>
        {/*
          El aviso va arriba de las figuras, igual que en «Exportadoras»: es la
          condición bajo la que hay que leer todo lo que sigue, no un pie que
          nadie llega a bajar a ver.
        */}
        <div className="callout">
          <strong>Bolivia declara su comercio exterior en dólares estadounidenses (USD).</strong>{' '}
          Lo que sí hay aquí: producto, año —desde 2010 el nacional, desde 1992 el agregado de
          Comtrade— y país cuando el desglose termine de cargar. Lo que no hay y no va a haber: el
          valor en dólares que exporta cada empresa —es secreto por ley, y el ránking de la pestaña
          «Exportadoras» sólo publica orden y cuota— y la granularidad mensual, porque ni el INE ni
          Comtrade publican comercio exterior por mes.
        </div>
        <DerivedReading
          title="Qué dicen estos datos"
          note="Cada frase sale de las series de este capítulo y se recalcula con cada carga. Dice qué se vendió y contra qué se compara; no dice por qué ni qué va a pasar."
          conclusions={conclusions}
          icons={CONCLUSION_ICON}
          defaultOpen={false}
        />
      </div>

      <ProductChapter board={departmentBoard} />

      <div className="panel">
        <div className="panel-head">
          <h2>Importaciones y exportaciones agregadas (Comtrade, ONU)</h2>
          <p className="panel-sub">
            Un número por año, sin producto ni socio todavía. Es la primera vez que este tablero
            muestra qué le compra Bolivia al resto del mundo.
          </p>
        </div>
        {tradeFailed ? (
          <div className="callout">
            No se pudo leer el comercio exterior agregado. El resto del informe sigue al día.
          </div>
        ) : (
          <ComtradeChapter board={tradeBoard} />
        )}
      </div>

      <DetailChapter detail={tradeBoard?.detail ?? []} />
    </>
  );
}
