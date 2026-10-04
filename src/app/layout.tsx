import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { VisitReporter } from '@/components/visit-reporter';
import './globals.css';

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

export const metadata: Metadata = {
  title: 'Observatorio económico de Bolivia — tipo de cambio y brecha',
  description:
    'Seguimiento diario del tipo de cambio oficial, el dólar paralelo y la brecha cambiaria en Bolivia, con la procedencia de cada cifra.',
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
      </body>
    </html>
  );
}
