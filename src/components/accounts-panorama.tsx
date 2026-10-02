'use client';

import { useMemo, useState } from 'react';
import { StackedYearBars } from './accounts-charts';
import { ChipPicker, SelectField, YearSlider, useFloor } from './accounts-controls';
import { WorldLines, seriesTone } from './charts';
import { DerivedReading } from './derived-reading';
import { Icon } from './icons';
import type { IconName } from './icons';
import {
  PERIMETERS,
  buildConclusions,
  indexOf,
  millions,
  number,
  oecdCode,
  percent,
  spnfCode,
  valueIn,
  ofGdp,
} from '@/lib/public-accounts-board';
import type { AccountsPayload } from '@/lib/public-accounts-board';
import { closedYears, lineRows, stackRows } from '@/lib/public-accounts-rows';
import type { Measure, Part } from '@/lib/public-accounts-rows';

/**
 * El tamaño del Estado de un vistazo: cuánto ingresa, cuánto gasta y de qué está hecho cada
 * lado.
 *
 * Todo sale del cuaderno de «operaciones consolidadas» del Ministerio de Economía, mensual
 * desde 2018. El lector elige el perímetro —el sector público no financiero con sus
 * empresas, el gobierno general solo, las empresas solas— y si lo ve en bolivianos o como
 * parte del PIB. El año en curso se dibuja en bolivianos y con asterisco, porque dividirlo
 * por un PIB de doce meses lo haría parecer un recorte.
 */

const ICONS: Record<string, IconName> = {
  gasto: 'balanza',
  deficit: 'tendencia',
  impuestos: 'monedas',
  sueldos: 'personas',
  carga: 'globo',
  deuda: 'banco',
  subsidio: 'rayo',
};

const spnf = (perimeter: string, concept: string): string => spnfCode(perimeter, concept);

const incomeParts = (perimeter: string): Part[] => [
  { key: 'tax', label: 'Impuestos', tone: seriesTone(0), codes: [spnf(perimeter, 'INGRESOS_TRIBUTARIOS')] },
  { key: 'idh', label: 'IDH y regalías', tone: seriesTone(1), codes: [spnf(perimeter, 'IMPUESTOS_HIDROCARBUROS')] },
  { key: 'gas', label: 'Venta de hidrocarburos', tone: seriesTone(2), codes: [spnf(perimeter, 'VENTA_HIDROCARBUROS')] },
  { key: 'firms', label: 'Otras empresas públicas', tone: seriesTone(3), codes: [spnf(perimeter, 'OTRAS_EMPRESAS')] },
];

const spendingParts = (perimeter: string): Part[] => [
  { key: 'wages', label: 'Sueldos y salarios', tone: seriesTone(0), codes: [spnf(perimeter, 'SERVICIOS_PERSONALES')] },
  { key: 'goods', label: 'Bienes y servicios', tone: seriesTone(1), codes: [spnf(perimeter, 'BIENES_SERVICIOS')] },
  { key: 'interest', label: 'Intereses de la deuda', tone: seriesTone(2), codes: [spnf(perimeter, 'INTERESES_EXTERNOS'), spnf(perimeter, 'INTERESES_INTERNOS')] },
  { key: 'transfers', label: 'Transferencias y subvenciones', tone: seriesTone(3), codes: [spnf(perimeter, 'TRANSFERENCIAS_CORRIENTES')] },
  { key: 'capital', label: 'Inversión', tone: seriesTone(4), codes: [spnf(perimeter, 'EGRESOS_CAPITAL')] },
];

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-hint">{hint}</span>
    </div>
  );
}

export function AccountsPanorama({ accounts }: { accounts: AccountsPayload }) {
  const index = useMemo(() => indexOf(accounts), [accounts]);
  const conclusions = useMemo(() => buildConclusions(accounts), [accounts]);
  const [perimeter, setPerimeter] = useState<ReadonlySet<string>>(new Set(['SPNF']));
  const [measure, setMeasure] = useState<Measure>('pib');

  const place = [...perimeter][0] ?? 'SPNF';
  const incomeSeries = closedYears(index, spnf(place, 'INGRESOS_TOTALES'));
  const firstYear = incomeSeries[0]?.year ?? 2018;
  const lastYear = incomeSeries.at(-1)?.year ?? firstYear;
  const floor = useFloor(firstYear);
  const [chosen, setChosen] = useState(firstYear);
  const from = Math.max(chosen, floor);

  const income = incomeParts(place);
  const spending = spendingParts(place);
  const lines = lineRows(
    index,
    [
      { key: 'in', label: 'Ingresos', tone: seriesTone(0), codes: [spnf(place, 'INGRESOS_TOTALES')] },
      { key: 'out', label: 'Gasto', tone: seriesTone(2), codes: [spnf(place, 'EGRESOS_TOTALES')] },
      { key: 'bal', label: 'Resultado global', tone: seriesTone(3), codes: [spnf(place, 'RESULTADO_GLOBAL')] },
    ],
    measure,
    from,
  );
  const incomeBars = stackRows(index, income, [spnf(place, 'INGRESOS_TOTALES')], measure, from, {
    key: 'rest',
    label: 'Otros ingresos',
  });
  const spendingBars = stackRows(index, spending, [spnf(place, 'EGRESOS_TOTALES')], measure, from, {
    key: 'rest',
    label: 'Otros gastos',
  });

  const spec = (parts: Part[], rest: string) => [
    ...parts.map((part) => ({ key: part.key, label: part.label, tone: part.tone })),
    { key: 'rest', label: rest, tone: 'var(--series-rest)' },
  ];
  const format = (value: number) => (measure === 'pib' ? percent(value) : millions(value));
  const tick = (value: number) => number(value, measure === 'pib' ? 0 : 0);

  const tiles = (() => {
    const read = (concept: string) => valueIn(closedYears(index, spnf(place, concept)), lastYear);
    const inc = read('INGRESOS_TOTALES');
    const out = read('EGRESOS_TOTALES');
    const bal = read('RESULTADO_GLOBAL');
    if (inc === undefined || out === undefined || bal === undefined) return null;
    const pib = (value: number) => ofGdp(index, lastYear, value);
    const share = (value: number | null) => (value === null ? '' : ` · ${percent(value)} del PIB`);
    return { inc, out, bal, share, pib };
  })();
  // La OCDE publica con un año más de retraso que el Ministerio: se toma su último año cerrado.
  const oecd = closedYears(index, oecdCode('BOL', 'TOTAL')).at(-1);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>El Estado en cifras: cuánto entra, cuánto sale</h2>
          <p className="panel-sub">
            Las cuentas del sector público no financiero que publica el Ministerio de Economía:
            lo que el Estado cobra en impuestos y vende en gas y combustibles, lo que gasta en
            sueldos, compras, intereses, subvenciones e inversión, y la diferencia que se
            financia con deuda. Elegí abajo qué parte del Estado mirar y en qué unidad.
          </p>
        </div>
        <DerivedReading
          title="Qué dicen estos datos"
          note="Cada frase sale de las series de este capítulo y se recalcula con cada carga. Dice qué nivel hay y contra qué se compara; no dice por qué ni qué va a pasar."
          conclusions={conclusions}
          icons={ICONS}
        />
        {tiles ? (
          <div className="stat-strip">
            <Tile label={`Ingresos ${lastYear}`} value={millions(tiles.inc)} hint={`${PERIMETERS.find((p) => p.key === place)?.label}${tiles.share(tiles.pib(tiles.inc))}`} />
            <Tile label={`Gasto ${lastYear}`} value={millions(tiles.out)} hint={`Gastó Bs ${number((tiles.out / tiles.inc) * 100, 0)} por cada Bs 100 que ingresaron`} />
            <Tile label={`Resultado global ${lastYear}`} value={millions(tiles.bal)} hint={`Déficit${tiles.share(tiles.pib(tiles.bal))}`} />
            {oecd ? <Tile label={`Impuestos ${oecd.year}`} value={percent(oecd.value)} hint="del PIB, con seguridad social (OCDE)" /> : null}
          </div>
        ) : null}
        <div className="slicer-row">
          <ChipPicker
            label="Qué parte del Estado"
            options={PERIMETERS.map((one) => ({ key: one.key, label: one.label, hint: one.hint }))}
            value={perimeter}
            onChange={setPerimeter}
          />
          <SelectField
            label="Unidad"
            value={measure}
            options={[
              { key: 'pib', label: '% del PIB' },
              { key: 'bs', label: 'Millones de Bs' },
            ]}
            onChange={(next) => setMeasure(next === 'bs' ? 'bs' : 'pib')}
          />
          <YearSlider label="Desde" value={from} min={Math.max(firstYear, floor)} max={lastYear} onChange={setChosen} />
        </div>
      </div>

      <div className="grid-three">
        <div className="panel">
          <div className="panel-head">
            <h2>Ingresos, gasto y resultado</h2>
            <p className="panel-sub">
              Año por año, años cerrados. Donde la línea del gasto queda por encima de la de
              ingresos, la diferencia es el déficit de ese año.
            </p>
          </div>
          {lines.length > 1 ? (
            <WorldLines
              data={lines}
              series={[
                { key: 'in', label: 'Ingresos', tone: seriesTone(0), emphasis: true },
                { key: 'out', label: 'Gasto', tone: seriesTone(2) },
                { key: 'bal', label: 'Resultado global', tone: seriesTone(3), dashed: true },
              ]}
              format={format}
              tick={tick}
            />
          ) : (
            <p className="panel-sub">Sin datos para este perímetro.</p>
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>De qué están hechos los ingresos</h2>
            <p className="panel-sub">
              Impuestos, regalías, venta de hidrocarburos por las empresas públicas y el resto.
              Cuando el gas deja de venderse, la barra de «Venta de hidrocarburos» se achica.
            </p>
          </div>
          <StackedYearBars
            data={incomeBars}
            series={spec(income, 'Otros ingresos')}
            format={format}
            tick={tick}
            note={measure === 'bs' ? '* Año en curso: suma solo los meses publicados.' : undefined}
          />
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>En qué se gasta</h2>
            <p className="panel-sub">
              Sueldos, compras, intereses, transferencias —donde están las subvenciones a los
              combustibles— e inversión. Los intereses crecen cuando la deuda crece.
            </p>
          </div>
          <StackedYearBars
            data={spendingBars}
            series={spec(spending, 'Otros gastos')}
            format={format}
            tick={tick}
            note={measure === 'bs' ? '* Año en curso: suma solo los meses publicados.' : undefined}
          />
        </div>
      </div>

      <div className="callout">
        <Icon name="info" size={14} /> <b>Por qué hay más de una cifra de déficit.</b> El Ministerio
        informó para 2025 un déficit de 12,2 % del PIB en su Rendición Pública de Cuentas, con un PIB
        estimado de unos Bs 375.000 millones. Este capítulo divide el mismo déficit por el PIB
        nominal del Banco Mundial, que es mayor, y da una proporción menor. El FMI publica además un
        resultado del gobierno general (rubro «Fiscal» de «Series de Bolivia») con otro perímetro y
        otra fecha de estimación. Las tres cifras son ciertas para lo que miden; no son
        comparables entre sí.{' '}
        <a
          className="callout-link"
          href="https://www.economiayfinanzas.gob.bo/transparencia-rendiciones-de-cuentas"
          target="_blank"
          rel="noreferrer"
        >
          Rendición Pública de Cuentas del Ministerio
        </a>
      </div>
    </>
  );
}
