import { CORS_HEADERS } from '@/lib/api-v1/auth';
import {
  DEFAULT_BURST_PER_MINUTE,
  DEFAULT_PAGE_SIZE,
  FAILED_KEYS_PER_WINDOW,
  MAX_PAGE_SIZE,
  MAX_TEXT_LENGTH,
  SERIES_SOURCES,
} from '@/lib/api-v1/contrato';
import { EXPORT_PLACE_LIMIT } from '@/lib/places';
import { PLANS, miles } from '@/lib/plans';
import { DIMENSIONS } from '@/lib/trade-records-query';

/**
 * El contrato de `/api/v1` en OpenAPI 3.1, escrito a mano.
 *
 * Público y sin llave: describir la API no es usarla. Lo que dice aquí es lo
 * que las rutas hacen hoy; una ruta que no está aquí no es parte del contrato.
 * Los límites de cada plan (consultas por minuto, lugares por consulta) se leen
 * de `lib/plans.ts` y los del contrato de `lib/api-v1/contrato.ts`, así que el
 * documento no puede contar otras cifras que las que se aplican.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const conApi = PLANS.filter((plan) => plan.apiPorMes > 0);
const porMinuto = conApi.map((plan) => `${plan.nombre}, ${miles(plan.apiPorMinuto)}`).join('; ');
const topes = conApi
  .map((plan) =>
    `${plan.nombre}, ${plan.lugaresPorDescarga === null ? 'sin tope' : miles(plan.lugaresPorDescarga)}`,
  )
  .join('; ');

/* ---------------------------------------------------------------- encabezados */

const quotaHeaders = {
  'X-Cupo-Limite': {
    description: 'Consultas por mes del plan de la llave (0 si la llave no se reconoció).',
    schema: { type: 'integer', minimum: 0 },
  },
  'X-Cupo-Restante': {
    description:
      'Consultas que quedan este mes, ya descontada esta. En un 429 por ritmo, el valor de la última consulta respondida.',
    schema: { type: 'integer', minimum: 0 },
  },
  'X-Cupo-Reinicio': {
    description: 'Día en que el cupo vuelve a cero: el primer día del mes siguiente, a medianoche UTC.',
    schema: { type: 'string', format: 'date' },
  },
};

const retryAfter = {
  'Retry-After': { description: 'Segundos de espera antes de reintentar.', schema: { type: 'integer', minimum: 1 } },
};

const wwwAuthenticate = {
  'WWW-Authenticate': {
    description: 'Siempre `Bearer realm="api-v1"`; con `error="invalid_token"` si la llave no sirve.',
    schema: { type: 'string' },
  },
};

/* -------------------------------------------------------------------- errores */

const errorContent = { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } };

const errors = {
  '401': {
    description:
      'Falta el encabezado Authorization, la llave no tiene la forma `obs_live_` más 43 caracteres, o el núcleo no la reconoce (desconocida o revocada).',
    headers: { ...quotaHeaders, ...wwwAuthenticate },
    content: errorContent,
  },
  '402': {
    description: 'El plan de la llave no está vigente o no incluye la API. El campo `planes` lleva a Servicios.',
    headers: quotaHeaders,
    content: errorContent,
  },
  '429': {
    description: `Tres causas, distinguibles por el campo \`error\`. Llaves rechazadas: más de ${FAILED_KEYS_PER_WINDOW} llaves mal escritas, desconocidas o revocadas desde una misma dirección en diez minutos; no se pregunta al núcleo hasta que pase \`Retry-After\` (una llave aceptada en el último minuto no se frena por esto). Ritmo: más consultas por minuto de las que admite el plan (${porMinuto}); una llave que el sitio todavía no verificó en el último minuto va con ${DEFAULT_BURST_PER_MINUTE}. Un pedido frenado por ritmo no llega al núcleo ni descuenta cupo. Cupo: se agotó el cupo mensual; \`Retry-After\` cuenta hasta el reinicio y el campo \`planes\` lleva a Servicios.`,
    headers: { ...quotaHeaders, ...retryAfter },
    content: errorContent,
  },
  '503': {
    description:
      'El servicio de cuentas (Retry-After: 30) o la base de datos (Retry-After: 60) no respondieron. No es un error de la llave.',
    headers: { ...quotaHeaders, ...retryAfter },
    content: errorContent,
  },
};

const badRequest = {
  '400': {
    description:
      'Un parámetro no es válido o falta uno obligatorio. `error` dice cuál y qué se espera de él; `parametro` lo nombra.',
    headers: quotaHeaders,
    content: errorContent,
  },
};

/* ------------------------------------------------------------------ páginas */

const page = {
  pageSize: {
    name: 'pageSize',
    in: 'query',
    description: `Filas por página, de 1 a ${MAX_PAGE_SIZE}.`,
    schema: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
  },
  cursor: {
    name: 'cursor',
    in: 'query',
    description: 'El valor de `siguiente` (o del encabezado `X-Siguiente` en CSV) de la página anterior.',
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,200}$' },
  },
  formato: {
    name: 'formato',
    in: 'query',
    description:
      '`csv` devuelve la página en CSV (UTF-8 con BOM, separado por comas); el cursor de la siguiente va en el encabezado `X-Siguiente`, que falta en la última.',
    schema: { type: 'string', enum: ['json', 'csv'], default: 'json' },
  },
};
const paging = [page.pageSize, page.cursor, page.formato];

const text = (name: string, description: string, maxLength = MAX_TEXT_LENGTH) => ({
  name,
  in: 'query',
  description,
  schema: { type: 'string', maxLength },
});

const list = (name: string, description: string, maxItems: number, pattern?: string) => ({
  name,
  in: 'query',
  description: `${description} Varios valores van separados por coma (hasta ${maxItems}); uno de más o mal escrito es un 400.`,
  schema: { type: 'string', ...(pattern ? { pattern } : {}) },
});

const ACTUALIZADO =
  'Hasta cuándo está al día la fuente que respondió: el instante en que llegó su último dato (ISO 8601), o la fecha o el periodo de ese dato (AAAA-MM-DD, AAAA-MM o AAAA) cuando la fuente no registra la hora.';

const pageOf = (
  row: Record<string, unknown>,
  actualizado: string,
  extraHeaders: Record<string, unknown> = {},
) => ({
  description: 'Una página de filas.',
  headers: {
    ...quotaHeaders,
    'X-Siguiente': {
      description: 'Solo en CSV: el cursor de la página siguiente; falta en la última.',
      schema: { type: 'string' },
    },
    ...extraHeaders,
  },
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['data', 'siguiente', 'fuente', 'actualizado'],
        properties: {
          data: { type: 'array', items: row },
          siguiente: { type: ['string', 'null'], description: 'Cursor de la página siguiente; null en la última.' },
          fuente: { type: 'string', description: 'Quién publica las cifras.' },
          actualizado: { type: ['string', 'null'], description: `${ACTUALIZADO} ${actualizado}` },
        },
      },
    },
    'text/csv': { schema: { type: 'string' } },
  },
});

const nullable = (type: string, description?: string) => ({
  type: [type, 'null'],
  ...(description ? { description } : {}),
});

/* ---------------------------------------------------------------- documento */

const DOCUMENT = {
  openapi: '3.1.0',
  info: {
    title: 'API de DatosBolivia.com',
    version: '1.0.0',
    description: `Series (tipo de cambio, UFV, mercados, anuales de Bolivia, Banco Mundial y Banco Central), lugares, prensa, directorio de empresas y base aduanera, en JSON o CSV. Cada consulta respondida cuenta una vez contra el cupo mensual del plan, sea cual sea el tamaño de la página. Todas las rutas admiten CORS (GET y OPTIONS desde cualquier origen). Documentación: https://datosbolivia.com/servicios/api`,
  },
  servers: [{ url: 'https://datosbolivia.com' }],
  security: [{ llave: [] }],
  paths: {
    '/api/v1/uso': {
      get: {
        summary: 'Plan, cupo y consultas usadas por la llave',
        description: 'Esta consulta también cuenta, y la cifra que devuelve ya la incluye.',
        responses: {
          '200': {
            description: 'El uso del mes.',
            headers: quotaHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data', 'siguiente', 'fuente', 'actualizado'],
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        plan: { type: 'string', enum: conApi.map((plan) => plan.code) },
                        nombre: { type: 'string' },
                        estado: { type: 'string', description: 'El estado de la cuenta, p. ej. ACTIVE o TRIAL.' },
                        pagado_hasta: nullable('string'),
                        cupo_mensual: { type: 'integer' },
                        usadas: { type: 'integer', description: 'Consultas del mes, contando esta.' },
                        restantes: { type: 'integer', minimum: 0 },
                        reinicio: { type: 'string', format: 'date' },
                        por_minuto: { type: 'integer', description: 'Consultas por minuto que admite el plan.' },
                        lugares_por_consulta: nullable(
                          'integer',
                          'Lugares que da como máximo una consulta a /api/v1/lugares; null es sin tope.',
                        ),
                      },
                    },
                    siguiente: { type: 'null' },
                    fuente: { type: 'string' },
                    actualizado: { type: 'string', format: 'date-time', description: 'El momento de la respuesta.' },
                  },
                },
              },
            },
          },
          ...errors,
        },
      },
    },
    '/api/v1/series': {
      get: {
        summary: 'Catálogo de series',
        description:
          'Sin `fuente`: las series diarias (tipo de cambio oficial y paralelo, paralelo por ficha estable, UFV, mercados), las anuales de Bolivia y el panel del Banco Mundial, en ese orden. Con `fuente=bcb`: las estadísticas del Banco Central. El tipo de cambio oficial va como una sola serie (`diario.FX_OFFICIAL_USD_BOB`, la línea del tablero) y por lado.',
        parameters: [
          {
            name: 'fuente',
            in: 'query',
            schema: { type: 'string', enum: [...SERIES_SOURCES] },
          },
          text('buscar', 'Palabras que tienen que aparecer en el código o el nombre (en bcb: en el nombre, la hoja o el informe).'),
          text('familia', 'Solo junto con fuente=bcb (si no, 400): la familia de cuadros del Banco Central.'),
          ...paging,
        ],
        responses: {
          '200': pageOf(
            { $ref: '#/components/schemas/Serie' },
            'Sin fuente o con diario: cuándo llegó la última lectura diaria. Con macro o panel: el último periodo publicado. Con bcb: cuándo llegó la última lectura del catálogo del Banco Central.',
          ),
          ...badRequest,
          ...errors,
        },
      },
    },
    '/api/v1/series/{codigo}': {
      get: {
        summary: 'Observaciones de una serie',
        description: 'De la más vieja a la más nueva. Un código que no está en el catálogo es un 400.',
        parameters: [
          {
            name: 'codigo',
            in: 'path',
            required: true,
            description:
              'El código del catálogo, p. ej. `diario.FX_OFFICIAL_USD_BOB` o `diario.FX_PARALLEL_USD_BOB:SELL` (los dos puntos pueden ir como `%3A`).',
            schema: { type: 'string', maxLength: 200 },
          },
          {
            name: 'desde',
            in: 'query',
            description: 'AAAA, AAAA-MM o AAAA-MM-DD, inclusive.',
            schema: { type: 'string', pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$' },
          },
          {
            name: 'hasta',
            in: 'query',
            description: 'AAAA, AAAA-MM o AAAA-MM-DD, inclusive: hasta=2024 incluye el 31 de diciembre.',
            schema: { type: 'string', pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$' },
          },
          ...paging,
        ],
        responses: {
          '200': pageOf(
            { $ref: '#/components/schemas/Observacion' },
            'Diarias: el último día de la serie. Anuales y panel: su último periodo. Banco Central: cuándo llegó la última lectura de la serie.',
          ),
          ...badRequest,
          ...errors,
        },
      },
    },
    '/api/v1/lugares': {
      get: {
        summary: 'Lugares por ciudad y familia',
        description: `Ordenados por ciudad, familia y nombre. El plan fija cuántos lugares da una misma consulta, también recorrida por cursor (${topes}). La página que llega a ese tope trae \`siguiente\` en null, y toda página de una consulta recortada lleva el encabezado \`X-Tope-Lugares\`. Una consulta lee como máximo ${miles(EXPORT_PLACE_LIMIT)} lugares; si pasa de ahí y el plan no la recortó antes, toda página lleva \`X-Lectura-Truncada\` y conviene pedir menos ciudades o familias por consulta.`,
        parameters: [
          { ...list('ciudad', 'Obligatorio. La ciudad, como la escribe el mapa.', 12), required: true },
          list('familia', 'Las familias de lugares; sin ella, todas.', 60),
          ...paging,
        ],
        responses: {
          '200': pageOf({ $ref: '#/components/schemas/Lugar' }, 'Siempre null: el catálogo de lugares no registra cuándo se cargó cada lugar.', {
            'X-Tope-Lugares': {
              description:
                'Solo cuando el plan recortó la consulta: cuántos lugares da como máximo. Faltan lugares que el plan no entrega.',
              schema: { type: 'integer' },
            },
            'X-Lectura-Truncada': {
              description: `Solo cuando la consulta pasó de los ${miles(EXPORT_PLACE_LIMIT)} lugares que lee como máximo y el plan no la recortó antes: ese techo. Faltan lugares; pedir menos ciudades o familias por consulta.`,
              schema: { type: 'integer' },
            },
          }),
          ...badRequest,
          ...errors,
        },
      },
    },
    '/api/v1/prensa': {
      get: {
        summary: 'Notas del archivo de prensa',
        description:
          'De la más nueva a la más vieja. Como la lectura no cuenta el total, una página llena trae `siguiente` aunque la próxima resulte vacía.',
        parameters: [
          list('anio', 'Años de cuatro cifras.', 50),
          list('tono', 'Tonos, como en el panel de Prensa.', 50),
          list('tema', 'Temas.', 50),
          list('region', 'Regiones.', 50),
          list('medio', 'Medios.', 50),
          list('termino', 'Términos vigilados.', 50),
          text('buscar', 'Texto que tiene que aparecer en el titular o la entradilla.'),
          ...paging,
        ],
        responses: {
          '200': pageOf(
            {
              type: 'object',
              properties: {
                fecha: { type: 'string', format: 'date' },
                medio: { type: 'string' },
                seccion: { type: 'string' },
                tema: { type: 'string' },
                tono: { type: 'string' },
                region: { type: 'string' },
                titular: { type: 'string' },
                entradilla: nullable('string'),
                enlace: { type: 'string' },
                obtencion: nullable('string'),
                evidencia_sha256: nullable('string'),
              },
            },
            'La publicación de la nota más reciente del archivo entero, no de la página.',
          ),
          ...badRequest,
          ...errors,
        },
      },
    },
    '/api/v1/empresas': {
      get: {
        summary: 'Directorio de empresas (subconjunto público del SEPREC)',
        description: 'Ordenado por departamento, municipio, nombre y registro.',
        parameters: [
          text('departamento', 'Un departamento, como aparece en la tabla de Empresas.', 100),
          text('municipio', 'Un municipio.', 100),
          text('buscar', 'Texto en el nombre.', 100),
          ...paging,
        ],
        responses: {
          '200': pageOf(
            {
              type: 'object',
              properties: {
                registro: { type: 'string' },
                nombre: { type: 'string' },
                departamento: nullable('string'),
                municipio: nullable('string'),
                direccion: nullable('string'),
                actividad: nullable('string'),
                licencia: nullable('string'),
                fecha_de_corte: nullable('string', 'Fecha u hora (ISO 8601) del corte del registro.'),
              },
            },
            'La fecha de corte del registro.',
          ),
          ...badRequest,
          ...errors,
        },
      },
    },
    '/api/v1/aduana': {
      get: {
        summary: 'Base aduanera del INE sumada por una dimensión',
        description:
          'Como en el panel, el filtro de la misma dimensión no recorta su propio desglose. Una combinación que el INE no publica vuelve como 400 con el motivo. Hasta 5.000 filas por consulta.',
        parameters: [
          {
            name: 'por',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: [...DIMENSIONS] },
          },
          { name: 'flujo', in: 'query', description: 'X exportaciones, M importaciones.', schema: { type: 'string', enum: ['X', 'M'], default: 'X' } },
          { name: 'desde', in: 'query', description: 'Año inicial, inclusive.', schema: { type: 'integer', minimum: 1990, maximum: 2100 } },
          { name: 'hasta', in: 'query', description: 'Año final, inclusive; no anterior a desde.', schema: { type: 'integer', minimum: 1990, maximum: 2100 } },
          {
            name: 'meses',
            in: 'query',
            description: 'Tramo de meses de cada año, p. ej. 1-7 para comparar enero a julio.',
            schema: { type: 'string', pattern: '^\\d{1,2}-\\d{1,2}$' },
          },
          list('producto', 'Códigos NANDINA de 2 a 10 dígitos.', 40, '^\\d{2,10}(,\\d{2,10})*$'),
          list('seccion', 'Secciones del arancel (1 o 2 dígitos).', 40),
          list('pais', 'Códigos de país del INE (hasta 4 dígitos).', 40),
          list('departamento', 'Códigos de departamento del INE (1 o 2 dígitos).', 40),
          list('actividad', 'Códigos de actividad del INE.', 40),
          list('tradicional', 'Códigos de producto tradicional.', 40),
          list('uso', 'Códigos de uso o destino económico.', 40),
          list('tipo', 'Tipo de exportación: 1, 2 o 3.', 40),
          ...paging,
        ],
        responses: {
          '200': pageOf(
            {
              type: 'object',
              properties: {
                codigo: nullable('string'),
                nombre: { type: 'string' },
                usd: { type: 'number' },
                kg: { type: 'number' },
                kg_finos: nullable('number'),
                usd_ultimo_anio: nullable('number'),
                usd_anio_anterior: nullable('number'),
              },
            },
            'El último mes que tiene la base para el flujo pedido (AAAA-MM).',
          ),
          ...badRequest,
          ...errors,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      llave: {
        type: 'http',
        scheme: 'bearer',
        description: 'La llave de la cuenta: `Authorization: Bearer obs_live_…`. Se crea en /cuenta.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', description: 'Qué pasó y qué hacer.' },
          parametro: { type: 'string', description: 'Solo en 400: el parámetro que no se aceptó.' },
          planes: { type: 'string', description: 'En 402 y en el 429 del cupo mensual: la página de los planes.' },
        },
      },
      Serie: {
        type: 'object',
        properties: {
          codigo: { type: 'string' },
          nombre: { type: 'string' },
          fuente: { type: 'string', enum: [...SERIES_SOURCES] },
          rubro: nullable('string'),
          informe: { type: 'string', description: 'Solo bcb: el informe del Banco Central.' },
          hoja: { type: 'string', description: 'Solo bcb: la hoja del informe.' },
          unidad: nullable('string'),
          frecuencia: { type: 'string' },
          desde: nullable('string'),
          hasta: nullable('string'),
          observaciones: { type: 'integer' },
          editor: nullable('string'),
        },
      },
      Observacion: {
        type: 'object',
        description: 'Las diarias traen `fecha`; las anuales, las del panel y las del Banco Central, `periodo`.',
        properties: {
          fecha: { type: 'string', format: 'date', description: 'Diarias.' },
          periodo: { type: 'string', description: 'Anuales, panel y Banco Central.' },
          valor: { type: 'number' },
          unidad: nullable('string'),
          lado: nullable('string', 'Diarias: OFFICIAL, BUY o SELL; null si la serie no tiene lado.'),
          agregacion: { type: 'string', enum: ['POINT_IN_TIME', 'DAILY_AVERAGE'], description: 'Diarias.' },
          dispersion: nullable('number', 'Diarias: diferencia entre plazas.'),
          plazas: nullable('integer', 'Diarias: plazas que cotizaron.'),
          valor_anterior: nullable('number', 'Anuales y panel.'),
          variacion_pct: nullable('number'),
        },
      },
      Lugar: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ciudad: { type: 'string' },
          nombre: { type: 'string' },
          grupo: { type: 'string' },
          familia: { type: 'string' },
          barrio: nullable('string'),
          direccion: nullable('string'),
          marca: nullable('string'),
          latitud: { type: 'number' },
          longitud: { type: 'number' },
          actividad_regulada: { type: 'boolean' },
          registro_que_lo_confirmaria: nullable('string'),
          confianza: nullable('number'),
          grado_de_calidad: nullable('string'),
          metodo_de_ubicacion: nullable('string'),
        },
      },
    },
  },
} as const;

export function GET(): Response {
  return Response.json(DOCUMENT, {
    headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=3600' },
  });
}
