'use client';

import { useMemo, useState } from 'react';
import { StackedYearBars } from './accounts-charts';
import { ChipPicker, SelectField, YearSlider } from './accounts-controls';
import { WorldLines, seriesTone } from './charts';
import {
  BCB_TAXES,
  OECD_MEASURES,
  OECD_PLACES,
  bcbTaxCode,
  indexOf,
  millions,
  number,
  oecdCode,
  percent,
} from '@/lib/public-accounts-board';
import type { AccountsPayload } from '@/lib/public-accounts-board';
import { lineRows, stackRows } from '@/lib/public-accounts-rows';
import type { Measure, Part } from '@/lib/public-accounts-rows';

/**
 * Cuánto recauda el Estado y de qué impuestos.
 *
 * Tres lecturas de dos fuentes que no se pisan. Las estadísticas tributarias de la OCDE y la
 * CEPAL ponen a Bolivia al lado de sus vecinos con la misma clasificación, en proporción del
 * PIB, desde 1990. El cuadro 13.05 del Banco Central da, impuesto por impuesto y en
 * bolivianos, lo que recaudan el SIN y la Aduana desde 2005, con el IDH que la OCDE no
 * cuenta como impuesto. El lector elige países, medida, impuestos y desde qué año.
 */

const DEFAULT_PLACES = ['BOL', 'PER', 'CHL', 'BRA', 'ARG'];
const DEFAULT_TAXES = ['IVA_MERCADO_INTERNO', 'IVA_IMPORTACIONES', 'IUE', 'IT', 'IDH'];

const MEASURE_UNITS = [
  { key: 'pib', label: '% del PIB' },
  { key: 'share', label: '% de toda la recaudación' },
] as const;

const OECD_KINDS = [
  { key: 'RENTA', label: 'Renta y utilidades', tone: seriesTone(0) },
  { key: 'SEGURIDAD_SOCIAL', label: 'Seguridad social', tone: seriesTone(1) },
  { key: 'BIENES_SERVICIOS', label: 'Bienes y servicios (IVA, selectivos, aduanas)', tone: seriesTone(2) },
  { key: 'PROPIEDAD', label: 'Propiedad', tone: seriesTone(3) },
  { key: 'OTROS', label: 'Otros', tone: seriesTone(4) },
] as const;

export function AccountsRevenue({ accounts }: { accounts: AccountsPayload }) {
  const index = useMemo(() => indexOf(accounts), [accounts]);
  const [places, setPlaces] = useState<ReadonlySet<string>>(new Set(DEFAULT_PLACES));
  const [oecdMeasure, setOecdMeasure] = useState('TOTAL');
  const [oecdUnit, setOecdUnit] = useState<'pib' | 'share'>('pib');
  const [kindPlace, setKindPlace] = useState('BOL');
  const [oecdFrom, setOecdFrom] = useState(1995);
  const [taxes, setTaxes] = useState<ReadonlySet<string>>(new Set(DEFAULT_TAXES));
  const [bcbMeasure, setBcbMeasure] = useState<Measure>('bs');
  const [bcbFrom, setBcbFrom] = useState(2005);

  const chosenPlaces = OECD_PLACES.filter((place) => places.has(place.key));
  const oecdParts: Part[] = chosenPlaces.map((place, position) => ({
    key: place.key,
    label: place.label,
    tone: seriesTone(position),
    codes: [oecdCode(place.key, oecdMeasure)],
  }));
  const oecdLines = (() => {
    if (oecdUnit === 'pib') return lineRows(index, oecdParts, 'bs', oecdFrom);
    // Parte de toda la recaudación: la medida dividida por el total del mismo país y año.
    return lineRows(index, oecdParts, 'bs', oecdFrom).map((row) => {
      const next: typeof row = { year: row.year };
      for (const place of chosenPlaces) {
        const value = row[place.key];
        const total = index
          .get(oecdCode(place.key, 'TOTAL'))
          ?.points.find(([date]) => date.startsWith(row.year))?.[1];
        next[place.key] = typeof value === 'number' && total ? (value / total) * 100 : null;
      }
      return next;
    });
  })();
  const oecdLabel = OECD_MEASURES.find((one) => one.key === oecdMeasure)?.label ?? '';

  const kindBars = stackRows(
    index,
    OECD_KINDS.map((kind) => ({
      key: kind.key,
      label: kind.label,
      tone: kind.tone,
      codes: [oecdCode(kindPlace, kind.key)],
    })),
    [oecdCode(kindPlace, 'TOTAL')],
    'bs',
    oecdFrom,
  );

  const chosenTaxes = BCB_TAXES.filter((tax) => taxes.has(tax.key));
  const taxLines = lineRows(
    index,
    chosenTaxes.map((tax, position) => ({
      key: tax.key,
      label: tax.label,
      tone: seriesTone(position),
      codes: [bcbTaxCode(tax.key)],
    })),
    bcbMeasure,
    bcbFrom,
  );
  const groups: Part[] = [
    { key: 'iva', label: 'IVA', tone: seriesTone(0), codes: [bcbTaxCode('IVA_MERCADO_INTERNO'), bcbTaxCode('IVA_IMPORTACIONES')] },
    { key: 'iue', label: 'IUE', tone: seriesTone(1), codes: [bcbTaxCode('IUE')] },
    { key: 'it', label: 'IT', tone: seriesTone(2), codes: [bcbTaxCode('IT')] },
    { key: 'hc', label: 'IDH y combustibles', tone: seriesTone(3), codes: [bcbTaxCode('IDH'), bcbTaxCode('IEHD'), bcbTaxCode('IEHD_REFINERIAS')] },
    { key: 'ga', label: 'Aranceles', tone: seriesTone(4), codes: [bcbTaxCode('GRAVAMEN_ARANCELARIO')] },
  ];
  const groupBars = stackRows(index, groups, [bcbTaxCode('TOTAL')], bcbMeasure, bcbFrom, {
    key: 'rest',
    label: 'Otros impuestos',
  });

  const pibFormat = (value: number) => percent(value);
  const bcbFormat = (value: number) => (bcbMeasure === 'pib' ? percent(value) : millions(value));
  const tick = (value: number) => number(value, 0);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Bolivia frente a sus vecinos</h2>
          <p className="panel-sub">
            Cuánto recauda cada país en impuestos, medido igual en todos: la OCDE, la CEPAL, el
            CIAT y el BID usan una sola clasificación, así que «bienes y servicios» de Bolivia y de
            Chile quieren decir lo mismo. Incluye las contribuciones a la seguridad social y no
            cuenta el IDH ni las regalías, que son renta del subsuelo.
          </p>
        </div>
        <div className="slicer-row">
          <ChipPicker
            label="Países"
            options={OECD_PLACES}
            value={places}
            onChange={setPlaces}
            multi
            base={new Set(['BOL'])}
          />
          <SelectField
            label="Qué impuesto"
            value={oecdMeasure}
            options={OECD_MEASURES}
            onChange={setOecdMeasure}
          />
          <SelectField
            label="Cómo se mide"
            value={oecdUnit}
            options={MEASURE_UNITS}
            onChange={(next) => setOecdUnit(next === 'share' ? 'share' : 'pib')}
          />
          <YearSlider label="Desde" value={oecdFrom} min={1990} max={2022} onChange={setOecdFrom} />
        </div>
        {oecdLines.length > 1 && oecdParts.length > 0 ? (
          <WorldLines
            data={oecdLines}
            series={oecdParts.map((part) => ({
              key: part.key,
              label: part.label,
              tone: part.tone,
              emphasis: part.key === 'BOL',
            }))}
            format={pibFormat}
            tick={tick}
          />
        ) : (
          <p className="panel-sub">Elegí al menos un país.</p>
        )}
        <p className="panel-sub">
          {oecdLabel}, {oecdUnit === 'pib' ? 'como parte del PIB' : 'como parte de todo lo que ese país recauda'}.
          Fuente: Estadísticas tributarias de América Latina y el Caribe, OCDE · CEPAL · CIAT · BID.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Qué tipo de impuestos cobra cada país</h2>
          <p className="panel-sub">
            Las partes de la recaudación total, como parte del PIB: renta, seguridad social, bienes
            y servicios (que incluye el IVA, los selectivos y las aduanas), propiedad y otros. Elegí
            el país para ver su mezcla y compararla con la de otro.
          </p>
        </div>
        <div className="slicer-row">
          <SelectField label="País" value={kindPlace} options={OECD_PLACES} onChange={setKindPlace} />
        </div>
        <StackedYearBars
          data={kindBars}
          series={OECD_KINDS.map((kind) => ({ key: kind.key, label: kind.label, tone: kind.tone }))}
          format={pibFormat}
          tick={tick}
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Impuesto por impuesto, en bolivianos</h2>
          <p className="panel-sub">
            Lo que recaudan el SIN y la Aduana Nacional, según el cuadro 13.05 del Boletín
            Estadístico del Banco Central. Elegí los impuestos que quieras comparar; el IDH está
            aquí aunque la OCDE no lo cuente.
          </p>
        </div>
        <div className="slicer-row">
          <ChipPicker
            label="Impuestos"
            options={BCB_TAXES}
            value={taxes}
            onChange={setTaxes}
            multi
            base={new Set(DEFAULT_TAXES)}
          />
          <SelectField
            label="Unidad"
            value={bcbMeasure}
            options={[
              { key: 'bs', label: 'Millones de Bs' },
              { key: 'pib', label: '% del PIB' },
            ]}
            onChange={(next) => setBcbMeasure(next === 'pib' ? 'pib' : 'bs')}
          />
          <YearSlider label="Desde" value={bcbFrom} min={2005} max={2023} onChange={setBcbFrom} />
        </div>
        {taxLines.length > 1 && chosenTaxes.length > 0 ? (
          <WorldLines
            data={taxLines}
            series={chosenTaxes.map((tax, position) => ({
              key: tax.key,
              label: tax.label,
              tone: seriesTone(position),
              emphasis: position === 0,
            }))}
            format={bcbFormat}
            tick={tick}
          />
        ) : (
          <p className="panel-sub">Elegí al menos un impuesto.</p>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>De dónde sale lo que recauda el SIN y la Aduana</h2>
          <p className="panel-sub">
            Las partes de la recaudación total, año por año: cuánto pesa cada familia de impuestos
            y cómo cambia el reparto. La barra cierra con el total del cuadro: lo que no entra en
            las cinco partes queda en «Otros impuestos».
          </p>
        </div>
        <StackedYearBars
          data={groupBars}
          series={[
            ...groups.map((part) => ({ key: part.key, label: part.label, tone: part.tone })),
            { key: 'rest', label: 'Otros impuestos', tone: 'var(--series-rest)' },
          ]}
          format={bcbFormat}
          tick={tick}
        />
        <p className="panel-sub">
          Los años 2021 a 2024 son preliminares. Desde 2023 el cuadro reparte distinto las
          facilidades de pago: el IUE de 2024 es Bs 6.343 millones aquí y Bs 7.933 en el Boletín
          Económico de Ingresos Tributarios del Ministerio. Se cita el cuadro tal cual, sin
          mezclar las dos convenciones.
        </p>
      </div>
    </>
  );
}
