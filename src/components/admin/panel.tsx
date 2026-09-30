import type { ReactNode } from 'react';
import type { CoreResult } from '@/lib/admin/core-client';
import { EmptyState, ErrorState } from '@/components/admin/states';

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

/** Alias de `EmptyState`: las pantallas anteriores conservan su importación. */
export function EmptyNote({ title, detail }: { title: string; detail: string }) {
  return <EmptyState title={title} detail={detail} />;
}

/** Alias de `ErrorState`, por la misma razón. */
export function ProblemNote({ problem }: { problem: Extract<CoreResult<unknown>, { ok: false }> }) {
  return <ErrorState problem={problem} />;
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
