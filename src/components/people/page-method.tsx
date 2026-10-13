'use client';

import {
  ChartLegend,
  HeatGrid,
  ShareBars,
  type HeatCell,
  type ShareSlice,
} from '@/components/charts';
import { Panel } from '@/components/ui/panel';
import { usePeople } from './people-context';
import { COMPONENT_LABEL, SOURCES, VERIFICATION, coverageBySector, num } from './people-model';
import { COMPONENT_TONE } from './page-perceived';
import s from './people.module.css';

const SOURCE = 'Observatorio Económico de Bolivia';

/**
 * «Método y calidad»: cuánto confiar. Lo que antes era un desplegable de ocho párrafos son
 * cinco paneles con cifras: de dónde sale el padrón, qué cubre cada fuente en cada sector y
 * qué cuentas suman.
 */
export function MethodPage() {
  const { summary, rows, updated } = usePeople();
  const q = summary.quality;
  const weights = summary.method.weights;

  const funnel: ShareSlice[] = [
    { name: 'Fichas del padrón original', value: q.padron.fichasOriginales },
    { name: 'En el ranking', value: q.padron.fichasEnElRanking },
    { name: 'Con atención medible', value: summary.method.measuredPeople },
    { name: 'Con audiencia verificada', value: q.conAudienciaVerificada },
    { name: 'Con sentimiento publicado', value: summary.conversation.peoplePublishable },
  ];

  const coverage = coverageBySector(rows);
  const columns = ['Wikipedia', 'Audiencia verificada', 'Merco', 'Sentimiento'];
  const cells: HeatCell[] = coverage.flatMap((row) => {
    const label = `${row.label} (${num(row.n)})`;
    const values = [row.views, row.social, row.merco, row.talk];
    return columns.flatMap((column, index) => {
      const value = values[index] ?? 0;
      return value > 0 ? [{ row: label, column, value, hint: `de ${num(row.n)} personas` }] : [];
    });
  });

  const bySource: ShareSlice[] = Object.entries(q.padron.porFuente).map(([key, value]) => ({
    name: SOURCES[key] ?? key,
    value,
  }));

  const accounts: ShareSlice[] = [
    ...Object.entries(q.cuentas.suman).map(([key, value]) => ({
      name: `Suma · ${VERIFICATION[key] ?? key}`,
      value,
      emphasis: true,
    })),
    ...Object.entries(q.cuentas.noSuman).map(([key, value]) => ({
      name: `No suma · ${VERIFICATION[key] ?? key}`,
      value,
    })),
  ];

  return (
    <>
      <div className="grid-pair">
        <Panel
          id="personalidades-embudo"
          title="Del padrón al ranking (cantidad de personas)"
          lede="No es una selección de «los más importantes»: es un padrón de descubrimiento armado con listas públicas, y cada paso pierde a quien la fuente no registra."
          source={SOURCE}
          updated={updated}
        >
          <ShareBars data={funnel} unit="personas" decimals={0} height={230} />
          <ChartLegend
            items={[{ color: 'var(--official)', label: 'Cantidad de personas en cada paso' }]}
          />
          <p className={s.footnote}>
            Identidad: {num(q.identidad.coincidenciasWikidata)} fichas se enlazaron con Wikidata y
            se revisaron a mano las sospechosas: {num(q.identidad.revisadasYAceptadas)} confirmadas,{' '}
            {num(q.identidad.descartadas)} descartadas por ser otra persona,{' '}
            {num(q.identidad.duplicadasFusionadas)} duplicadas fusionadas y{' '}
            {num(q.identidad.fueraDeAlcance)} fuera de alcance.
          </p>
        </Panel>

        <Panel
          id="personalidades-fuentes"
          title="De dónde sale el padrón (cantidad de fichas por fuente)"
          lede="Una persona puede estar en varias fuentes. Wikidata aporta sobre todo deportistas, políticos y obispos con artículo."
          source={SOURCE}
          updated={updated}
        >
          <ShareBars
            data={bySource}
            unit="fichas"
            decimals={0}
            height={Math.max(260, bySource.length * 32)}
          />
          <ChartLegend
            items={[{ color: 'var(--official)', label: 'Fichas que aporta cada fuente' }]}
          />
        </Panel>
      </div>

      <Panel
        id="personalidades-cobertura"
        title="Cobertura por sector y fuente (cantidad de personas con dato)"
        lede="Una celda vacía es una fuente que no registra a nadie de ese sector: por eso el índice no compara empresas con deportistas."
        source={SOURCE}
        updated={updated}
      >
        <HeatGrid
          rows={coverage.map((row) => `${row.label} (${num(row.n)})`)}
          columns={columns}
          cells={cells}
          unit="personas con dato"
        />
      </Panel>

      <div className="grid-pair">
        <Panel
          id="personalidades-cuentas"
          title="Cuentas halladas: cuáles suman y cuáles no (cantidad de cuentas)"
          lede="Una cuenta suma solo con identidad respaldada. Las que coinciden solo por nombre se muestran aparte."
          source={SOURCE}
          updated={updated}
        >
          <ShareBars
            data={accounts}
            unit="cuentas"
            decimals={0}
            height={Math.max(260, accounts.length * 36)}
          />
          <ChartLegend
            items={[
              { color: 'var(--official)', label: 'Cuentas que suman al índice' },
              { color: 'var(--series-rest)', label: 'Cuentas que no suman' },
            ]}
          />
        </Panel>

        <Panel
          id="personalidades-indice"
          title="Qué mide el índice (0 a 100) y qué no"
          lede="Atención pública observable, no importancia, aprobación ni mérito."
          downloadable={false}
          source={SOURCE}
          updated={updated}
        >
          <ul className={s.parts}>
            {(['views', 'social', 'merco'] as const).map((key) => (
              <li className={s.part} key={key}>
                <span className={s.partName}>
                  <span
                    className={s.swatch}
                    style={{ background: COMPONENT_TONE[key] }}
                    aria-hidden="true"
                  />
                  {COMPONENT_LABEL[key]}
                </span>
                <span className={s.partPts}>{Math.round(weights[key] * 100)} %</span>
              </li>
            ))}
          </ul>
          <p className={s.footnote}>{summary.method.summary}</p>
          <h4 className={s.subhead}>Límites</h4>
          <ol className={s.footnote}>
            {summary.method.limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
