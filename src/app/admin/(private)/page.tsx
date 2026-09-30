import Link from 'next/link';
import { count, instant, plural } from '@/components/admin/format';
import { ProblemNote } from '@/components/admin/panel';
import { StateBadge, type Tone } from '@/components/admin/state-badge';
import { callCore } from '@/lib/admin/core-client';
import type { AdminOverview } from '@/lib/admin/contracts';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * The summary, and the rule that no card is a dead end.
 *
 * Every figure here is a link to the listing that reproduces it with the same
 * filters. A number an operator cannot open is a number nobody can check, and a
 * console full of those is the thing this portal was built to replace.
 *
 * Nothing defaults to a reassuring value. A card whose evidence state is
 * `unknown` says «sin medición» in words, because a zero in a failure counter
 * and a monitor that has never run look identical and only one of them is good
 * news.
 */
interface CardProps {
  title: string;
  href: string;
  figure: number | null;
  detail: string;
  tone: Tone;
  state: string;
}

function Card({ title, href, figure, detail, tone, state }: CardProps) {
  return (
    <Link className="admin-card" href={href}>
      <h2>{title}</h2>
      {figure === null ? (
        <span className="admin-figure admin-figure-unknown">Sin medición</span>
      ) : (
        <span className="admin-figure">{count(figure)}</span>
      )}
      <StateBadge tone={tone} label={state} />
      <small>{detail}</small>
    </Link>
  );
}

export default async function AdminOverviewPage() {
  const session = await currentSession();
  if (!session) return null;
  const result = await callCore<AdminOverview>('/api/v1/admin/overview', session);

  if (!result.ok) {
    return (
      <>
        <div className="admin-head">
          <div>
            <h1>Resumen operativo</h1>
            <p>Qué está funcionando, qué no, y desde cuándo se sabe.</p>
          </div>
        </div>
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      </>
    );
  }

  const data = result.body.data;
  const meta = result.body.meta;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Resumen operativo</h1>
          <p>
            Ventana de {data.window.hours} horas. Cada tarjeta abre el listado que reproduce
            exactamente su cifra.
          </p>
        </div>
        <div className="admin-meta">
          <span>Observado: {instant(meta.observedAt)}</span>
          <span>Generado: {instant(meta.generatedAt)}</span>
          <span className="admin-mono">{meta.requestId}</span>
        </div>
      </div>

      <div className="admin-cards">
        <Card
          title="Sitio público"
          href="/admin/health"
          figure={data.site.evidenceState === 'unknown' ? null : data.site.failedChecks}
          detail={
            data.site.evidenceState === 'unknown'
              ? 'Ninguna comprobación externa ha llegado todavía'
              : `${plural(data.site.checks, 'comprobación', 'comprobaciones')}, ${plural(data.site.openIncidents, 'incidente abierto', 'incidentes abiertos')}`
          }
          tone={
            data.site.evidenceState === 'unknown'
              ? 'unknown'
              : data.site.openIncidents > 0
                ? 'bad'
                : 'ok'
          }
          state={
            data.site.evidenceState === 'unknown'
              ? 'Sin telemetría'
              : data.site.status === 'UP'
                ? 'En pie'
                : 'Caído'
          }
        />
        <Card
          title="Fuentes atrasadas"
          href="/admin/ingestion"
          figure={data.sources.late}
          detail={`${plural(data.sources.total, 'fuente', 'fuentes')}, ${count(data.sources.withoutSchedule)} sin calendario declarado`}
          tone={data.sources.late > 0 ? 'bad' : data.sources.withoutSchedule > 0 ? 'warn' : 'ok'}
          state={data.sources.late > 0 ? 'Incumplen calendario' : 'Dentro del calendario'}
        />
        <Card
          title="Ingestas fallidas"
          href="/admin/ingestion?status=FAILED"
          figure={data.ingestion.failedRuns}
          detail={`${plural(data.ingestion.partialRuns, 'parcial', 'parciales')}, ${count(data.ingestion.runningRuns)} en curso`}
          tone={data.ingestion.failedRuns > 0 ? 'bad' : 'ok'}
          state={data.ingestion.failedRuns > 0 ? 'Con fallos' : 'Sin fallos'}
        />
        <Card
          title="Pendiente de publicar"
          href="/admin/health"
          figure={data.publication.pending}
          detail={`${plural(data.publication.datasets, 'conjunto', 'conjuntos')} con registro de publicación`}
          tone={data.publication.pending > 0 ? 'warn' : 'ok'}
          state={data.publication.pending > 0 ? 'Datos sin publicar' : 'Al día'}
        />
        <Card
          title="Incidencias críticas"
          href="/admin/quality"
          figure={data.quality.criticalIssues}
          detail={`${plural(data.quality.openIssues, 'incidencia abierta', 'incidencias abiertas')} en total`}
          tone={data.quality.criticalIssues > 0 ? 'bad' : 'ok'}
          state={data.quality.criticalIssues > 0 ? 'Bloqueantes' : 'Sin críticas'}
        />
        <Card
          title="Sembradores"
          href="/admin/seeds"
          figure={data.seeds.requiredMissing + data.seeds.conflicts}
          detail={`${plural(data.seeds.packages, 'paquete', 'paquetes')}; ${count(data.seeds.conflicts)} en conflicto`}
          tone={data.seeds.requiredMissing > 0 || data.seeds.conflicts > 0 ? 'bad' : 'ok'}
          state={
            data.seeds.requiredMissing > 0
              ? 'Faltan obligatorios'
              : data.seeds.conflicts > 0
                ? 'Conflicto de versión'
                : 'Completos'
          }
        />
        <Card
          title="Exportaciones fallidas"
          href="/admin/downloads?status=FAILED"
          figure={data.exports.failed}
          detail={`${plural(data.exports.generated, 'archivo generado', 'archivos generados')}`}
          tone={data.exports.failed > 0 ? 'bad' : 'ok'}
          state={data.exports.failed > 0 ? 'Con fallos' : 'Sin fallos'}
        />
        <Card
          title="Tráfico medido"
          href="/admin/traffic"
          figure={data.traffic.events}
          detail={
            data.traffic.measured
              ? `Último evento: ${instant(data.traffic.lastEventAt)}`
              : 'Nada recibido: la medición no está cubriendo este entorno'
          }
          tone={data.traffic.measured ? 'ok' : 'unknown'}
          state={data.traffic.measured ? 'Midiendo' : 'Sin medición'}
        />
      </div>

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
    </>
  );
}
