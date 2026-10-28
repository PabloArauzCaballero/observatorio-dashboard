import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/masthead';
import { RecuperarForm } from '@/components/cuenta/cuenta-forms';
import { SiteFooter } from '@/components/site-footer';
import { mailIsConfigured } from '@/lib/cuenta/servidor';
import { THEME_BOOT } from '@/lib/theme';
import styles from '../cuenta.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Recuperar la clave',
  robots: { index: false, follow: false },
};

/**
 * Pedir un enlace para fijar una contraseña nueva, sin sesión. La respuesta es
 * la misma exista o no la cuenta; el enlace solo viaja por correo. Un
 * despliegue sin correo lo dice antes de pedir nada.
 */
export default function RecuperarPage() {
  const conCorreo = mailIsConfigured();
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
          <h2 className={styles.titulo}>Recuperar la clave</h2>
          <p className={styles.entradilla}>
            Un enlace para fijar una contraseña nueva llega al correo de la cuenta. Sirve para titulares y para
            miembros de un equipo.
          </p>
        </header>

        <section className={`${styles.bloque} ${styles.bloquePrincipal}`} aria-label="Recuperación">
          {conCorreo ? (
            <RecuperarForm />
          ) : (
            <p className={styles.aviso} role="status">
              La recuperación por correo no está disponible en este momento. Para recibir un enlace nuevo, escribir
              desde{' '}
              <Link className={styles.enlace} href="/servicios#contacto">
                Planes y servicios
              </Link>
              .
            </p>
          )}
        </section>

        <p className={styles.nota}>
          Si el correo no llega en unos minutos, revisar la carpeta de correo no deseado o escribir desde{' '}
          <Link className={styles.enlace} href="/servicios#contacto">
            Planes y servicios
          </Link>
          .{' '}
          <Link className={styles.enlace} href="/cuenta/ingresar">
            Volver al ingreso
          </Link>
          .
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
