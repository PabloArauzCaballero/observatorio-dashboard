import type { ReactNode } from 'react';
import type { CoreResult } from '@/lib/admin/core-client';

/**
 * The four things a section can be, told apart in words.
 *
 * A table with no rows and a table that has not loaded look identical unless
 * something says which one it is, and a reader who cannot tell will assume the
 * friendlier of the two. So an empty result says it is empty, a refusal says
 * who refused it, a dependency failure says the core did not answer, and only
 * a section with rows shows rows.
 */
export function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-panel">
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function EmptyNote({ title, detail }: { title: string; detail: string }) {
  return (
    <p className="admin-note" role="status">
      <strong>{title}</strong>
      <span>{detail}</span>
    </p>
  );
}

/**
 * Renders a refusal the way the core meant it.
 *
 * A 403 is «no tiene permiso», not «no hay datos»; a 503 is «el núcleo no
 * respondió», not an empty list. Collapsing them into one blank screen is how a
 * missing permission gets mistaken for a missing dataset for a week.
 */
export function ProblemNote({ problem }: { problem: Extract<CoreResult<unknown>, { ok: false }> }) {
  const title =
    problem.status === 403
      ? 'No tiene permiso para ver esto'
      : problem.status === 401
        ? 'La sesión ya no es válida'
        : problem.status === 503
          ? 'El núcleo no respondió'
          : 'No se pudo leer';
  return (
    <div className="admin-note" role="alert">
      <strong>{title}</strong>
      <span>{problem.message}</span>
      <span className="admin-mono">{problem.code}</span>
    </div>
  );
}

/** A determinate shape while a section streams in; never a fabricated percentage. */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="admin-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} style={{ width: `${90 - index * 12}%` }} />
      ))}
    </div>
  );
}
