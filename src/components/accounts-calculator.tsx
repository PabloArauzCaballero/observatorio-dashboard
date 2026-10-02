'use client';

import { useState } from 'react';
import { ChipPicker, SelectField } from './accounts-controls';
import { ShareBars } from './charts';
import type { ShareSlice } from './charts';
import { domesticSale, importedGood, payroll, TARIFF_NOW } from '@/lib/tax-norms';
import type { Breakdown } from '@/lib/tax-norms';
import { number, percent } from '@/lib/public-accounts-board';

/**
 * «¿Cuánto de esto es impuesto?», con la norma en la mano.
 *
 * Tres preguntas que se contestan con las alícuotas de la tabla de abajo y no con datos:
 * qué parte del precio de algo que se compra en el país es IVA e IT, qué se paga en la
 * frontera por algo que se importa, y qué se lleva el sistema de pensiones de un sueldo. El
 * lector cambia el monto, el número de ventas por las que pasó el bien o el arancel, y ve
 * cómo se mueve el reparto. Las cuentas están en `tax-norms.ts` y probadas a mano.
 */

type Mode = 'venta' | 'importacion' | 'sueldo';

const MODES = [
  { key: 'venta', label: 'Algo que se compra en el país', hint: 'IVA e IT sobre el precio final' },
  { key: 'importacion', label: 'Algo que se importa', hint: 'Arancel e IVA de importación en la frontera' },
  { key: 'sueldo', label: 'Un sueldo', hint: 'Aportes a pensiones y salud, del trabajador y del empleador' },
] as const;

const bs = (value: number): string => `Bs ${number(value, 2)}`;

function amountOf(text: string, fallback: number): number {
  const value = Number(text.replace(/\./gu, '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-hint">{hint}</span>
    </div>
  );
}

function slices(result: Breakdown, keptLabel: string): ShareSlice[] {
  return [
    { name: keptLabel, value: result.kept, emphasis: true },
    ...result.taxes.map((slice) => ({ name: slice.label, value: slice.value })),
  ];
}

export function AccountsCalculator() {
  const [mode, setMode] = useState<ReadonlySet<string>>(new Set(['venta']));
  const [text, setText] = useState('100');
  const [steps, setSteps] = useState(3);
  const [tariff, setTariff] = useState('10');
  const kind = ([...mode][0] ?? 'venta') as Mode;
  const amount = amountOf(text, kind === 'sueldo' ? 8000 : 100);

  const sale = domesticSale(amount, steps);
  const entry = importedGood(amount, Number(tariff));
  const pay = payroll(amount);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>¿Cuánto de esto es impuesto?</h2>
        <p className="panel-sub">
          Cambiá el monto y lo que se aplica; las cuentas usan las alícuotas de la tabla de abajo.
          Son una ilustración de lo que dice la norma sobre un caso simple, no la declaración de
          nadie: no incluyen el IUE de la empresa, el ICE ni los créditos fiscales de cada
          contribuyente.
        </p>
      </div>
      <div className="slicer-row">
        <ChipPicker
          label="Qué querés calcular"
          options={MODES}
          value={mode}
          onChange={(next) => {
            setMode(next);
            const chosen = [...next][0];
            setText(chosen === 'sueldo' ? '8000' : '100');
          }}
        />
        <label className="slicer">
          <span className="slicer-label">
            {kind === 'venta' ? 'Precio final, con IVA (Bs)' : kind === 'importacion' ? 'Valor CIF (Bs)' : 'Sueldo bruto por mes (Bs)'}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label="Monto en bolivianos"
          />
        </label>
        {kind === 'venta' ? (
          <label className="slicer">
            <span className="slicer-label">
              Ventas por las que pasó: <output>{steps}</output>
            </span>
            <input
              type="range"
              min={1}
              max={6}
              value={steps}
              aria-label={`Ventas por las que pasó el bien: ${steps}`}
              onChange={(event) => setSteps(Number(event.target.value))}
            />
          </label>
        ) : null}
        {kind === 'importacion' ? (
          <SelectField
            label="Arancel vigente"
            value={tariff}
            options={TARIFF_NOW.map((rate) => ({ key: String(rate), label: `${rate} %` }))}
            onChange={setTariff}
          />
        ) : null}
      </div>

      {kind === 'venta' ? (
        <>
          <div className="stat-strip">
            <Tile label="Es impuesto" value={bs(sale.taxTotal)} hint={`${percent(sale.taxShare)} del precio de ${bs(sale.total)}`} />
            <Tile label="IVA" value={bs(sale.taxes[0]?.value ?? 0)} hint="13 % del precio final: es el mismo con cualquier número de ventas" />
            <Tile label="IT" value={bs(sale.taxes[1]?.value ?? 0)} hint={`Se acumula: 3 % de cada una de las ${steps} ventas`} />
          </div>
          <ShareBars data={slices(sale, 'Queda para quien lo produce y vende')} unit="Bs" height={150} />
          <p className="panel-sub">
            Se supone que cada venta agrega la misma parte del precio. El IVA se paga una vez en
            toda la cadena porque cada eslabón descuenta el de la compra; el IT no se descuenta, y
            por eso pesa más cuanto más largo es el camino. Una empresa con utilidades puede
            acreditar el IT contra el IUE.
          </p>
        </>
      ) : null}

      {kind === 'importacion' ? (
        <>
          <div className="stat-strip">
            <Tile label="Se paga al entrar" value={bs(entry.taxTotal)} hint={`${percent((entry.taxTotal / amount) * 100)} del valor CIF`} />
            <Tile label="Costo nacionalizado" value={bs(entry.total)} hint={`${percent(entry.taxShare)} de eso es impuesto`} />
          </div>
          <ShareBars data={slices(entry, 'Valor de la mercadería (CIF)')} unit="Bs" height={150} />
          <p className="panel-sub">
            El IVA de importación es crédito fiscal del importador: se recupera al vender, y la
            venta paga después su propio IVA e IT como en el caso anterior. El arancel es el que
            rige desde el 6 de julio de 2026, cinco puntos más bajo en cada tramo.
          </p>
        </>
      ) : null}

      {kind === 'sueldo' ? (
        <>
          <div className="stat-strip">
            <Tile label="Líquido del trabajador" value={bs(pay.net)} hint={`De ${bs(pay.gross)} brutos`} />
            <Tile label="Costo para el empleador" value={bs(pay.employerCost)} hint="Sueldo más aportes patronales" />
            <Tile label="Aportes sobre el costo" value={percent(pay.wedge)} hint="Los de ambos lados, como parte de lo que cuesta el puesto" />
          </div>
          <ShareBars
            data={[
              { name: 'Líquido del trabajador', value: pay.net, emphasis: true },
              { name: 'Aporte del trabajador a pensiones', value: pay.workerPension },
              { name: 'Aporte solidario del trabajador', value: pay.solidarity },
              { name: 'Aporte patronal a pensiones', value: pay.employerPension },
              { name: 'Aporte patronal a salud', value: pay.employerHealth },
            ]}
            unit="Bs"
            height={190}
          />
          <p className="panel-sub">
            Solo aportes a pensiones y salud. No incluye el RC-IVA, que depende de las facturas
            que presente cada persona. Las alícuotas de aportes solo se confirmaron en parte en el
            texto de la ley: la tabla de abajo marca cuáles.
          </p>
        </>
      ) : null}
    </div>
  );
}
