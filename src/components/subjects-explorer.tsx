'use client';

import { useMemo, useState } from 'react';
import { HeatGrid, MonthlyBars, ShareBars } from './charts';
import type { HeatCell, MonthBar, ShareSlice } from './charts';
import { Icon } from './icons';
import type { TermMonth, TermTotal } from '@/lib/series';

/**
 * What the country's press has talked about, subject by subject and month by
 * month.
 *
 * The archive held thirty-eight thousand notes across six and a half years and
 * was interrogated with thirty-six words, so what a reader saw was not the
 * coverage of Bolivia but the six subjects the observatory named first. The
 * watchlist now holds two hundred, and this section is how they are read.
 *
 * Two rules shape it. Subjects are reached through their family and never as
 * one flat list of two hundred buttons — a list that long is a list nobody
 * reads. And every panel is dated: a subject with four hundred mentions spread
 * over six years and one with four hundred in a single month are different
 * events, and no total tells them apart.
 */

const FAMILY_LABEL: Record<string, string> = {
  HIDROCARBUROS: 'Hidrocarburos',
  ENERGIA: 'Energía',
  CAMBIARIO: 'Tipo de cambio',
  MONETARIO: 'Dinero y banca',
  PRECIOS: 'Precios',
  FISCAL: 'Cuentas del Estado',
  COMERCIO_EXTERIOR: 'Comercio exterior',
  COMERCIO_INTERNO: 'Comercio interno',
  SECTOR_REAL: 'Sectores productivos',
  LABORAL: 'Trabajo',
  TRANSPORTE: 'Transporte',
  INFRAESTRUCTURA: 'Infraestructura',
  SERVICIOS_BASICOS: 'Servicios básicos',
  TECNOLOGIA: 'Tecnología',
  VIVIENDA: 'Vivienda',
  TURISMO: 'Turismo',
  SALUD: 'Salud',
  EDUCACION: 'Educación',
  CONFLICTO: 'Conflicto',
  INSTITUCIONAL: 'Instituciones',
  SEGURIDAD: 'Seguridad',
  AMBIENTE: 'Ambiente',
  SOCIAL: 'Social',
  ACTIVIDAD: 'Actividad económica',
};

const count = (value: number): string => value.toLocaleString('es-BO');

/** A month written the way a caption says it, not the way a database stores it. */
function sayMonth(month: string): string {
  const [year = '', index = ''] = month.split('-');
  const names = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return `${names[Number(index) - 1] ?? index} de ${year}`;
}

export function SubjectsExplorer({ months, totals }: { months: TermMonth[]; totals: TermTotal[] }) {
  const families = useMemo(() => {
    const held = new Map<string, number>();
    for (const total of totals) {
      held.set(total.family, (held.get(total.family) ?? 0) + total.mentions);
    }
    return [...held.entries()].sort((left, right) => right[1] - left[1]);
  }, [totals]);

  const [family, setFamily] = useState<string>('');
  const [term, setTerm] = useState<string>('');

  const shownFamily = family || families[0]?.[0] || '';
  const inFamily = useMemo(
    () => totals.filter((total) => total.family === shownFamily),
    [totals, shownFamily],
  );
  const shownTerm = inFamily.some((total) => total.term === term)
    ? term
    : (inFamily[0]?.term ?? '');
  const subject = totals.find((total) => total.term === shownTerm);

  /** The chosen subject's whole life, one bar per month. */
  const series: MonthBar[] = useMemo(
    () =>
      months
        .filter((row) => row.term === shownTerm)
        .map((row) => ({
          month: row.month,
          mentions: row.mentions,
          adverse: row.alarma + row.deterioro + row.conflicto + row.incertidumbre,
        })),
    [months, shownTerm],
  );

  /** The family's subjects, ranked, so the chosen one is read against its peers. */
  const ranking: ShareSlice[] = useMemo(
    () =>
      inFamily.map((total) => ({
        name: total.label,
        value: total.mentions,
        ...(total.term === shownTerm ? { emphasis: true } : {}),
      })),
    [inFamily, shownTerm],
  );

  /** Coverage by family and year: where the archive is thick and where it is thin. */
  const calendar = useMemo(() => {
    const years = [...new Set(months.map((row) => row.month.slice(0, 4)))].sort();
    const byFamily = new Map<string, number>();
    const cells: HeatCell[] = [];
    const totalsByCell = new Map<string, number>();
    for (const row of months) {
      const key = `${row.family}|${row.month.slice(0, 4)}`;
      totalsByCell.set(key, (totalsByCell.get(key) ?? 0) + row.mentions);
      byFamily.set(row.family, (byFamily.get(row.family) ?? 0) + row.mentions);
    }
    for (const [key, value] of totalsByCell) {
      const [name = '', year = ''] = key.split('|');
      cells.push({ row: FAMILY_LABEL[name] ?? name, column: year, value });
    }
    const rows = [...byFamily.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([name]) => FAMILY_LABEL[name] ?? name);
    return { years, rows, cells };
  }, [months]);

  if (!totals.length) {
    return (
      <div className="callout">
        Todavía no hay lecturas por tema. El modelo existe en la base; se llena cuando se refresca
        la copia del corpus de prensa.
      </div>
    );
  }

  const totalMentions = totals.reduce((sum, total) => sum + total.mentions, 0);
  const busiest = [...totals].sort((left, right) => right.peakMentions - left.peakMentions)[0];

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>De qué se habla, y cuándo</h2>
        </div>
        <p className="panel-sub">
          Cada nota del archivo se lee contra una lista de temas vigilados y queda fechada por el
          mes en que se publicó. Una nota puede nombrar varios temas: los conteos de abajo son
          menciones, no notas, y por eso suman más que el archivo.
        </p>
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">
              <Icon name="etiqueta" size={12} />
              Temas vigilados
            </span>
            <span className="stat-value">{totals.length}</span>
            <span className="stat-hint">en {families.length} familias</span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="barras" size={12} />
              Menciones fechadas
            </span>
            <span className="stat-value">{count(totalMentions)}</span>
            <span className="stat-hint">sobre el archivo completo</span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="calendario" size={12} />
              Meses cubiertos
            </span>
            <span className="stat-value">{new Set(months.map((row) => row.month)).size}</span>
            <span className="stat-hint">
              {months.length ? `${months[0]?.month} → ${months[months.length - 1]?.month}` : '—'}
            </span>
          </div>
          {busiest ? (
            <div className="stat">
              <span className="stat-label">
                <Icon name="pulso" size={12} />
                Mayor pico
              </span>
              <span className="stat-value">{count(busiest.peakMentions)}</span>
              <span className="stat-hint">
                {busiest.label} · {sayMonth(busiest.peakMonth)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="tile-head">
          <Icon name="filtro" size={17} />
          <h2>Elegir un tema</h2>
          <span className="tile-hint">familia, luego tema</span>
        </div>
        <nav className="chip-row" aria-label="Familias de temas">
          {families.map(([name, mentions]) => (
            <button
              key={name}
              type="button"
              className={name === shownFamily ? 'chip chip-active' : 'chip'}
              onClick={() => {
                setFamily(name);
                setTerm('');
              }}
            >
              {FAMILY_LABEL[name] ?? name}
              <span className="chip-count">{count(mentions)}</span>
            </button>
          ))}
        </nav>
        <nav className="chip-row chip-row-soft" aria-label="Temas de la familia">
          {inFamily.map((total) => (
            <button
              key={total.term}
              type="button"
              className={total.term === shownTerm ? 'chip chip-active' : 'chip'}
              onClick={() => setTerm(total.term)}
            >
              {total.label}
              <span className="chip-count">{count(total.mentions)}</span>
            </button>
          ))}
        </nav>
      </div>

      {subject ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="barras" size={17} />
            <h2>{subject.label}, mes a mes</h2>
            <span className="tile-hint">
              {sayMonth(subject.firstMonth)} → {sayMonth(subject.lastMonth)}
            </span>
          </div>
          <MonthlyBars data={series} height={230} />
          <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
            En rojo, la parte de cada mes que la prensa cubrió con alarma, deterioro, conflicto o
            incertidumbre; en azul, el resto. El tema acumula{' '}
            <strong>{count(subject.mentions)} menciones</strong> en {subject.months} meses, con su
            pico en {sayMonth(subject.peakMonth)} ({count(subject.peakMentions)} notas)
            {subject.adverseShare === null
              ? ''
              : ` y un ${subject.adverseShare} % de cobertura adversa en todo el período`}
            .
          </p>
        </div>
      ) : null}

      {ranking.length > 1 ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="capas" size={17} />
            <h2>Dentro de {FAMILY_LABEL[shownFamily] ?? shownFamily}</h2>
            <span className="tile-hint">{ranking.length} temas</span>
          </div>
          <ShareBars data={ranking} unit="menciones" height={Math.max(160, ranking.length * 30)} />
          <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
            El tema abierto arriba va marcado. La altura es cuánta prensa nombró cada asunto, que es
            atención mediática y no tamaño económico: el contrabando ocupa más titulares que la
            manufactura sin mover más dinero.
          </p>
        </div>
      ) : null}

      <div className="panel">
        <div className="tile-head">
          <Icon name="calendario" size={17} />
          <h2>Qué se cubrió cada año</h2>
          <span className="tile-hint">menciones por familia y año</span>
        </div>
        <HeatGrid
          rows={calendar.rows}
          columns={calendar.years}
          cells={calendar.cells}
          unit="menciones"
        />
        <p className="panel-sub" style={{ marginTop: 'var(--s2)' }}>
          Cuanto más oscura la celda, más se habló de esa familia ese año. Las celdas vacías son
          años sin ninguna mención del asunto, no años con cero cobertura económica: el archivo es
          más delgado en los años que se reconstruyeron desde los mapas de sitio de cada medio.
        </p>
      </div>
    </>
  );
}
