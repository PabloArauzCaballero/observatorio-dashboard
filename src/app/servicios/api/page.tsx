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
    'Documentación de la API de DatosBolivia.com: series del dólar, la UFV, el Banco Central y el Banco Mundial, lugares por ciudad, prensa, empresas y comercio exterior, en JSON o CSV con una llave del plan.',
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
    "reinicio": "2026-11-01",
    "por_minuto": 60,
    "lugares_por_consulta": 5000
  },
  "siguiente": null,
  "fuente": "DatosBolivia.com",
  "actualizado": "2026-10-27T18:30:00.000Z"
}`;

const CATALOGO = `{
  "data": [
    {
      "codigo": "diario.FX_OFFICIAL_USD_BOB",
      "nombre": "Tipo de cambio oficial",
      "fuente": "diario",
      "rubro": "TIPO_DE_CAMBIO",
      "unidad": "BOB/USD",
      "frecuencia": "diaria",
      "desde": "2024-07-21",
      "hasta": "2026-10-27",
      "observaciones": 829,
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
      "fecha": "2024-07-22",
      "valor": 6.96,
      "unidad": "BOB/USD",
      "lado": "SELL",
      "agregacion": "POINT_IN_TIME",
      "dispersion": null,
      "plazas": null,
      "variacion_pct": 0
    }
  ],
  "siguiente": null,
  "fuente": "Banco Central de Bolivia",
  "actualizado": "2026-10-27"
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
  "siguiente": "eyJvIjoxMDAwfQ",
  "fuente": "DatosBolivia.com: catálogo de lugares (la confianza y el método van en cada fila)",
  "actualizado": null
}`;

const ERRORES: ReadonlyArray<{ codigo: string; cuando: string; que: string }> = [
  {
    codigo: '400',
    cuando: 'Un parámetro no es válido o falta uno obligatorio: un pageSize fuera de 1 a 5.000, una fecha mal escrita, un cursor ajeno, una ciudad de más o un código de serie que no existe.',
    que: 'Corregir el pedido. El campo «error» dice qué se espera y «parametro» nombra el parámetro.',
  },
  {
    codigo: '401',
    cuando: 'Falta el encabezado Authorization, la llave no tiene la forma obs_live_… o no se reconoce (desconocida o revocada).',
    que: 'Revisar la llave en /cuenta o crear una nueva.',
  },
  {
    codigo: '402',
    cuando: 'El plan de la cuenta venció o no incluye la API.',
    que: 'Renovar o cambiar de plan en Servicios.',
  },
  {
    codigo: '429',
    cuando: 'Se agotó el cupo del mes, o la llave pasó de las consultas por minuto de su plan. Una consulta frenada por ritmo no descuenta cupo.',
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

const ENCABEZADOS: ReadonlyArray<[string, string]> = [
  ['X-Cupo-Limite', 'Consultas por mes del plan.'],
  ['X-Cupo-Restante', 'Consultas que quedan este mes, ya descontada la actual.'],
  ['X-Cupo-Reinicio', 'Día en que el cupo vuelve a cero (AAAA-MM-DD).'],
  ['Retry-After', 'En 429 y 503: segundos de espera antes de reintentar.'],
  ['X-Siguiente', 'Solo en CSV: el cursor de la página siguiente; falta en la última.'],
  ['X-Tope-Lugares', 'Solo en /api/v1/lugares, cuando el plan recortó la consulta: cuántos lugares da como máximo.'],
];

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
              vuelve a cero el primer día de cada mes, a medianoche UTC. Además, cada llave admite un
              número de consultas por minuto según su plan; una consulta frenada por ese ritmo no
              descuenta cupo. Toda respuesta, también las de error, lleva los encabezados de cupo.
            </p>
          </div>
          <div className={api.tablaScroll}>
            <table className={api.tabla}>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Consultas por mes</th>
                  <th scope="col">Por minuto</th>
                  <th scope="col">Lugares por consulta</th>
                  <th scope="col">Llaves</th>
                </tr>
              </thead>
              <tbody>
                {conApi.map((plan) => (
                  <tr key={plan.code}>
                    <th scope="row">{plan.nombre}</th>
                    <td>{miles(plan.apiPorMes)}</td>
                    <td>{miles(plan.apiPorMinuto)}</td>
                    <td>
                      {plan.lugaresPorDescarga === null ? 'Sin tope' : miles(plan.lugaresPorDescarga)}
                    </td>
                    <td>{miles(plan.llaves)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Parametros filas={ENCABEZADOS} />
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
            <p>
              <code>fuente</code> dice quién publica las cifras. <code>actualizado</code> dice hasta
              cuándo está al día esa fuente: el instante en que llegó su último dato (ISO 8601) o,
              cuando la fuente no registra la hora, la fecha o el periodo de ese dato (AAAA-MM-DD,
              AAAA-MM o AAAA). Es <code>null</code> solo en los lugares, cuyo catálogo no registra
              cuándo se cargó cada uno.
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
                El catálogo de series: el dólar oficial y el paralelo (también por ficha estable), la
                UFV, los mercados que siguen al dólar, las series anuales de Bolivia, el panel del
                Banco Mundial para Bolivia y, por separado, las estadísticas del Banco Central. Cada
                fila trae el <code>codigo</code> con que se piden sus observaciones. El tipo de cambio
                oficial va como una sola serie, la que dibuja el tablero, y también por lado.
              </p>
            </div>
            <Parametros
              filas={[
                ['fuente', '«diario», «macro», «panel» o «bcb». Sin ella: diario, macro y panel. Las series del Banco Central se piden con fuente=bcb.'],
                ['buscar', 'Palabras que tienen que aparecer en el código o el nombre, hasta 120 caracteres.'],
                ['familia', 'Solo junto con fuente=bcb: la familia de cuadros del Banco Central.'],
                ...PAGINA,
              ]}
            />
            <Codigo etiqueta="Respuesta de ejemplo" texto={CATALOGO} />
          </Ruta>

          <Ruta id="serie" ruta="/api/v1/series/{codigo}">
            <div className={api.prosa}>
              <p>
                Las observaciones de una serie, de la más vieja a la más nueva. Las diarias traen{' '}
                <code>fecha</code> y <code>lado</code>; las anuales y las del Banco Central,{' '}
                <code>periodo</code>. Las series por lado llevan el lado en el código (
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
                Los lugares de una o varias ciudades, con la misma lectura que la descarga del mapa.
                Van ordenados por ciudad, familia y nombre. Cada fila dice con qué confianza y por qué
                método se ubicó el punto.
              </p>
              <p>
                El plan fija cuántos lugares da una misma consulta, también recorrida por cursor (la
                columna «Lugares por consulta» de la tabla de cupo). La página que llega a ese tope
                trae <code>siguiente</code> en <code>null</code>, y toda página de una consulta
                recortada lleva el encabezado <code>X-Tope-Lugares</code>.
              </p>
            </div>
            <Parametros
              filas={[
                ['ciudad', 'Obligatorio. Una o varias, separadas por coma, hasta 12.'],
                ['familia', 'Una o varias familias, separadas por coma, hasta 60. Sin ella, todas.'],
                ...PAGINA,
              ]}
            />
            <Codigo etiqueta="Respuesta de ejemplo" texto={LUGARES} />
          </Ruta>

          <Ruta id="prensa" ruta="/api/v1/prensa">
            <div className={api.prosa}>
              <p>
                Las notas del archivo de prensa, de la más nueva a la más vieja, con el mismo
                recorte que el panel de Prensa. Cada fila trae el enlace a la nota original. Como
                la lectura no cuenta el total, una página llena trae <code>siguiente</code> aunque
                la próxima resulte vacía. <code>actualizado</code> es la publicación de la nota más
                reciente del archivo.
              </p>
            </div>
            <Parametros
              filas={[
                ['anio', 'Uno o varios años de cuatro cifras, separados por coma.'],
                ['tono', 'Uno o varios tonos, como en el panel de Prensa.'],
                ['tema', 'Uno o varios temas.'],
                ['region', 'Una o varias regiones.'],
                ['medio', 'Uno o varios medios.'],
                ['termino', 'Uno o varios términos vigilados.'],
                ['buscar', 'Texto que tiene que aparecer en el titular o la entradilla, hasta 120 caracteres.'],
                ...PAGINA,
              ]}
            />
          </Ruta>

          <Ruta id="empresas" ruta="/api/v1/empresas">
            <div className={api.prosa}>
              <p>
                El directorio de empresas que publica el tablero: un subconjunto público del registro
                del SEPREC, no la base completa del Registro de Comercio. Ordenado por departamento,
                municipio y nombre; <code>actualizado</code> es la fecha de corte.
              </p>
            </div>
            <Parametros
              filas={[
                ['departamento', 'Un departamento, como aparece en la tabla de Empresas.'],
                ['municipio', 'Un municipio.'],
                ['buscar', 'Texto en el nombre, hasta 100 caracteres.'],
                ...PAGINA,
              ]}
            />
          </Ruta>

          <Ruta id="aduana" ruta="/api/v1/aduana">
            <div className={api.prosa}>
              <p>
                La base aduanera del INE sumada por una dimensión, con la misma lectura que «Detalle
                aduanero»: valor en dólares, peso y el valor del último año del tramo y del anterior.
                Como en el panel, el filtro de la misma dimensión no recorta su propio desglose, y una
                combinación que el INE no publica (importaciones por país y departamento a la vez)
                responde 400 con el motivo, igual que un código mal escrito. <code>actualizado</code>{' '}
                es el último mes que tiene la base.
              </p>
            </div>
            <Parametros
              filas={[
                ['por', 'Obligatorio: year, month, section, chapter, heading, subheading, nandina, country, zone, department, activity, activityGroup, traditional, traditionalGroup, use, useGroup o kind.'],
                ['flujo', '«X» exportaciones (por omisión) o «M» importaciones.'],
                ['desde, hasta', 'Años inicial y final, AAAA, de 1990 a 2100.'],
                ['meses', 'Tramo de meses de cada año, p. ej. 1-7 para comparar enero a julio.'],
                ['producto', 'Códigos NANDINA de 2 a 10 dígitos, separados por coma.'],
                ['pais, departamento', 'Códigos del INE, separados por coma, hasta 40 por filtro.'],
                ['seccion, actividad, tradicional, uso, tipo', 'Los demás filtros del panel, por código.'],
                ...PAGINA,
              ]}
            />
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
