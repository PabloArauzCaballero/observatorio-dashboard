import { NextResponse, type NextRequest } from 'next/server';

/**
 * El dominio del portal administrativo solo sirve el portal.
 *
 * El mismo despliegue atiende el sitio público y `/admin`. Sin esto, abrir la
 * raíz del dominio del portal mostraba el tablero público: quien llega ahí
 * viene a iniciar sesión, así que todo lo que no sea del portal lo manda al
 * formulario de acceso (que a su vez reenvía a `/admin` si ya hay sesión).
 *
 * `ADMIN_HOST` es el nombre de host, sin esquema (p. ej. `portal.ejemplo.com`).
 * Sin la variable este archivo no hace nada, de modo que el sitio público y los
 * entornos locales quedan exactamente como estaban.
 */
const PORTAL_PREFIXES = ['/admin', '/api/admin', '/api/analytics', '/_next'];

export function middleware(request: NextRequest): NextResponse {
  const portalHost = process.env.ADMIN_HOST?.trim().toLowerCase();
  if (!portalHost) return NextResponse.next();

  const forwarded = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const host = forwarded.split(',')[0]?.trim().toLowerCase().replace(/:\d+$/u, '');
  if (host !== portalHost) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const belongsToPortal = PORTAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  // Archivos estáticos (favicon, imágenes, mapas) llevan extensión.
  if (belongsToPortal || /\.[a-z0-9]+$/iu.test(pathname)) return NextResponse.next();

  // Detrás del proxy `request.url` trae el host interno del contenedor, no el
  // que escribió la persona: la redirección se arma con el host público.
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https';
  return NextResponse.redirect(
    new URL('/admin/login', `${proto}://${forwarded.split(',')[0]?.trim()}`),
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
