'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';

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
  const [navOpen, setNavOpen] = useState(false);

  const current = (href: string): boolean =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const currentLabel = SECTIONS.find((section) => current(section.href))?.label ?? 'Secciones';

  // A followed link should not leave the mobile menu open behind the new page.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const signOut = async (): Promise<void> => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <div className="admin">
      <nav className="admin-nav" aria-label="Secciones del portal">
        <div className="admin-nav-head">
          <Link className="admin-brand" href="/admin">
            Portal del Observatorio
          </Link>
          <button
            type="button"
            className="admin-nav-toggle"
            aria-expanded={navOpen}
            aria-controls="admin-nav-links"
            onClick={() => setNavOpen((open) => !open)}
          >
            {currentLabel}
            <Icon name={navOpen ? 'plegar' : 'desplegar'} size={14} />
          </button>
        </div>
        <div className="admin-nav-links" id="admin-nav-links" data-open={navOpen}>
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
        </div>
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
