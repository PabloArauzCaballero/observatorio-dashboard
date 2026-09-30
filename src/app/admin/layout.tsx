import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: 'Portal administrativo — Observatorio económico',
  description: 'Operación, ingesta, calidad, metadatos y sembradores del Observatorio.',
  robots: { index: false, follow: false },
};

/**
 * Everything under `/admin` shares the stylesheet and the title, and no more.
 *
 * The guard lives one level down, in the `(private)` group, so that the login
 * screen is not guarded by the thing it exists to get past. Putting the check
 * here and exempting the login path by inspecting the URL is the version of
 * this that loops the first time somebody renames a route.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
