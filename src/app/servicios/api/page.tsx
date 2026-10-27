import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/masthead';
import { SiteFooter } from '@/components/site-footer';
import { PLANS, SERVICES_PATH, miles } from '@/lib/plans';
import { THEME_BOOT } from '@/lib/theme';
import styles from '../servicios.module.css';
import api from './api.module.css';
import { Codigo } from './copiar';

export const metadata: Metadata = {
  title: 'API de datos',
  description:
    'Documentación de la API de DatosBolivia.com: series del dólar, la UFV, el Banco Central y el Banco Mundial, y lugares por ciudad, en JSON o CSV con una llave del plan.',
  alternates: { canonical: '/servicios/api' },
};

const BASE = 'https://datosbolivia.com/api/v1';
const LLAVE = 'obs_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

const CURL = `curl -H "Authorization: Bearer ${LLAVE}" \\
  "${BASE}/series/diario.FX_OFFICIAL_USD_BOB?desde=2026-01-01"

# La misma página en CSV
curl -H "Authorization: Bearer ${LLAVE}" \\
  "${BASE}/lugares?ciudad=La%20Paz&familia=Farmacias&formato=csv" -o lugares.csv`;

const PYTHON = `import requests

BASE = "${BASE}"
CABECERA = {"Authorization": "Bearer ${LLAVE}"}

def todas_las_filas(ruta, **parametros):
    """Recorre las páginas siguiendo «siguiente» hasta que llega null."""
    filas = []
    while True:
        r = requests.get(f"{BASE}/{ruta}", headers=CABECERA, params=parametros, timeout=60)
        r.raise_for_status()
        cuerpo = r.json()
        filas.extend(cuerpo["data"])
        print("Quedan", r.headers.get("X-Cupo-Restante"), "consultas este mes")
        if cuerpo["siguiente"] is None:
            return filas
        parametros["cursor"] = cuerpo["siguiente"]

lugares = todas_las_filas("lugares", ciudad="Santa Cruz de la Sierra", pageSize=5000)
print(len(lugares), "lugares")`;

const POWER_QUERY = `let
    Llave = "${LLAVE}",
    Leer = (cursor as nullable text) =>
        let
            Consulta = [ciudad = "Cochabamba", pageSize = "5000"]
                & (if cursor = null then [] else [cursor = cursor]),
            Respuesta = Json.Document(
                Web.Contents("${BASE}/lugares", [
                    Query = Consulta,
                    Headers = [Authorization = "Bearer " & Llave]
                ])
            )
        in
            Respuesta,
    Paginas = List.Generate(
        () => Leer(null),
        each _ <> null,
        each if _[siguiente] = null then null else Leer(_[siguiente]),
        each _[data]
    ),
    Filas = List.Combine(Paginas),
    Tabla = Table.FromRecords(Filas)
in
    Tabla`;

const USO = `{
  "data": {
    "plan": "analista",
    "nombre": "Analista",
    "estado": "ACTIVE",
    "pagado_hasta": "2026-11-30",
    "cupo_mensual": 10000,
    "usadas": 1250,
    "restantes": 8750,
    "reinicio": "2026-11-01"
  },
  "siguiente": null,
  "fuente": "DatosBolivia.com",
  "actualizado": "2026-10-27T18:30:00.000Z"
}`;

const CATALOGO = `{
  "data": [
    {
      "codigo": "diario.FX_OFFICIAL_USD_BOB",
      "nombre": "Tipo de cambio oficial del dólar",
      "fuente": "diario",
      "rubro": "TIPO_DE_CAMBIO",
      "unidad": "BOB/USD",
      "frecuencia": "diaria",
      "desde": "2008-11-03",
      "hasta": "2026-10-27",
      "observaciones": 4312,
      "editor": "Banco Central de Bolivia"
    }
  ],
  "siguiente": "eyJvIjoxMDAwfQ",
  "fuente": "DatosBolivia.com",
  "actualizado": "2026-10-27T12:05:41.000Z"
}`;

const OBSERVACIONES = `{
  "data": [
    {
      "fecha": "2026-01-02",
      "valor": 6.96,
      "unidad": "BOB/USD",
      "agregacion": "POINT_IN_TIME",
      "dispersion": null,
      "plazas": null,
      "variacion_pct": 0
    }
  ],
  "siguiente": null,
  "fuente": "Banco Central de Bolivia",
  "actualizado": "2026-10-27T12:05:41.000Z"
}`;

const LUGARES = `{
  "data": [
    {
      "id": "osm-node-123456",
      "ciudad": "La Paz",
      "nombre": "Farmacia Central",
      "grupo": "Salud",
      "familia": "Farmacias",
      "barrio": "Sopocachi",
      "direccion": "Av. 6 de Agosto",
      "marca": null,
      "latitud": -16.5101,
      "longitud": -68.1253,
      "actividad_regulada": true,
      "registro_que_lo_confirmaria": "AGEMED",
      "confianza": 0.9,
      "grado_de_calidad": "A",
      "metodo_de_ubicacion": "PUNTO"
    }
  ],
  "siguiente": "eyJvIjo1MDAwfQ",
  "fuente": "DatosBolivia.com: catálogo de lugares (la confianza y el método van en cada fila)",
  "actualizado": null
}`;

const ERRORES: ReadonlyArray<{ codigo: string; cuando: string; que: string }> = [
  {
    codigo: '400',
    cuando: 'Un parámetro no es válido: un pageSize fuera de 1 a 5.000, una fecha mal escrita, un cursor ajeno o un código de serie que no existe.',
    que: 'Corregir el pedido. El campo «error» dice cuál.',
  },
  {
    codigo: '401',
    cuando: 'Falta el encabezado Authorization, la llave no tiene la forma obs_live_… o fue revocada.',
    que: 'Revisar la llave en /cuenta o crear una nueva.',
  },
  {
    codigo: '402',
    cuando: 'El plan de la cuenta venció o no incluye la API.',
    que: 'Renovar o cambiar de plan en Servicios.',
  },
  {
    codigo: '429',
    cuando: 'Se agotó el cupo del mes, o la llave pasó de 60 consultas por minuto.',
    que: 'Esperar los segundos que indica Retry-After.',
  },
  {
    codigo: '503',
    cuando: 'El servicio de cuentas o la base de datos no respondieron a tiempo.',
    que: 'Reintentar en unos segundos; no cuenta como un error de la llave.',
  },
];

function Ruta({
  id,
  ruta,
  children,
}: {
  id: string;
  ruta: string;
  children: React.ReactNode;
}) {
  return (
    <section className={api.ruta} id={id} aria-labelledby={`${id}-titulo`}>
      <h3 className={api.rutaTitulo} id={`${id}-titulo`}>
        <span className={api.metodo}>GET</span>
        <code>{ruta}</code>
      </h3>
      {children}
    </section>
  );
}

function Parametros({ filas }: { filas: ReadonlyArray<[string, string]> }) {
  return (
    <div className={api.tablaScroll}>
      <table className={api.tabla}>
        <thead>
          <tr>
            <th scope="col">Parámetro</th>
            <th scope="col">Qué hace</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(([nombre, que]) => (
            <tr key={nombre}>
              <th scope="row">
                <code>{nombre}</code>
              </th>
              <td>{que}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PAGINA: ReadonlyArray<[string, string]> = [
  ['pageSize', 'Filas por página, de 1 a 5.000. Por omisión, 1.000.'],
  ['cursor', 'El valor de «siguiente» de la página anterior.'],
  ['formato', '«json» (por omisión) o «csv». El CSV va en UTF-8 con BOM y el cursor de la página siguiente llega en el encabezado X-Siguiente.'],
];

export default function ApiPage() {
  const conApi = PLANS.filter((plan) => plan.apiPorMes > 0);
  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <a className="skip-link" href="#contenido">
        Ir al contenido principal
      </a>
      <Masthead stamp={<span>API de datos</span>} />

      <div className={styles.pagina} id="contenido">
        <header className={styles.cabecera}>
          <p className={styles.antetitulo}>Servicios · API</p>
          <h2 className={styles.titulo}>La API de DatosBolivia.com</h2>
          <p className={styles.entradilla}>
            Las mismas series y los mismos lugares que publica el tablero, en JSON o CSV, para
            leerlos desde un programa, una hoja de cálculo o un tablero propio. Cada consulta cuenta
            una vez contra el cupo mensual del plan.
          </p>
        </header>

        <ul className={api.indice} aria-label="En esta página">
          <li><a href="#llave">Llave</a></li>
          <li><a href="#cupo">Cupo</a></li>
          <li><a href="#errores">Errores</a></li>
          <li><a href="#paginas">Páginas</a></li>
          <li><a href="#rutas">Rutas</a></li>
          <li><a href="#ejemplos">Ejemplos</a></li>
          <li><a href="/api/v1/openapi.json">OpenAPI</a></li>
        </ul>

        <section className={styles.bloque} id="llave" aria-labelledby="llave-titulo">
          <h2 id="llave-titulo" className={styles.subtitulo}>
            Cómo se obtiene una llave
          </h2>
          <ol className={styles.pasos}>
            <li>
              <strong>Plan.</strong> La API es parte de los planes{' '}
              {conApi.map((plan) => plan.nombre).join(', ').replace(/, ([^,]*)$/u, ' e $1')}. Se
              pide en <Link href={SERVICES_PATH}>Servicios</Link>.
            </li>
            <li>
              <strong>Cuenta.</strong> Con el plan activo, en <Link href="/cuenta">/cuenta</Link> se
              elige «Crear llave». La llave se muestra una sola vez: conviene guardarla en ese momento.
            </li>
            <li>
              <strong>Encabezado.</strong> Cada consulta lleva la llave en{' '}
              <code>Authorization: Bearer obs_live_…</code>. Sin ese encabezado la respuesta es 401.
            </li>
          </ol>
          <div className={api.prosa}>
            <p>
              La llave identifica a la cuenta, no a una persona: no debe ir en una página web pública
              ni en un repositorio. Si se filtra, se revoca en /cuenta y se crea otra.
            </p>
          </div>
        </section>

        <section className={styles.bloque} id="cupo" aria-labelledby="cupo-titulo">
          <h2 id="cupo-titulo" className={styles.subtitulo}>
            Cupo y encabezados
          </h2>
          <div className={api.prosa}>
            <p>
              Cada consulta respondida cuenta una vez, sea cual sea el tamaño de la página. El cupo
              vuelve a cero el primer día de cada mes, a medianoche UTC. Además, cada llave admite
              hasta 60 consultas por minuto.
            </p>
          </div>
          <div className={api.tablaScroll}>
            <table className={api.tabla}>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Consultas por mes</th>
                  <th scope="col">Llaves</th>
                </tr>
              </thead>
              <tbody>
                {conApi.map((plan) => (
                  <tr key={plan.code}>
                    <th scope="row">{plan.nombre}</th>
                    <td>{miles(plan.apiPorMes)}</td>
                    <td>{miles(plan.llaves)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Parametros
            filas={[
              ['X-Cupo-Limite', 'Consultas por mes del plan.'],
              ['X-Cupo-Restante', 'Consultas que quedan este mes, ya descontada la actual.'],
              ['X-Cupo-Reinicio', 'Día en que el cupo vuelve a cero (AAAA-MM-DD).'],
            ]}
          />
        </section>

        <section className={styles.bloque} id="errores" aria-labelledby="errores-titulo">
          <h2 id="errores-titulo" className={styles.subtitulo}>
            Errores
          </h2>
          <div className={api.prosa}>
            <p>
              Todo error llega en JSON con un campo <code>error</code> que explica qué pasó, y con los
              mismos encabezados de cupo.
            </p>
          </div>
          <div className={api.tablaScroll}>
            <table className={api.tabla}>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Qué hacer</th>
                </tr>
              </thead>
              <tbody>
                {ERRORES.map((fila) => (
                  <tr key={fila.codigo}>
                    <th scope="row">{fila.codigo}</th>
                    <td>{fila.cuando}</td>
                    <td>{fila.que}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.bloque} id="paginas" aria-labelledby="paginas-titulo">
          <h2 id="paginas-titulo" className={styles.subtitulo}>
            Páginas y formato
          </h2>
          <div className={api.prosa}>
            <p>
              Las respuestas tienen siempre la misma forma:{' '}
              <code>{'{ data: [...], siguiente, fuente, actualizado }'}</code>. Mientras{' '}
              <code>siguiente</code> traiga un valor, hay otra página: se pide la misma dirección con{' '}
              <code>cursor=</code> ese valor. En la última página, <code>siguiente</code> es{' '}
              <code>null</code>. Cada página es una consulta.
            </p>
          </div>
          <Parametros filas={PAGINA} />
        </section>

        <section className={styles.bloque} id="rutas" aria-labelledby="rutas-titulo">
          <h2 id="rutas-titulo" className={styles.subtitulo}>
            Rutas
          </h2>

          <Ruta id="uso" ruta="/api/v1/uso">
            <div className={api.prosa}>
              <p>
                El plan de la llave, el cupo del mes, cuántas consultas lleva y cuántas le quedan.
                Esta consulta también cuenta, y la cifra que devuelve ya la incluye.
              </p>
            </div>
            <Codigo etiqueta="Respuesta de ejemplo" texto={USO} />
          </Ruta>

          <Ruta id="series" ruta="/api/v1/series">
            <div className={api.prosa}>
              <p>
                El catálogo de series: el dólar oficial y el paralelo, la UFV, las series anuales de
                Bolivia, el panel del Banco Mundial para Bolivia y, por separado, las estadísticas del
                Banco Central. Cada fila trae el <code>codigo</code> con que se piden sus
                observaciones.
              </p>
            </div>
            <Parametros
              filas={[
                ['fuente', '«diario», «macro», «panel» o «bcb». Sin ella: diario, macro y panel. Las series del Banco Central se piden con fuente=bcb y llegan de a 40 por página.'],
                ['buscar', 'Palabras que tienen que aparecer en el código o el nombre.'],
                ['familia', 'Solo con fuente=bcb: la familia de cuadros del Banco Central.'],
                ...PAGINA,
              ]}
            />
            <Codigo etiqueta="Respuesta de ejemplo" texto={CATALOGO} />
          </Ruta>

          <Ruta id="serie" ruta="/api/v1/series/{codigo}">
            <div className={api.prosa}>
              <p>
                Las observaciones de una serie, de la más vieja a la más nueva. Las diarias traen{' '}
                <code>fecha</code>; las anuales y las del Banco Central, <code>periodo</code>. Las
                series del dólar paralelo llevan el lado en el código (
                <code>diario.FX_PARALLEL_USD_BOB:SELL</code>); los dos puntos pueden ir tal cual o
                como <code>%3A</code>.
              </p>
            </div>
            <Parametros
              filas={[
                ['desde', 'AAAA, AAAA-MM o AAAA-MM-DD, inclusive.'],
                ['hasta', 'AAAA, AAAA-MM o AAAA-MM-DD, inclusive: hasta=2024 incluye el 31 de diciembre.'],
                ...PAGINA,
              ]}
            />
            <Codigo etiqueta="Respuesta de ejemplo" texto={OBSERVACIONES} />
          </Ruta>

          <Ruta id="lugares" ruta="/api/v1/lugares">
            <div className={api.prosa}>
              <p>
                Los lugares de una o varias ciudades, con la misma lectura que la descarga del mapa y
                sin el tope del plan gratuito. Van ordenados por ciudad, familia y nombre. Cada fila
                dice con qué confianza y por qué método se ubicó el punto.
              </p>
            </div>
            <Parametros
              filas={[
                ['ciudad', 'Obligatoria. Una o varias, separadas por coma, hasta 12.'],
                ['familia', 'Una o varias familias, separadas por coma. Sin ella, todas.'],
                ...PAGINA,
              ]}
            />
            <Codigo etiqueta="Respuesta de ejemplo" texto={LUGARES} />
          </Ruta>
        </section>

        <section className={styles.bloque} id="ejemplos" aria-labelledby="ejemplos-titulo">
          <h2 id="ejemplos-titulo" className={styles.subtitulo}>
            Ejemplos
          </h2>
          <Codigo etiqueta="curl" texto={CURL} />
          <Codigo etiqueta="Python (requests), recorriendo todas las páginas" texto={PYTHON} />
          <div className={api.prosa}>
            <p>
              En Excel: Datos → Obtener datos → Desde otras fuentes → Consulta en blanco → Editor
              avanzado, y se pega el código. La primera vez, Excel pide el nivel de privacidad del
              origen; con «Anónimo» la llave viaja en el encabezado escrito en la consulta.
            </p>
          </div>
          <Codigo etiqueta="Excel Power Query (M), recorriendo todas las páginas" texto={POWER_QUERY} />
          <div className={api.prosa}>
            <p>
              El contrato completo, para generar un cliente o importarlo en Postman, está en{' '}
              <a href="/api/v1/openapi.json">/api/v1/openapi.json</a> (OpenAPI 3.1).
            </p>
          </div>
          <p className={styles.legal}>
            El uso de los datos y de la API se rige por los <Link href="/terminos">términos de uso</Link>.
          </p>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
