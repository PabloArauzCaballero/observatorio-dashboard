import Link from 'next/link';
import { count, instant, plural } from '@/components/admin/format';
import { PageHeader } from '@/components/admin/page-header';
import { ProblemNote } from '@/components/admin/panel';
import { StatStrip } from '@/components/admin/stat';
import { StateBadge, type Tone } from '@/components/admin/state-badge';
import { TimeSeries } from '@/components/admin/viz/time-series';
import { callCore } from '@/lib/admin/core-client';
import type { AdminOverview, TrafficReport } from '@/lib/admin/contracts';
import { currentSession } from '@/lib/admin/session';
import { byBucket } from '@/lib/admin/traffic-model';

export const dynamic = 'force-dynamic';

const MARK: Record<Tone, string> = { ok: '●', warn: '▲', bad: '■', unknown: '○' };
const TRAFFIC_DAYS = 14;

interface Area {
  readonly name: string;
  readonly href: string;
  readonly tone: Tone;
  readonly state: string;
  readonly detail: string;
  /** `null` es «no se midió»: se escribe con palabras, nunca como un cero. */
  readonly figure: number | null;
  /** Qué cuenta la cifra: una cifra sin su unidad es un número suelto. */
  readonly figureLabel: string;
}

/**
 * El resumen, y la regla de que ninguna cifra es un callejón sin salida.
 *
 * Arriba va el veredicto: una frase que dice si el observatorio necesita
 * atención y, si la necesita, qué es lo que falla, en orden de gravedad y con el
 * enlace al listado que lo reproduce. Debajo, las cifras que lo sostienen y las
 * ocho áreas en una lista que se escanea de un vistazo. Nada se inicializa en un
 * valor tranquilizador: una cifra con evidencia `unknown` dice «sin medición»
 * con palabras, porque un cero en un contador de fallos y un monitor que nunca
 * corrió se ven idénticos y solo uno de los dos es una buena noticia.
 */
function areasOf(data: AdminOverview): Area[] {
  const siteUnknown = data.site.evidenceState === 'unknown';
  return [
    {
      name: 'Sitio público',
      href: '/admin/health',
      figure: siteUnknown ? null : data.site.failedChecks,
      figureLabel: 'comprobaciones fallidas',
      tone: siteUnknown ? 'unknown' : data.site.openIncidents > 0 ? 'bad' : 'ok',
      state: siteUnknown ? 'Sin telemetría' : data.site.status === 'UP' ? 'En pie' : 'Caído',
      detail: siteUnknown
        ? 'Ninguna comprobación externa ha llegado todavía'
        : `${plural(data.site.checks, 'comprobación', 'comprobaciones')}, ${data.site.failedChecks} fallidas; ${plural(data.site.openIncidents, 'incidente abierto', 'incidentes abiertos')}`,
    },
    {
      name: 'Fuentes atrasadas',
      href: '/admin/ingestion',
      figure: data.sources.late,
      figureLabel: 'atrasadas',
      tone: data.sources.late > 0 ? 'bad' : data.sources.withoutSchedule > 0 ? 'warn' : 'ok',
      state: data.sources.late > 0 ? 'Incumplen calendario' : 'Dentro del calendario',
      detail: `${plural(data.sources.total, 'fuente', 'fuentes')}, ${count(data.sources.withoutSchedule)} sin calendario declarado`,
    },
    {
      name: 'Ingestas fallidas',
      href: '/admin/ingestion?status=FAILED',
      figure: data.ingestion.failedRuns,
      figureLabel: 'fallidas',
      tone: data.ingestion.failedRuns > 0 ? 'bad' : data.ingestion.partialRuns > 0 ? 'warn' : 'ok',
      state: data.ingestion.failedRuns > 0 ? 'Con fallos' : 'Sin fallos',
      detail: `${plural(data.ingestion.partialRuns, 'parcial', 'parciales')}, ${count(data.ingestion.runningRuns)} en curso`,
    },
    {
      name: 'Pendiente de publicar',
      href: '/admin/health',
      figure: data.publication.pending,
      figureLabel: 'pendientes',
      tone: data.publication.pending > 0 ? 'warn' : 'ok',
      state: data.publication.pending > 0 ? 'Datos sin publicar' : 'Al día',
      detail: `${plural(data.publication.datasets, 'conjunto', 'conjuntos')} con registro de publicación`,
    },
    {
      name: 'Incidencias críticas',
      href: '/admin/quality',
      figure: data.quality.criticalIssues,
      figureLabel: 'críticas',
      tone: data.quality.criticalIssues > 0 ? 'bad' : 'ok',
      state: data.quality.criticalIssues > 0 ? 'Bloqueantes' : 'Sin críticas',
      detail: `${plural(data.quality.openIssues, 'incidencia abierta', 'incidencias abiertas')} en total`,
    },
    {
      name: 'Sembradores',
      href: '/admin/seeds',
      figure: data.seeds.requiredMissing + data.seeds.conflicts,
      figureLabel: 'con problema',
      tone: data.seeds.requiredMissing > 0 || data.seeds.conflicts > 0 ? 'bad' : 'ok',
      state:
        data.seeds.requiredMissing > 0
          ? 'Faltan obligatorios'
          : data.seeds.conflicts > 0
            ? 'Conflicto de versión'
            : 'Completos',
      detail: `${plural(data.seeds.packages, 'paquete', 'paquetes')}; ${count(data.seeds.conflicts)} en conflicto`,
    },
    {
      name: 'Exportaciones fallidas',
      href: '/admin/downloads?status=FAILED',
      figure: data.exports.failed,
      figureLabel: 'fallidas',
      tone: data.exports.failed > 0 ? 'bad' : 'ok',
      state: data.exports.failed > 0 ? 'Con fallos' : 'Sin fallos',
      detail: `${plural(data.exports.generated, 'archivo generado', 'archivos generados')} en la ventana`,
    },
    {
      name: 'Tráfico medido',
      href: '/admin/traffic',
      figure: data.traffic.events,
      figureLabel: 'eventos',
      tone: data.traffic.measured ? 'ok' : 'unknown',
      state: data.traffic.measured ? 'Midiendo' : 'Sin medición',
      detail: data.traffic.measured
        ? `Último evento: ${instant(data.traffic.lastEventAt)}`
        : 'Nada recibido: la medición no está cubriendo este entorno',
    },
  ];
}

const SEVERITY: Record<Tone, number> = { bad: 0, warn: 1, unknown: 2, ok: 3 };

export default async function AdminOverviewPage() {
  const session = await currentSession();
  if (!session) return null;
  const since = new Date(Date.now() - TRAFFIC_DAYS * 864e5).toISOString();
  const [result, traffic] = await Promise.all([
    callCore<AdminOverview>('/api/v1/admin/overview', session),
    callCore<TrafficReport>('/api/v1/admin/analytics/traffic', session, {
      search: new URLSearchParams({ granularity: 'day', timeZone: 'America/La_Paz', since }),
    }),
  ]);

  if (!result.ok) {
    return (
      <>
        <PageHeader
          title="Resumen operativo"
          lead="Qué está funcionando, qué no, y desde cuándo se sabe."
        />
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      </>
    );
  }

  const data = result.body.data;
  const meta = result.body.meta;
  const areas = areasOf(data);
  const attention = areas.filter((area) => area.tone === 'bad' || area.tone === 'warn');
  attention.sort((a, b) => SEVERITY[a.tone] - SEVERITY[b.tone]);
  const verdictTone: Tone = attention.some((area) => area.tone === 'bad')
    ? 'bad'
    : attention.length > 0
      ? 'warn'
      : areas.some((area) => area.tone === 'unknown')
        ? 'unknown'
        : 'ok';
  const headline =
    verdictTone === 'bad'
      ? `Requiere atención: ${plural(attention.filter((a) => a.tone === 'bad').length, 'cosa falla', 'cosas fallan')}`
      : verdictTone === 'warn'
        ? `Funciona, con ${plural(attention.length, 'aviso', 'avisos')}`
        : verdictTone === 'unknown'
          ? 'Funciona, pero hay cosas que no se están midiendo'
          : 'Todo en orden';

  const site = data.site;
  const availability =
    site.evidenceState === 'unknown' || site.checks === 0
      ? null
      : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(
          ((site.checks - site.failedChecks) / site.checks) * 100,
        );
  const series = traffic.ok ? byBucket(traffic.body.data.buckets, 'PAGE_VIEW') : [];

  return (
    <>
      <PageHeader
        title="Resumen operativo"
        lead={`Ventana de ${data.window.hours} horas. Cada fila abre el listado que reproduce exactamente su cifra.`}
        observedAt={meta.observedAt}
        requestId={meta.requestId}
      />

      <section className="pg-verdict" data-tone={verdictTone} aria-labelledby="veredicto">
        <span className="pg-verdict-mark" aria-hidden="true">
          {MARK[verdictTone]}
        </span>
        <div>
          <h2 id="veredicto">{headline}</h2>
          <p>
            {attention.length === 0
              ? 'Ninguna de las ocho áreas tiene fallos ni avisos abiertos.'
              : 'En orden de gravedad. Cada una abre el listado que la explica.'}
          </p>
        </div>
        {attention.length > 0 ? (
          <ul>
            {attention.map((area) => (
              <li key={area.name}>
                <Link href={area.href}>
                  <StateBadge tone={area.tone} label={area.state} />
                  <span>
                    <strong>{area.name}</strong> — {area.detail}
                  </span>
                  <em>Ver →</em>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <StatStrip
        label="Cifras del resumen"
        stats={[
          {
            label: 'Disponibilidad del sitio',
            value: availability,
            unit: '%',
            detail:
              availability === null
                ? 'ninguna comprobación externa ha llegado'
                : `${count(site.checks)} comprobaciones desde el monitor`,
            state: {
              tone: site.openIncidents > 0 ? 'bad' : 'ok',
              label: site.status === 'UP' ? 'En pie' : 'Caído',
            },
            href: '/admin/health',
          },
          {
            label: 'Fuentes al día',
            value: count(data.sources.total - data.sources.late),
            unit: `de ${count(data.sources.total)}`,
            detail: `${count(data.sources.late)} atrasadas, ${count(data.sources.withoutSchedule)} sin calendario`,
            href: '/admin/ingestion',
          },
          {
            label: `Ingestas fallidas (${data.window.hours} h)`,
            value: count(data.ingestion.failedRuns),
            detail: `${count(data.ingestion.partialRuns)} parciales · ${count(data.ingestion.runningRuns)} en curso`,
            href: '/admin/ingestion?status=FAILED',
          },
          {
            label: `Archivos generados (${data.window.hours} h)`,
            value: count(data.exports.generated),
            detail: `${count(data.exports.failed)} fallidos`,
            href: '/admin/downloads',
          },
          {
            label: 'Eventos de tráfico',
            value: data.traffic.events === null ? null : count(data.traffic.events),
            detail: data.traffic.measured
              ? `último: ${instant(data.traffic.lastEventAt)}`
              : 'la medición no cubre este entorno',
            href: '/admin/traffic',
          },
        ]}
      />

      <div className="admin-pair admin-pair-wide">
        <section className="admin-panel">
          <header>
            <div>
              <h2>Vistas de página, últimos {TRAFFIC_DAYS} días</h2>
              <p>Sitio público, por día, hora de La Paz. No incluye robots ni el propio portal.</p>
            </div>
            <Link className="admin-button admin-button-ghost" href="/admin/traffic">
              Abrir Tráfico
            </Link>
          </header>
          {series.length > 0 ? (
            <TimeSeries
              title="Vistas por día"
              kind="line"
              unit="vistas"
              granularity="day"
              series={[{ key: 'views', label: 'Vistas', color: 'var(--series-1)', points: series }]}
              height={220}
            />
          ) : (
            <p className="admin-note" role="status">
              <strong>Sin vistas que dibujar</strong>
              <span>
                {traffic.ok
                  ? 'La medición no ha recibido vistas en estos días.'
                  : 'No se pudo leer el tráfico; el resto del resumen no depende de él.'}
              </span>
            </p>
          )}
        </section>

        <section className="admin-panel">
          <header>
            <div>
              <h2>Cola de trabajo</h2>
              <p>Lo que espera a una persona, no a un proceso.</p>
            </div>
          </header>
          <dl className="admin-dl">
            <dt>Revisiones pendientes</dt>
            <dd>{count(data.ingestion.pendingReviews)}</dd>
            <dt>Contradicciones abiertas</dt>
            <dd>{count(data.ingestion.openContradictions)}</dd>
            <dt>Elementos en cola muerta</dt>
            <dd>{count(data.ingestion.deadLetters)}</dd>
            <dt>Última ingesta iniciada</dt>
            <dd>{instant(data.ingestion.lastRunStartedAt)}</dd>
          </dl>
        </section>
      </div>

      <section className="admin-panel">
        <header>
          <div>
            <h2>Las ocho áreas</h2>
            <p>Todas, también las que están bien: lo que no se mira no se sabe.</p>
          </div>
        </header>
        <ul className="pg-list">
          {areas.map((area) => (
            <li key={area.name}>
              <Link href={area.href}>
                <span className={`pg-list-mark state-${area.tone}`} aria-hidden="true">
                  {MARK[area.tone]}
                </span>
                <span className="pg-list-name">
                  {area.name}
                  <span className="sr-only"> — {area.state}</span>
                </span>
                <span className="pg-list-detail">
                  {area.state}. {area.detail}
                </span>
                <span className="pg-list-figure">
                  {area.figure === null ? 'sin medición' : count(area.figure)}
                  {area.figure === null ? null : <small>{area.figureLabel}</small>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
