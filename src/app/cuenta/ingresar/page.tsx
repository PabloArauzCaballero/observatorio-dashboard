import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Masthead } from '@/components/masthead';
import { IngresarForm } from '@/components/cuenta/cuenta-forms';
import { SiteFooter } from '@/components/site-footer';
import { safeReturnPath } from '@/lib/cuenta/puro';
import { currentCustomer } from '@/lib/cuenta/servidor';
import { THEME_BOOT } from '@/lib/theme';
import styles from '../cuenta.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ingresar a la cuenta',
  robots: { index: false, follow: false },
};

/** El ingreso de los clientes. Con la sesión ya abierta, no se pide la contraseña otra vez. */
export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const volver = safeReturnPath(parametros['volver']);
  if (await currentCustomer()) redirect(volver);

  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <a className="skip-link" href="#contenido">
        Ir al contenido principal
      </a>
      <Masthead stamp={<span>Cuenta de cliente</span>} />

      <div className={`${styles.pagina} ${styles.estrecha}`} id="contenido">
        <header className={styles.cabecera}>
          <p className={styles.antetitulo}>Servicios · Cuenta</p>
          <h2 className={styles.titulo}>Ingresar</h2>
          <p className={styles.entradilla}>Con el correo y la contraseña de la cuenta de DatosBolivia.com.</p>
        </header>

        <section className={`${styles.bloque} ${styles.bloquePrincipal}`} aria-label="Ingreso">
          <IngresarForm volver={volver} />
        </section>

        <p className={styles.nota}>
          Las cuentas se abren con un plan. Para pedir uno, o un enlace nuevo si se olvidó la contraseña, escribir
          desde <Link className={styles.enlace} href="/servicios#contacto">Planes y servicios</Link>.
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
