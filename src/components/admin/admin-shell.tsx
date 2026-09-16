'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

const SECTIONS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/traffic', label: 'Tráfico' },
  { href: '/admin/downloads', label: 'Descargas' },
  { href: '/admin/health', label: 'Disponibilidad' },
  { href: '/admin/ingestion', label: 'Ingesta' },
  { href: '/admin/quality', label: 'Calidad' },
  { href: '/admin/metadata', label: 'Metadatos' },
  { href: '/admin/seeds', label: 'Sembradores' },
  { href: '/admin/audit', label: 'Auditoría' },
];

/**
 * The frame every private screen sits in.
 *
 * Two things it always shows, because an operator who cannot see them will
 * eventually act on the wrong deployment: which environment this is, and when
 * what is on screen was observed. Both come from the core's own envelope rather
 * than from the browser's clock or from configuration the page could get wrong.
 */
export function AdminShell({
  environmentId,
  operator,
  children,
}: {
  environmentId: string;
  operator: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const current = (href: string): boolean =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const signOut = async (): Promise<void> => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <div className="admin">
      <nav className="admin-nav" aria-label="Secciones del portal">
        <Link className="admin-brand" href="/admin">
          Portal del Observatorio
        </Link>
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            aria-current={current(section.href) ? 'page' : undefined}
          >
            {section.label}
          </Link>
        ))}
        <Link href="/">Volver al tablero</Link>
      </nav>
      <main className="admin-main">
        <div className="admin-meta" data-testid="admin-session-bar">
          <span className="admin-env" title="Entorno que responde a esta consola">
            Entorno: {environmentId}
          </span>
          <span>Sesión: {operator}</span>
          <button type="button" className="admin-button" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
