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

/**
 * El ingreso de titulares y miembros. Con la sesión ya abierta no se pide la
 * contraseña otra vez; una sesión cerrada en el núcleo llega aquí sin cookie,
 * porque `/api/cuenta/vencida` la borra antes.
 */
export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const volver = safeReturnPath(parametros['volver']);
  if (await currentCustomer()) redirect(volver);
  const aviso =
    parametros['motivo'] === 'sesion'
      ? 'La sesión se cerró: la contraseña cambió, se cerraron las sesiones de la cuenta o el acceso fue quitado. Volver a ingresar.'
      : parametros['listo'] === '1'
        ? 'La contraseña quedó guardada. Ingresar con ella.'
        : null;

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
          <p className={styles.entradilla}>
            Con el correo y la contraseña de la cuenta de DatosBolivia.com. Titulares y miembros de un equipo entran
            por aquí.
          </p>
        </header>

        {aviso ? (
          <p className={`${styles.nota} ${styles.separada}`} role="status">
            {aviso}
          </p>
        ) : null}

        <section className={`${styles.bloque} ${styles.bloquePrincipal}`} aria-label="Ingreso">
          <IngresarForm volver={volver} />
        </section>

        <p className={styles.nota}>
          Si se olvidó la contraseña:{' '}
          <Link className={styles.enlace} href="/cuenta/recuperar">
            Recuperar la clave
          </Link>
          . Las cuentas se abren con un plan; para pedir uno, escribir desde{' '}
          <Link className={styles.enlace} href="/servicios#contacto">
            Planes y servicios
          </Link>
          .
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
