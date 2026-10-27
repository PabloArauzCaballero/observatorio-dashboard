import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/masthead';
import { ActivarForm } from '@/components/cuenta/cuenta-forms';
import { SiteFooter } from '@/components/site-footer';
import { TERMS_VERSION, isActivationToken } from '@/lib/cuenta/puro';
import { THEME_BOOT } from '@/lib/theme';
import styles from '../cuenta.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Activar la cuenta',
  robots: { index: false, follow: false },
  // El token viaja en la dirección: que no salga hacia otro sitio en el `Referer`.
  referrer: 'no-referrer',
};

/**
 * Fijar la contraseña con el enlace de un solo uso que manda DatosBolivia.com.
 * Sirve para la activación y para recuperar la contraseña; en los dos casos se
 * aceptan los términos en su versión vigente.
 */
export default async function ActivarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const token = typeof parametros['token'] === 'string' ? parametros['token'] : '';
  const valido = isActivationToken(token);

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
          <h2 className={styles.titulo}>Activar la cuenta</h2>
          <p className={styles.entradilla}>
            Una contraseña para entrar a la cuenta de DatosBolivia.com. El enlace sirve una sola vez.
          </p>
        </header>

        <section className={`${styles.bloque} ${styles.bloquePrincipal}`} aria-label="Contraseña">
          {valido ? (
            <ActivarForm token={token} version={TERMS_VERSION} />
          ) : (
            <p className={styles.error} role="alert">
              El enlace no es válido o está incompleto. Pedir uno nuevo desde{' '}
              <Link className={styles.enlace} href="/servicios#contacto">
                Planes y servicios
              </Link>
              .
            </p>
          )}
        </section>

        <p className={styles.nota}>
          ¿La cuenta ya está activa? <Link className={styles.enlace} href="/cuenta/ingresar">Ingresar</Link>.
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
