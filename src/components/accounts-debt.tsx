'use client';

import { useMemo, useState } from 'react';
import { StackedYearBars } from './accounts-charts';
import { ChipPicker, SelectField } from './accounts-controls';
import { WorldLines, seriesTone } from './charts';
import {
  debtCode,
  indexOf,
  millions,
  number,
  percent,
  spnfCode,
  subsidyCode,
  valueIn,
} from '@/lib/public-accounts-board';
import type { AccountsPayload } from '@/lib/public-accounts-board';
import { closedYears, lineRows, monthRows } from '@/lib/public-accounts-rows';
import type { Part } from '@/lib/public-accounts-rows';

/**
 * Cuánto debe el Estado, a quién, cuánto le cuestan los intereses y cuánto cuesta sostener el
 * precio de los combustibles.
 *
 * La deuda es la del Tesoro General de la Nación (la del gobierno central), por acreedor
 * afuera y por tenedor adentro, tal como la publica cada mes el Viceministerio de Tesoro y
 * Crédito Público. No incluye la de las gobernaciones, los municipios ni las empresas
 * públicas. El costo de los combustibles es la estimación del FMI, no un gasto
 * presupuestario: el Ministerio no publica la subvención como serie.
 */

const FUELS = [
  { key: 'TOTAL', label: 'Todos los combustibles' },
  { key: 'PETROLEO', label: 'Derivados del petróleo' },
  { key: 'GAS_NATURAL', label: 'Gas natural' },
] as const;

const ext = (concept: string): string => debtCode('EXT', concept);
const int = (concept: string): string => debtCode('INT', concept);

const EXTERNAL: Part[] = [
  { key: 'bid', label: 'BID', tone: seriesTone(0), codes: [ext('BANCO_INTERAMERICANO_DE_DESARROLLO')] },
  { key: 'caf', label: 'CAF', tone: seriesTone(1), codes: [ext('CORPORACION_ANDINA_DE_FOMENTO')] },
  {
    key: 'bm',
    label: 'Banco Mundial',
    tone: seriesTone(2),
    codes: [
      ext('BANCO_INTERNACIONAL_DE_RECONSTRUCCION_Y_FOME'),
      ext('ASOCIACION_INTERNACIONAL_PARA_EL_DESARROLLO'),
    ],
  },
  { key: 'china', label: 'China', tone: seriesTone(3), codes: [ext('GOB_DE_CHINA')] },
  { key: 'bonds', label: 'Bonos soberanos', tone: seriesTone(4), codes: [ext('BONOS_SOBERANOS')] },
];

const INTERNAL: Part[] = [
  { key: 'bcb', label: 'Banco Central', tone: seriesTone(0), codes: [int('BANCO_CENTRAL')] },
  { key: 'private', label: 'Sector privado', tone: seriesTone(1), codes: [int('SECTOR_PRIVADO')] },
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

export function AccountsDebt({ accounts }: { accounts: AccountsPayload }) {
  const index = useMemo(() => indexOf(accounts), [accounts]);
  const [fuel, setFuel] = useState<ReadonlySet<string>>(new Set(['TOTAL']));
  const [interestView, setInterestView] = useState<'bs' | 'tax'>('tax');
  const kind = [...fuel][0] ?? 'TOTAL';

  const externalTotal = index.get(ext('TOTAL'))?.points.at(-1);
  const internalTotal = index.get(int('TOTAL'))?.points.at(-1);
  const holder = index.get(int('BANCO_CENTRAL'))?.points.at(-1);

  const externalBars = monthRows(index, EXTERNAL, ext('TOTAL'), { key: 'rest', label: 'Otros acreedores' });
  const internalBars = monthRows(index, INTERNAL, int('TOTAL'), { key: 'rest', label: 'Otros tenedores' });

  const interest = [spnfCode('SPNF', 'INTERESES_EXTERNOS'), spnfCode('SPNF', 'INTERESES_INTERNOS')];
  const taxCode = spnfCode('SPNF', 'INGRESOS_TRIBUTARIOS');
  const interestRows = lineRows(
    index,
    [{ key: 'v', label: 'Intereses de la deuda', tone: seriesTone(2), codes: interest }],
    'bs',
    2018,
  ).map((row) => {
    if (interestView === 'bs') return row;
    const tax = valueIn(closedYears(index, taxCode), Number(row.year));
    const value = row.v;
    return { year: row.year, v: typeof value === 'number' && tax ? (value / tax) * 100 : null };
  });

  const subsidyRows = lineRows(
    index,
    [
      { key: 'explicit', label: 'Explícita (lo que paga el Estado)', tone: seriesTone(0), codes: [subsidyCode('EXPLICITA', kind)] },
      { key: 'implicit', label: 'Implícita (costos no cobrados)', tone: seriesTone(3), codes: [subsidyCode('IMPLICITA', kind)] },
    ],
    'bs',
    2015,
  );

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Cuánto debe el Tesoro y a quién</h2>
          <p className="panel-sub">
            La deuda del Tesoro General de la Nación, mes a mes: afuera, por acreedor; adentro,
            por quién tiene los bonos. Es la deuda del gobierno central, sin la de gobernaciones,
            municipios ni empresas públicas, que es adicional.
          </p>
        </div>
        <div className="stat-strip">
          {externalTotal ? (
            <Tile label="Deuda externa" value={`US$ ${number(externalTotal[1], 0)} millones`} hint={`Saldo al ${externalTotal[0].slice(0, 7)}`} />
          ) : null}
          {internalTotal ? (
            <Tile label="Deuda interna" value={millions(internalTotal[1])} hint={`Saldo al ${internalTotal[0].slice(0, 7)}`} />
          ) : null}
          {internalTotal && holder ? (
            <Tile label="La tiene el Banco Central" value={percent((holder[1] / internalTotal[1]) * 100, 0)} hint="de la deuda interna del Tesoro" />
          ) : null}
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <h2>Deuda externa, por acreedor</h2>
            <p className="panel-sub">
              Millones de dólares a fin de cada mes. «Bonos soberanos» es la deuda con
              inversionistas privados; el BID, la CAF y el Banco Mundial son organismos multilaterales.
            </p>
          </div>
          <StackedYearBars
            data={externalBars}
            series={[
              ...EXTERNAL.map((part) => ({ key: part.key, label: part.label, tone: part.tone })),
              { key: 'rest', label: 'Otros acreedores', tone: 'var(--series-rest)' },
            ]}
            format={(value) => `US$ ${number(value, 0)} mill.`}
            tick={(value) => number(value, 0)}
          />
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Deuda interna, por tenedor</h2>
            <p className="panel-sub">
              Millones de bolivianos a fin de cada mes. «Banco Central» es lo que el Tesoro le debe
              a la institución que emite el dinero.
            </p>
          </div>
          <StackedYearBars
            data={internalBars}
            series={[
              ...INTERNAL.map((part) => ({ key: part.key, label: part.label, tone: part.tone })),
              { key: 'rest', label: 'Otros tenedores', tone: 'var(--series-rest)' },
            ]}
            format={millions}
            tick={(value) => number(value, 0)}
          />
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <h2>Cuánto cuestan los intereses</h2>
            <p className="panel-sub">
              Lo que el sector público paga cada año en intereses de la deuda externa e interna, en
              bolivianos o como parte de lo que se recauda en impuestos.
            </p>
          </div>
          <div className="slicer-row">
            <SelectField
              label="Unidad"
              value={interestView}
              options={[
                { key: 'tax', label: '% de los impuestos recaudados' },
                { key: 'bs', label: 'Millones de Bs' },
              ]}
              onChange={(next) => setInterestView(next === 'bs' ? 'bs' : 'tax')}
            />
          </div>
          {interestRows.length > 1 ? (
            <WorldLines
              data={interestRows}
              series={[{ key: 'v', label: 'Intereses de la deuda', tone: seriesTone(2), emphasis: true }]}
              format={(value) => (interestView === 'tax' ? percent(value) : millions(value))}
              tick={(value) => number(value, 0)}
            />
          ) : (
            <p className="panel-sub">Sin datos de intereses.</p>
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Cuánto cuesta sostener el precio de los combustibles</h2>
            <p className="panel-sub">
              Estimación del FMI como parte del PIB. La explícita es lo que el Estado paga por
              vender el combustible más barato de lo que cuesta; la implícita suma lo que no se
              cobra —contaminación, clima, congestión— y debería.
            </p>
          </div>
          <div className="slicer-row">
            <ChipPicker label="Combustible" options={FUELS} value={fuel} onChange={setFuel} />
          </div>
          {subsidyRows.length > 1 ? (
            <WorldLines
              data={subsidyRows}
              series={[
                { key: 'explicit', label: 'Explícita (lo que paga el Estado)', tone: seriesTone(0), emphasis: true },
                { key: 'implicit', label: 'Implícita (costos no cobrados)', tone: seriesTone(3), dashed: true },
              ]}
              format={(value) => percent(value)}
              tick={(value) => number(value, 0)}
            />
          ) : (
            <p className="panel-sub">Sin datos de subvenciones.</p>
          )}
          <p className="panel-sub">
            No es un gasto del presupuesto: el Ministerio de Economía no publica este costo como
            serie. El último año es una estimación del FMI.
          </p>
        </div>
      </div>
    </>
  );
}
