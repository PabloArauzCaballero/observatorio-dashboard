import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { RailListSearch } from '@/components/rail-list-search';
import { VisitReporter } from '@/components/visit-reporter';
import './globals.css';
import './automotive.css';

/*
 * Dos familias y nada más, alojadas en el propio repositorio: el build no
 * depende de una red externa y el lector no abre una conexión a un tercero para
 * ver una cifra. Newsreader solo para los títulos de pestaña y de panel; Public
 * Sans para todo lo demás. Son variables en el eje del peso, así que cada una es
 * un único archivo.
 */
const newsreader = localFont({
  src: '../../public/fonts/Newsreader-Variable.woff2',
  variable: '--font-newsreader',
  weight: '200 800',
  display: 'swap',
});

const publicSans = localFont({
  src: '../../public/fonts/PublicSans-Variable.woff2',
  variable: '--font-public-sans',
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
    { media: '(prefers-color-scheme: light)', color: '#f7f4ed' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1011' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // El tablero público pone `data-theme` en <html> antes de hidratar (ver `THEME_BOOT`).
    <html
      lang="es-BO"
      className={`${newsreader.variable} ${publicSans.variable}`}
      suppressHydrationWarning
    >
      <body>
        <div className="shell">{children}</div>
        {/* Reports one visit and nothing else; it renders no markup and never blocks. */}
        <VisitReporter />
        {/* Un buscador para toda lista larga del carril de filtros; no pinta marcado propio. */}
        <RailListSearch />
      </body>
    </html>
  );
}
