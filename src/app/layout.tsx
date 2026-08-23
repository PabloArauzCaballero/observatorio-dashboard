import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Observatorio económico de Bolivia — tipo de cambio y brecha',
  description:
    'Seguimiento diario del tipo de cambio oficial, el dólar paralelo y la brecha cambiaria en Bolivia, con la procedencia de cada cifra.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-BO">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
