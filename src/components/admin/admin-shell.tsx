'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';

interface Section {
  readonly href: string;
  readonly label: string;
  readonly icon: IconName;
}

/**
 * Las nueve secciones, agrupadas por lo que se hace en ellas y no por orden de
 * construcción: leer cómo se usa el sitio, vigilar que el observatorio se
 * alimente y se publique, y mantener lo que lo configura.
 */
const GROUPS: ReadonlyArray<{ readonly title: string; readonly items: readonly Section[] }> = [
  {
    title: 'Uso',
    items: [
      { href: '/admin', label: 'Resumen', icon: 'cajas' },
      { href: '/admin/traffic', label: 'Tráfico', icon: 'tendencia' },
      { href: '/admin/downloads', label: 'Descargas', icon: 'descarga' },
    ],
  },
  {
    title: 'Operación',
    items: [
      { href: '/admin/health', label: 'Disponibilidad', icon: 'pulso' },
      { href: '/admin/ingestion', label: 'Ingesta', icon: 'capas' },
      { href: '/admin/quality', label: 'Calidad', icon: 'escudo' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { href: '/admin/metadata', label: 'Metadatos', icon: 'etiqueta' },
      { href: '/admin/seeds', label: 'Sembradores', icon: 'espiga' },
      { href: '/admin/audit', label: 'Auditoría', icon: 'reloj' },
    ],
  },
];

const SECTIONS: readonly Section[] = GROUPS.flatMap((group) => group.items);

/**
 * El marco de cada pantalla privada.
 *
 * Muestra siempre dos cosas, porque quien no las ve termina actuando sobre el
 * despliegue equivocado: qué entorno es y cuándo se observó lo que hay en
 * pantalla. Las dos salen del sobre del propio núcleo y no del reloj del
 * navegador ni de una configuración que la página pudiera equivocar.
 */
export function AdminShell({
  environmentId,
  environmentKnown = true,
  operator,
  children,
}: {
  environmentId: string;
  environmentKnown?: boolean;
  operator: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const current = (href: string): boolean =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const currentLabel = SECTIONS.find((section) => current(section.href))?.label ?? 'Secciones';

  // Un enlace seguido no debe dejar el menú móvil abierto detrás de la página nueva.
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
            <span className="admin-brand-mark" aria-hidden="true">
              <Icon name="barras" size={16} />
            </span>
            <span>Portal del Observatorio</span>
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
          {GROUPS.map((group) => (
            <div className="admin-nav-group" key={group.title}>
              <span>{group.title}</span>
              {group.items.map((section) => (
                <Link
                  key={section.href}
                  href={section.href}
                  aria-current={current(section.href) ? 'page' : undefined}
                >
                  <Icon name={section.icon} size={16} />
                  {section.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="admin-nav-foot">
            <Link href="/">
              <Icon name="globo" size={16} />
              Volver al tablero
            </Link>
          </div>
        </div>
      </nav>
      <main className="admin-main">
        <div className="admin-meta" data-testid="admin-session-bar">
          <span
            className="admin-env"
            data-known={environmentKnown}
            title="Entorno que responde a esta consola"
          >
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
