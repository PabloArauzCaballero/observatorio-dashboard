import { Icon } from './icons';

/**
 * Lo que se cobra por mover carga entre ciudades de Bolivia, citado.
 *
 * No hay serie oficial: el INE publica las toneladas transportadas por
 * departamento y modo (catálogo ANDA 178), no la tarifa, y la Autoridad de
 * Transporte regula las de pasajeros. Lo que existe son cifras que el
 * transporte pesado y la prensa han dado. Se muestran tal como se dijeron,
 * con la fuente y la fecha, y no se mezclan en una serie: son tres cosas
 * distintas —un viaje, una tonelada, un cambio porcentual— de años distintos.
 *
 * La columna «Por tonelada» sólo existe donde la fuente da el viaje y la
 * capacidad del camión: es una división, no una cifra nueva.
 */

interface Reference {
  readonly route: string;
  readonly what: string;
  readonly said: string;
  readonly perTonne: string | null;
  readonly when: string;
  readonly source: string;
  readonly url: string;
}

const REFERENCES: readonly Reference[] = [
  {
    route: 'La Paz – Santa Cruz',
    what: 'Camión de 3 t, por viaje',
    said: 'Bs 1.500 – 2.500',
    perTonne: 'Bs 500 – 833',
    when: 'consultado el 1-oct-2026',
    source: 'Bolivia Empresas, preguntas frecuentes',
    url: 'https://boliviaempresas.com/empresas-transporte-bolivia/',
  },
  {
    route: 'La Paz – Santa Cruz',
    what: 'Semirremolque de 30 t, por viaje',
    said: 'Bs 5.000 – 9.000',
    perTonne: 'Bs 167 – 300',
    when: 'consultado el 1-oct-2026',
    source: 'Bolivia Empresas, preguntas frecuentes',
    url: 'https://boliviaempresas.com/empresas-transporte-bolivia/',
  },
  {
    route: 'Sin ruta indicada',
    what: 'Flete del transporte pesado tras el fin de la subvención al combustible',
    said: 'Antes Bs 2.000; el sector pide Bs 2.500 – 3.000 (+25 % a +50 % según la ruta)',
    perTonne: null,
    when: '22-dic-2025',
    source: 'Red Uno: el dirigente del transporte pesado, tras el decreto 5503',
    url: 'https://www.reduno.com.bo/economia/el-transporte-pesado-analiza-subir-los-fletes-tras-el-fin-de-la-subvencion-2025122285036',
  },
  {
    route: 'Santa Cruz – La Paz',
    what: 'Carga, por quintal',
    said: 'De Bs 16 a Bs 13,50 (−20 %)',
    perTonne: null,
    when: 'dic-2015',
    source: 'Transporte en Bolivia, sobre la Cámara de Transporte Pesado',
    url: 'https://transportesbolivia.blogspot.com/2015/12/transporte-pesado-redujo-sus-tarifas-de.html',
  },
  {
    route: 'Puerto Suárez – Santa Cruz',
    what: 'Tarifa de carga (la fuente no dice la unidad)',
    said: 'De Bs 6.960 a Bs 4.524 (−54 %)',
    perTonne: null,
    when: 'dic-2015',
    source: 'Transporte en Bolivia, sobre la Cámara de Transporte Pesado',
    url: 'https://transportesbolivia.blogspot.com/2015/12/transporte-pesado-redujo-sus-tarifas-de.html',
  },
  {
    route: 'Santa Cruz – Arica (exportación)',
    what: 'Mercadería, por tonelada',
    said: 'US$ 80 el año anterior; US$ 65 desde mediados de 2015 (−23 %)',
    perTonne: 'US$ 65 – 80',
    when: 'dic-2015',
    source: 'Transporte en Bolivia, sobre la Cámara de Transporte Pesado',
    url: 'https://transportesbolivia.blogspot.com/2015/12/transporte-pesado-redujo-sus-tarifas-de.html',
  },
  {
    route: 'Arica – Santa Cruz (importación)',
    what: 'Mercadería, por tonelada',
    said: 'US$ 80 el año anterior; unos US$ 55 después (−48 %)',
    perTonne: 'US$ 55 – 80',
    when: 'dic-2015',
    source: 'Transporte en Bolivia, sobre la Cámara de Transporte Pesado',
    url: 'https://transportesbolivia.blogspot.com/2015/12/transporte-pesado-redujo-sus-tarifas-de.html',
  },
  {
    route: 'Santa Cruz – Arica (soya)',
    what: 'Transporte de soya, por viaje (la fuente no dice la unidad)',
    said: 'Costaba unos US$ 1.600; «ahora nadie paga ese monto». Caída general de fletes: 45 %',
    perTonne: null,
    when: '9-ene-2017',
    source: 'MundoMarítimo, sobre la Cámara de Transporte Pesado',
    url: 'https://www.mundomaritimo.cl/noticias/camara-de-transporte-pesado-de-bolivia-indica-que-precio-de-fletes-bajo-un-45',
  },
];

export function FreightReferences() {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Flete entre ciudades de Bolivia: las tarifas que se han citado</h2>
        <p className="panel-sub">
          No hay serie oficial del flete interior: el INE publica las toneladas transportadas, no
          lo que se cobra. Estas cifras son las que el transporte pesado y la prensa han dado, con
          su fuente y su fecha; no son una serie y no se comparan entre sí. La columna «Por
          tonelada» sólo se calcula donde la fuente da el viaje y la capacidad del camión.
        </p>
      </div>
      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Ruta</th>
              <th>Qué se cobra</th>
              <th>Lo que se dijo</th>
              <th>Por tonelada</th>
              <th>Fecha</th>
              <th>Fuente</th>
            </tr>
          </thead>
          <tbody>
            {REFERENCES.map((one) => (
              <tr key={`${one.route}|${one.what}`}>
                <td>{one.route}</td>
                <td>{one.what}</td>
                <td>{one.said}</td>
                <td>{one.perTonne ?? '—'}</td>
                <td>{one.when}</td>
                <td>
                  <a href={one.url} target="_blank" rel="noreferrer">
                    {one.source}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-sub">
        <Icon name="info" size={12} /> Para tener una serie propia haría falta una fuente que
        publique la tarifa cada mes (la Cámara de Transporte Pesado o la ABC); si aparece, entra
        aquí en el mismo lugar.
      </p>
    </div>
  );
}
