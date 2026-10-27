import Link from 'next/link';
import { Monogram } from '@/components/brand/monogram';
import { hrefDe } from '@/lib/enlace-tablero';
import { SITE } from '@/lib/site-map';

/**
 * El pie institucional: quién publica, qué secciones hay y —lo más importante
 * para un sitio que se parece a un banco central— que DatosBolivia.com no es
 * una entidad del Estado. El propio manual de identidad lo advierte: la marca
 * es una propuesta original, no una identidad gubernamental.
 *
 * Se lee como el directorio de un diario: la marca sobre un filete doble (tinta
 * y oro, el mismo de la cabecera), el mapa del sitio con cada sección y sus
 * páginas en columnas, y debajo las tres notas institucionales separadas por
 * filetes verticales. Los enlaces no van subrayados: lo están al pasar.
 */
export function SiteFooter() {
  const anio = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <Link className="site-footer-lockup" href="/" aria-label="DatosBolivia.com, portada">
          <Monogram size={48} title="" />
          <span>
            <span className="site-footer-word">
              DatosBolivia<span>.</span>com
            </span>
            <span className="site-footer-sub">Centro de Datos de Bolivia</span>
          </span>
        </Link>
        <p className="site-footer-motto">Cada cifra, con su fuente y su fecha.</p>
      </div>

      <nav className="site-footer-map" aria-label="Mapa del sitio">
        {SITE.map((seccion) => (
          <section key={seccion.label} className="site-footer-group">
            <h2>
              <a href={hrefDe({ pestana: seccion.label })}>{seccion.label}</a>
            </h2>
            {seccion.pages.length ? (
              <ul>
                {seccion.pages.map((pagina) => (
                  <li key={pagina.label}>
                    <a href={hrefDe({ pestana: seccion.label, pagina: pagina.label })}>
                      {pagina.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </nav>

      <div className="site-footer-notes">
        <section>
          <h2>Quiénes somos</h2>
          <p>
            Centro de datos independiente que reúne, ordena y publica estadísticas económicas,
            sociales y territoriales de Bolivia, con la fuente y la fecha de cada cifra.
          </p>
        </section>

        <section>
          <h2>Metodología</h2>
          <p>
            Cada cifra conserva el nombre de quien la publica y la fecha de su último dato. Los
            cálculos propios se identifican como «Elaboración: DatosBolivia.com». El detalle de
            fuentes y métodos está en la sección <a href={hrefDe({ pestana: 'Método' })}>Método</a>.
          </p>
        </section>

        <section>
          <h2>Aviso</h2>
          <p>
            DatosBolivia.com es una iniciativa independiente. No es el Banco Central de Bolivia, el
            Instituto Nacional de Estadística ni ninguna otra entidad del Estado. Las cifras
            oficiales se reproducen citando a su fuente.
          </p>
        </section>
      </div>

      <div className="site-footer-legal">
        <span>© {anio} DatosBolivia.com</span>
        <span>Los datos pertenecen a sus fuentes; su reutilización debe citarlas.</span>
        <a href="/servicios">Planes y servicios</a>
        <a href="/terminos">Términos de uso</a>
        <a href="#top" className="site-footer-top">
          Volver arriba <span aria-hidden="true">↑</span>
        </a>
      </div>
    </footer>
  );
}
