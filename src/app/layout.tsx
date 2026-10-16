import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { RailListSearch } from '@/components/rail-list-search';
import { RailSticky } from '@/components/rail-sticky';
import { VisitReporter } from '@/components/visit-reporter';
import './globals.css';
import './automotive.css';

/*
 * Dos familias y nada más, las del New York Times en versión libre, alojadas en
 * el propio repositorio: el build no depende de una red externa y el lector no
 * abre una conexión a un tercero para ver una cifra.
 *
 * - Gelasio: la Georgia libre, con sus mismas métricas. Georgia es la sustituta
 *   que el propio NYT declara para Cheltenham e Imperial, y es la serif que pide
 *   el manual de identidad. Voz del texto: títulos de sección y entradillas.
 * - Libre Franklin: la Franklin Gothic libre, la letra de los gráficos, la
 *   navegación y las cifras del NYT. Voz de los datos: todo lo demás.
 *
 * Variables en el eje del peso, con su cursiva: dos archivos por familia.
 */
const gelasio = localFont({
  src: [
    { path: '../../public/fonts/Gelasio-Variable.woff2', style: 'normal' },
    { path: '../../public/fonts/Gelasio-Italic-Variable.woff2', style: 'italic' },
  ],
  variable: '--font-gelasio',
  weight: '400 700',
  display: 'swap',
});

const libreFranklin = localFont({
  src: [
    { path: '../../public/fonts/LibreFranklin-Variable.woff2', style: 'normal' },
    { path: '../../public/fonts/LibreFranklin-Italic-Variable.woff2', style: 'italic' },
  ],
  variable: '--font-libre-franklin',
  weight: '100 900',
  display: 'swap',
});

const SITIO = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://datosbolivia.com';
const DESCRIPCION =
  'Indicadores económicos, sociales y territoriales de Bolivia: tipo de cambio oficial y paralelo, macroeconomía, empresas, comercio exterior y transporte, con la fuente y la fecha de cada cifra.';

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: {
    default: 'DatosBolivia.com — Centro de Datos de Bolivia',
    template: '%s · DatosBolivia.com',
  },
  description: DESCRIPCION,
  applicationName: 'DatosBolivia.com',
  openGraph: {
    type: 'website',
    locale: 'es_BO',
    siteName: 'DatosBolivia.com',
    title: 'DatosBolivia.com — Centro de Datos de Bolivia',
    description: DESCRIPCION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DatosBolivia.com — Centro de Datos de Bolivia',
    description: DESCRIPCION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffefb' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1011' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // El tablero público pone `data-theme` en <html> antes de hidratar (ver `THEME_BOOT`).
    <html
      lang="es-BO"
      className={`${gelasio.variable} ${libreFranklin.variable}`}
      suppressHydrationWarning
    >
      <body>
        <div className="shell">{children}</div>
        {/* Reports one visit and nothing else; it renders no markup and never blocks. */}
        <VisitReporter />
        {/* Un buscador para toda lista larga del carril de filtros; no pinta marcado propio. */}
        <RailListSearch />
        {/* El carril de filtros se pega sin barra propia: publica su altura y la de la franja. */}
        <RailSticky />
      </body>
    </html>
  );
}
