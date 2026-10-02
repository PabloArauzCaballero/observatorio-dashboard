'use client';

import { useMemo, useState } from 'react';
import { AccountsCalculator } from './accounts-calculator';
import { ChipPicker } from './accounts-controls';
import { Icon } from './icons';
import {
  CONFIRMATION_LABEL,
  NORMS,
  NORMS_AS_OF,
  NORM_GROUP_LABEL,
  TARIFF_SHIFT,
} from '@/lib/tax-norms';
import type { Confirmation, NormGroup } from '@/lib/tax-norms';

/**
 * Qué dicen las normas: cada impuesto con su alícuota, su base, quién lo recauda y a dónde
 * va, y cómo se confirmó.
 *
 * El lector filtra por tipo de impuesto y por cómo se confirmó, y busca por nombre o por
 * norma. La marca de confirmación no es decoración: en 2026 cambiaron el ITF, los aranceles,
 * el crédito fiscal de combustibles y el precio del diésel, y una tabla que no dijera qué
 * filas se leyeron en el texto de la norma y cuáles solo en prensa estaría afirmando más de
 * lo que sabe.
 */

const GROUPS = (Object.keys(NORM_GROUP_LABEL) as NormGroup[]).map((key) => ({
  key,
  label: NORM_GROUP_LABEL[key],
}));
const CONFIRMATIONS = (Object.keys(CONFIRMATION_LABEL) as Confirmation[]).map((key) => ({
  key,
  label: CONFIRMATION_LABEL[key],
}));

const normalise = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase();

export function AccountsNorms() {
  const [group, setGroup] = useState<ReadonlySet<string>>(new Set());
  const [confirmation, setConfirmation] = useState<ReadonlySet<string>>(new Set());
  const [search, setSearch] = useState('');

  const shown = useMemo(() => {
    const words = normalise(search).split(/\s+/u).filter(Boolean);
    return NORMS.filter(
      (norm) =>
        (group.size === 0 || group.has(norm.group)) &&
        (confirmation.size === 0 || confirmation.has(norm.confirmation)) &&
        words.every((word) =>
          normalise(`${norm.name} ${norm.norm} ${norm.rate} ${norm.base}`).includes(word),
        ),
    );
  }, [group, confirmation, search]);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Qué dicen las normas</h2>
          <p className="panel-sub">
            Los impuestos y tasas que fijan las leyes y decretos de Bolivia, verificados el{' '}
            {NORMS_AS_OF}. En 2026 cambiaron varios: se eliminó el impuesto a las transacciones
            financieras, bajaron los aranceles, el diésel dejó de subvencionarse y se aprobó el IVA
            «por fuera». Cada fila dice si se leyó el texto de la norma o solo se vio en prensa.
          </p>
        </div>
      </div>

      <AccountsCalculator />

      <div className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <h2>Aranceles: cinco puntos menos en cada tramo</h2>
            <p className="panel-sub">
              Desde el 6 de julio de 2026 y hasta fines de 2027, cada alícuota del gravamen
              arancelario bajó cinco puntos (DS 5646). La escala llega ahora a 35 %.
            </p>
          </div>
          <div className="table-wrap" style={{ maxHeight: "none" }}>
            <table className="grid-table accounts-table">
              <thead>
                <tr>
                  <th scope="col">Antes</th>
                  <th scope="col">Ahora</th>
                </tr>
              </thead>
              <tbody>
                {TARIFF_SHIFT.map((step) => (
                  <tr key={step.before}>
                    <td>{step.before} %</td>
                    <td>
                      <b>{step.now} %</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-sub">
            Fuente: prensa y un agregador normativo; el texto del decreto no se pudo bajar de la
            Gaceta Oficial.
          </p>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>A dónde va lo que se recauda</h2>
            <p className="panel-sub">
              De los impuestos nacionales que se reparten, tres cuartas partes se quedan en el
              Tesoro, una quinta va a los municipios y una veinteava a las universidades. Las
              gobernaciones reclaman un 15 % directo en la agenda de descentralización.
            </p>
          </div>
          <div className="stat-strip">
            <div className="stat">
              <span className="stat-label">Tesoro General</span>
              <span className="stat-value">75 %</span>
              <span className="stat-hint">Ley 031, coparticipación</span>
            </div>
            <div className="stat">
              <span className="stat-label">Municipios</span>
              <span className="stat-value">20 %</span>
              <span className="stat-hint">Ley 031, coparticipación</span>
            </div>
            <div className="stat">
              <span className="stat-label">Universidades</span>
              <span className="stat-value">5 %</span>
              <span className="stat-hint">Ley 031, coparticipación</span>
            </div>
          </div>
          <p className="panel-sub">
            El IDH y las regalías se reparten aparte, entre gobernaciones, municipios, universidades
            y el Tesoro; los porcentajes vigentes de ese reparto no se pudieron confirmar.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Cada impuesto, con su norma</h2>
          <p className="panel-sub">
            {shown.length} de {NORMS.length} normas. Filtrá por tipo de impuesto o por cómo se
            confirmó, o buscá por nombre.
          </p>
        </div>
        <div className="slicer-row">
          <ChipPicker
            label="Tipo"
            options={GROUPS}
            value={group}
            onChange={setGroup}
            multi
            base={new Set<string>()}
          />
          <ChipPicker
            label="Cómo se confirmó"
            options={CONFIRMATIONS}
            value={confirmation}
            onChange={setConfirmation}
            multi
            base={new Set<string>()}
          />
          <label className="slicer slicer-grow">
            <span className="slicer-label">Buscar</span>
            <input
              type="search"
              placeholder="IVA, Ley 843, arancel…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar entre las normas"
            />
          </label>
        </div>
        <div className="table-wrap">
          <table className="grid-table accounts-table">
            <thead>
              <tr>
                <th scope="col">Impuesto</th>
                <th scope="col">Cuánto cobra hoy</th>
                <th scope="col">Sobre qué</th>
                <th scope="col">Norma</th>
                <th scope="col">Quién recauda y a dónde va</th>
                <th scope="col">Confirmación</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((norm) => (
                <tr key={norm.id}>
                  <th scope="row">
                    {norm.name}
                    <div className="panel-sub">{NORM_GROUP_LABEL[norm.group]}</div>
                  </th>
                  <td>
                    <b>{norm.rate}</b>
                  </td>
                  <td>
                    {norm.base}
                    {norm.note ? <div className="panel-sub">{norm.note}</div> : null}
                  </td>
                  <td>
                    <a className="table-link" href={norm.source} target="_blank" rel="noreferrer">
                      {norm.norm}
                    </a>
                  </td>
                  <td>{norm.collector}</td>
                  <td>
                    <span title={CONFIRMATION_LABEL[norm.confirmation]}>
                      {norm.confirmation === 'primaria' ? '●' : norm.confirmation === 'pendiente' ? '◐' : '○'}{' '}
                      {CONFIRMATION_LABEL[norm.confirmation]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 ? (
            <p className="panel-sub">Ninguna norma coincide con estos filtros.</p>
          ) : null}
        </div>
        <p className="panel-sub">
          <Icon name="info" size={12} /> ● texto de la norma leído · ○ solo prensa o portal
          tributario · ◐ aprobada, todavía no rige. Una alícuota que cambie después de esta fecha no
          aparece hasta que se corrija la tabla.
        </p>
      </div>
    </>
  );
}
