import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/masthead';
import { SiteFooter } from '@/components/site-footer';
import { FREE_ROW_CAP, miles } from '@/lib/plans';
import { THEME_BOOT } from '@/lib/theme';
import styles from '../servicios/servicios.module.css';

export const metadata: Metadata = {
  title: 'Términos de uso',
  description: 'Condiciones de uso del sitio, de las descargas, de la API y de los planes de DatosBolivia.com.',
  alternates: { canonical: '/terminos' },
};

/**
 * Términos de uso y licencia de los datos.
 *
 * Borrador de trabajo, no un texto revisado por un abogado: el plan de
 * monetización (`docs/plan-monetizacion-2026-10-27.md`) pide esa revisión antes
 * de cobrar. La versión va en la cabecera porque, cuando lleguen las cuentas, la
 * aceptación se guarda con la versión aceptada.
 */
const VERSION = '2026-10-27';

export default function TerminosPage() {
  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <a className="skip-link" href="#contenido">
        Ir al contenido principal
      </a>
      <Masthead stamp={<span>Términos de uso · versión del {VERSION}</span>} />

      <div className={styles.pagina} id="contenido">
        <header className={styles.cabecera}>
          <p className={styles.antetitulo}>Servicios · Condiciones</p>
          <h2 className={styles.titulo}>Términos de uso</h2>
          <p className={styles.entradilla}>
            Las condiciones para usar el sitio, las descargas, la API y los planes de
            DatosBolivia.com.
          </p>
        </header>

        <div className={styles.prosa}>
          <h3>1. El sitio y los datos</h3>
          <p>
            DatosBolivia.com reúne, ordena y publica estadísticas de fuentes públicas y de
            elaboración propia. Cada cifra conserva el nombre de quien la publica y la fecha de su
            último dato. Los datos de terceros pertenecen a sus fuentes y se reproducen citándolas.
          </p>

          <h3>2. Uso gratuito</h3>
          <p>
            El tablero puede consultarse y citarse libremente. Las descargas sin plan llevan hasta{' '}
            {miles(FREE_ROW_CAP)} filas por archivo, y el asistente contesta un número limitado de
            preguntas por día desde cada conexión.
          </p>

          <h3>3. Cita obligatoria</h3>
          <p>
            Toda reutilización de datos, gráficos o resultados debe citar «DatosBolivia.com» y, cuando
            corresponda, la fuente original que figura en el pie de cada cifra.
          </p>

          <h3>4. Planes y API</h3>
          <ul>
            <li>Cada plan da acceso y volumen según lo publicado en <Link href="/servicios">Planes y servicios</Link>.</li>
            <li>Las llaves de API son personales de la cuenta y no deben compartirse ni publicarse.</li>
            <li>Los datos obtenidos con un plan pueden usarse dentro de la organización contratante y en sus informes, estudios y publicaciones, citando la fuente.</li>
            <li>
              No está permitido revender, sublicenciar ni redistribuir la base completa o partes
              sustanciales de ella como producto de datos propio.
            </li>
            <li>Al agotar el cupo del mes, la cuenta vuelve a los topes gratuitos hasta el periodo siguiente.</li>
            <li>El plan dura el periodo pagado. Sin pago del periodo siguiente, la cuenta pasa a gratuita después de cinco días de gracia.</li>
          </ul>

          <h3>5. Uso indebido</h3>
          <p>
            No está permitido eludir los límites del sitio, extraer la base de forma automatizada sin
            un plan ni interferir con su funcionamiento. Las conexiones que lo hagan pueden quedar
            limitadas.
          </p>

          <h3>6. Sin garantía</h3>
          <p>
            Los datos se publican tal como los entregan sus fuentes, con el cuidado descrito en la
            sección Método, pero sin garantía de exactitud, integridad ni disponibilidad continua.
            DatosBolivia.com no es una entidad del Estado y sus cifras no sustituyen a las oficiales.
            Las decisiones tomadas con estos datos son responsabilidad de quien las toma.
          </p>

          <h3>7. Datos de contacto</h3>
          <p>
            Los datos enviados en el formulario de pedidos se usan solo para contestar el pedido y
            administrar la cuenta. No se venden ni se ceden a terceros.
          </p>

          <h3>8. Cambios</h3>
          <p>
            Estos términos pueden actualizarse. La versión vigente es la del {VERSION}; los cambios que
            afecten a un plan pagado se avisan con anticipación.
          </p>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
