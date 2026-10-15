import { Monogram } from '@/components/brand/monogram';
import { hrefDe } from '@/lib/enlace-tablero';
import { SITE } from '@/lib/site-map';

/**
 * El pie institucional: quién publica, qué secciones hay y —lo más importante
 * para un sitio que se parece a un banco central— que DatosBolivia.com no es
 * una entidad del Estado. El propio manual de identidad lo advierte: la marca
 * es una propuesta original, no una identidad gubernamental.
 */
export function SiteFooter() {
  const anio = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <Monogram size={44} title="" />
        <div>
          <div className="site-footer-word">
            DatosBolivia<span>.</span>com
          </div>
          <div className="site-footer-sub">Centro de Datos de Bolivia</div>
        </div>
      </div>

      <div className="site-footer-grid">
        <section>
          <h2>Quiénes somos</h2>
          <p>
            Centro de datos independiente que reúne, ordena y publica estadísticas económicas,
            sociales y territoriales de Bolivia, con la fuente y la fecha de cada cifra.
          </p>
        </section>

        <section>
          <h2>Secciones</h2>
          <ul>
            {SITE.map((seccion) => (
              <li key={seccion.label}>
                <a href={hrefDe({ pestana: seccion.label })}>{seccion.label}</a>
              </li>
            ))}
          </ul>
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

      <p className="site-footer-legal">
        © {anio} DatosBolivia.com · Los datos pertenecen a sus fuentes; su reutilización debe
        citarlas.
      </p>
    </footer>
  );
}
