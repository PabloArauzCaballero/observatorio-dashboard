'use client';

import { useMemo, useState } from 'react';
import { ChipPicker, SelectField, YearSlider, useFloor } from './accounts-controls';
import { DatedLines, WorldLines, seriesTone } from './charts';
import type { DatedLinePoint } from './charts';
import {
  PERIMETERS,
  SPNF_CONCEPTS,
  indexOf,
  millions,
  number,
  ofGdp,
  percent,
  spnfCode,
  valueIn,
} from '@/lib/public-accounts-board';
import type { AccountsPayload } from '@/lib/public-accounts-board';
import { closedYears, lineRows } from '@/lib/public-accounts-rows';
import type { Measure } from '@/lib/public-accounts-rows';

/**
 * Las cuentas del Estado concepto por concepto: elegir qué mirar, mes a mes o año a año.
 *
 * El panorama de arriba dibuja los totales y sus partes; este deja al lector armar su
 * comparación —los sueldos contra los intereses, la venta de gas contra los impuestos— en
 * cualquiera de los tres perímetros del Ministerio. Mes a mes se ve lo que un año cerrado
 * esconde: la estacionalidad de lo que entra y de lo que sale. Debajo, el cuadro del último
 * año cerrado con su variación.
 */

const DEFAULT = ['INGRESOS_TRIBUTARIOS', 'SERVICIOS_PERSONALES', 'INTERESES_INTERNOS'];

type View = 'month' | 'year';

export function AccountsBudget({ accounts }: { accounts: AccountsPayload }) {
  const index = useMemo(() => indexOf(accounts), [accounts]);
  const [perimeter, setPerimeter] = useState<ReadonlySet<string>>(new Set(['SPNF']));
  const [concepts, setConcepts] = useState<ReadonlySet<string>>(new Set(DEFAULT));
  const [view, setView] = useState<View>('month');
  const [measure, setMeasure] = useState<Measure>('bs');
  const place = [...perimeter][0] ?? 'SPNF';

  const available = SPNF_CONCEPTS.filter((concept) => index.get(spnfCode(place, concept.key)));
  const chosen = available.filter((concept) => concepts.has(concept.key));
  const firstDate = index.get(spnfCode(place, 'INGRESOS_TOTALES'))?.points[0]?.[0] ?? '2018-01-01';
  const firstYear = Number(firstDate.slice(0, 4));
  const lastYear = closedYears(index, spnfCode(place, 'INGRESOS_TOTALES')).at(-1)?.year ?? firstYear;
  const floor = useFloor(firstYear);
  const [picked, setPicked] = useState(firstYear);
  const from = Math.max(picked, floor);

  const parts = chosen.map((concept, position) => ({
    key: concept.key,
    label: concept.label,
    tone: seriesTone(position),
    codes: [spnfCode(place, concept.key)],
  }));

  const monthly = useMemo(() => {
    const dates = new Map<string, DatedLinePoint>();
    for (const concept of chosen) {
      for (const [date, value] of index.get(spnfCode(place, concept.key))?.points ?? []) {
        if (Number(date.slice(0, 4)) < from) continue;
        const row = dates.get(date) ?? { date };
        row[concept.key] = value;
        dates.set(date, row);
      }
    }
    return [...dates.values()].sort((left, right) => left.date.localeCompare(right.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, place, from, concepts]);

  const yearRows = lineRows(index, parts, measure, from);
  const table = available.map((concept) => {
    const values = closedYears(index, spnfCode(place, concept.key));
    const last = values.at(-1);
    const before = last ? valueIn(values, last.year - 1) : undefined;
    return {
      concept,
      year: last?.year,
      value: last?.value,
      before,
      share: last ? ofGdp(index, last.year, last.value) : null,
    };
  });

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Ingresos y gastos, concepto por concepto</h2>
          <p className="panel-sub">
            Armá tu propia comparación con las cuentas mensuales del Ministerio de Economía:
            elegí el perímetro, los conceptos y si querés verlos mes a mes o año a año. Mes a mes
            se ven las estaciones que un año cerrado esconde.
          </p>
        </div>
        <div className="slicer-row">
          <ChipPicker
            label="Qué parte del Estado"
            options={PERIMETERS.map((one) => ({ key: one.key, label: one.label, hint: one.hint }))}
            value={perimeter}
            onChange={setPerimeter}
          />
          <SelectField
            label="Ver"
            value={view}
            options={[
              { key: 'month', label: 'Mes a mes' },
              { key: 'year', label: 'Año a año' },
            ]}
            onChange={(next) => setView(next === 'year' ? 'year' : 'month')}
          />
          {view === 'year' ? (
            <SelectField
              label="Unidad"
              value={measure}
              options={[
                { key: 'bs', label: 'Millones de Bs' },
                { key: 'pib', label: '% del PIB' },
              ]}
              onChange={(next) => setMeasure(next === 'pib' ? 'pib' : 'bs')}
            />
          ) : null}
          <YearSlider label="Desde" value={from} min={Math.max(firstYear, floor)} max={lastYear} onChange={setPicked} />
        </div>
        <ChipPicker
          label="Conceptos"
          options={available.map((concept) => ({
            key: concept.key,
            label: concept.label,
            hint: concept.side === 'ingreso' ? 'Ingreso' : concept.side === 'gasto' ? 'Gasto' : 'Resultado',
          }))}
          value={concepts}
          onChange={setConcepts}
          multi
          base={new Set(DEFAULT)}
        />
        {chosen.length === 0 ? (
          <p className="panel-sub">Elegí al menos un concepto.</p>
        ) : view === 'month' ? (
          <DatedLines
            data={monthly}
            series={chosen.map((concept, position) => ({
              key: concept.key,
              label: concept.label,
              tone: seriesTone(position),
              emphasis: position === 0,
            }))}
            unit="millones de Bs"
            decimals={0}
            monthly
            yearTicks
          />
        ) : (
          <WorldLines
            data={yearRows}
            series={chosen.map((concept, position) => ({
              key: concept.key,
              label: concept.label,
              tone: seriesTone(position),
              emphasis: position === 0,
            }))}
            format={(value) => (measure === 'pib' ? percent(value) : millions(value))}
            tick={(value) => number(value, 0)}
          />
        )}
        <p className="panel-sub">
          Cifras preliminares del Ministerio de Economía y Finanzas Públicas, en millones de
          bolivianos corrientes.{' '}
          {view === 'year' ? 'Solo años cerrados.' : 'El último mes es el último publicado.'}
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Las cuentas del último año cerrado</h2>
          <p className="panel-sub">
            {PERIMETERS.find((one) => one.key === place)?.label}, año {lastYear}, con la variación
            frente al año anterior y la proporción del PIB.
          </p>
        </div>
        <div className="table-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">Concepto</th>
                <th scope="col">Millones de Bs</th>
                <th scope="col">Frente al año anterior</th>
                <th scope="col">% del PIB</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) =>
                row.value === undefined ? null : (
                  <tr key={row.concept.key}>
                    <th scope="row">{row.concept.label}</th>
                    <td>{number(row.value, 0)}</td>
                    <td>
                      {row.before ? `${row.value >= row.before ? '+' : ''}${number(((row.value - row.before) / Math.abs(row.before)) * 100, 1)} %` : '—'}
                    </td>
                    <td>{row.share === null ? '—' : percent(row.share)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <p className="panel-sub">
          El PIB es el nominal del Banco Mundial. Un resultado negativo es déficit.
        </p>
      </div>
    </>
  );
}
