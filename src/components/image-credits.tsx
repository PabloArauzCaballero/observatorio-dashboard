import { IMAGE_CREDITS } from '@/lib/image-credits';

/**
 * Autor, licencia y origen de cada imagen que no es del Observatorio.
 *
 * Las licencias libres (CC BY, CC BY-SA) piden nombrar al autor y enlazar la licencia; las CC0 y de
 * dominio público no lo exigen, pero se listan igual. Va plegado: es para quien lo busca, no para
 * quien lee las cifras.
 */
export function ImageCredits() {
  const kinds = [...new Set(IMAGE_CREDITS.map((credit) => credit.kind))];
  return (
    <section className="stack" aria-label="Créditos de las imágenes">
      <details className="panel-note">
        <summary>Créditos de las imágenes ({IMAGE_CREDITS.length})</summary>
        <p>
          Las fotografías de personas y vehículos y algunas marcas vienen de Wikimedia Commons, con
          la licencia que indica cada una; el resto de los logotipos de empresas se toma de su
          propio sitio web. Quien no tiene una fotografía libre publicada aparece con sus iniciales.
        </p>
        {kinds.map((kind) => (
          <div key={kind}>
            <h4>{kind}</h4>
            <ul>
              {IMAGE_CREDITS.filter((credit) => credit.kind === kind).map((credit) => (
                <li key={`${kind}-${credit.name}`}>
                  {credit.name}: {credit.author}, {credit.license}.{' '}
                  <a href={credit.source} target="_blank" rel="noreferrer noopener">
                    Origen
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </section>
  );
}
