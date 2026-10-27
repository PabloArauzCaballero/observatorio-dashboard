import { CORS_HEADERS } from '@/lib/api-v1/auth';

/**
 * El contrato de `/api/v1` en OpenAPI 3.1, escrito a mano.
 *
 * Público y sin llave: describir la API no es usarla. Lo que dice aquí es lo
 * que las rutas hacen hoy; una ruta que no está aquí no es parte del contrato.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const quotaHeaders = {
  'X-Cupo-Limite': {
    description: 'Consultas por mes del plan de la llave.',
    schema: { type: 'integer' },
  },
  'X-Cupo-Restante': {
    description: 'Consultas que quedan este mes, contando la actual.',
    schema: { type: 'integer' },
  },
  'X-Cupo-Reinicio': {
    description: 'Día en que el cupo vuelve a cero (primer día del mes siguiente, UTC).',
    schema: { type: 'string', format: 'date' },
  },
};

const error = (description: string) => ({
  description,
  headers: quotaHeaders,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const errors = {
  '400': error('Un parámetro no es válido.'),
  '401': error('Falta la llave, no tiene la forma obs_live_… o fue revocada.'),
  '402': error('El plan de la llave no está vigente o no incluye la API.'),
  '429': {
    ...error('Se agotó el cupo del mes o se pasó de 60 consultas por minuto.'),
    headers: { ...quotaHeaders, 'Retry-After': { schema: { type: 'integer' }, description: 'Segundos de espera.' } },
  },
  '503': error('El servicio de cuentas o la base no respondieron.'),
};

const page = {
  pageSize: {
    name: 'pageSize',
    in: 'query',
    description: 'Filas por página, de 1 a 5000.',
    schema: { type: 'integer', minimum: 1, maximum: 5000, default: 1000 },
  },
  cursor: {
    name: 'cursor',
    in: 'query',
    description: 'El valor de `siguiente` de la página anterior.',
    schema: { type: 'string' },
  },
  formato: {
    name: 'formato',
    in: 'query',
    description: '`csv` devuelve la página en CSV (UTF-8 con BOM); el cursor de la siguiente va en el encabezado `X-Siguiente`.',
    schema: { type: 'string', enum: ['json', 'csv'], default: 'json' },
  },
};

const pageOf = (row: Record<string, unknown>) => ({
  description: 'Una página de filas.',
  headers: quotaHeaders,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['data', 'siguiente', 'fuente', 'actualizado'],
        properties: {
          data: { type: 'array', items: row },
          siguiente: { type: ['string', 'null'], description: 'Cursor de la página siguiente; null en la última.' },
          fuente: { type: 'string' },
          actualizado: { type: ['string', 'null'] },
        },
      },
    },
    'text/csv': { schema: { type: 'string' } },
  },
});

const DOCUMENT = {
  openapi: '3.1.0',
  info: {
    title: 'API de DatosBolivia.com',
    version: '1.0.0',
    description:
      'Las series, los lugares y el cupo de la propia llave. Cada consulta cuenta una vez contra el cupo mensual del plan. Documentación: https://datosbolivia.com/servicios/api',
  },
  servers: [{ url: 'https://datosbolivia.com' }],
  security: [{ llave: [] }],
  paths: {
    '/api/v1/uso': {
      get: {
        summary: 'Plan, cupo y consultas usadas por la llave',
        responses: {
          '200': {
            description: 'El uso del mes. Esta consulta ya está contada.',
            headers: quotaHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        plan: { type: 'string', enum: ['analista', 'profesional', 'institucional'] },
                        nombre: { type: 'string' },
                        estado: { type: 'string' },
                        pagado_hasta: { type: ['string', 'null'] },
                        cupo_mensual: { type: 'integer' },
                        usadas: { type: 'integer' },
                        restantes: { type: 'integer' },
                        reinicio: { type: 'string', format: 'date' },
                      },
                    },
                    siguiente: { type: 'null' },
                    fuente: { type: 'string' },
                    actualizado: { type: 'string' },
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
          'Sin `fuente`: las series diarias (dólar oficial y paralelo, UFV), las anuales de Bolivia y el panel del Banco Mundial. Con `fuente=bcb`: las estadísticas del Banco Central, de a 40 por página.',
        parameters: [
          {
            name: 'fuente',
            in: 'query',
            schema: { type: 'string', enum: ['diario', 'macro', 'panel', 'bcb'] },
          },
          { name: 'buscar', in: 'query', description: 'Palabras en el código o el nombre.', schema: { type: 'string' } },
          { name: 'familia', in: 'query', description: 'Solo con fuente=bcb: la familia de cuadros.', schema: { type: 'string' } },
          page.pageSize,
          page.cursor,
          page.formato,
        ],
        responses: { '200': pageOf({ $ref: '#/components/schemas/Serie' }), ...errors },
      },
    },
    '/api/v1/series/{codigo}': {
      get: {
        summary: 'Observaciones de una serie',
        parameters: [
          {
            name: 'codigo',
            in: 'path',
            required: true,
            description: 'El código del catálogo, p. ej. `diario.FX_OFFICIAL_USD_BOB`.',
            schema: { type: 'string' },
          },
          { name: 'desde', in: 'query', description: 'AAAA, AAAA-MM o AAAA-MM-DD, inclusive.', schema: { type: 'string' } },
          { name: 'hasta', in: 'query', description: 'AAAA, AAAA-MM o AAAA-MM-DD, inclusive.', schema: { type: 'string' } },
          page.pageSize,
          page.cursor,
          page.formato,
        ],
        responses: {
          '200': pageOf({
            type: 'object',
            properties: {
              fecha: { type: 'string', description: 'Series diarias.' },
              periodo: { type: 'string', description: 'Series anuales y del BCB.' },
              valor: { type: 'number' },
              unidad: { type: ['string', 'null'] },
            },
            additionalProperties: true,
          }),
          ...errors,
        },
      },
    },
    '/api/v1/lugares': {
      get: {
        summary: 'Lugares por ciudad y familia',
        parameters: [
          {
            name: 'ciudad',
            in: 'query',
            required: true,
            description: 'Una o varias, separadas por coma (hasta 12).',
            schema: { type: 'string' },
          },
          { name: 'familia', in: 'query', description: 'Una o varias, separadas por coma.', schema: { type: 'string' } },
          page.pageSize,
          page.cursor,
          page.formato,
        ],
        responses: { '200': pageOf({ $ref: '#/components/schemas/Lugar' }), ...errors },
      },
    },
    '/api/v1/prensa': {
      get: {
        summary: 'Notas del archivo de prensa',
        description: 'De la más nueva a la más vieja. Cada filtro acepta varios valores separados por coma.',
        parameters: [
          { name: 'anio', in: 'query', schema: { type: 'string' } },
          { name: 'tono', in: 'query', schema: { type: 'string' } },
          { name: 'tema', in: 'query', schema: { type: 'string' } },
          { name: 'region', in: 'query', schema: { type: 'string' } },
          { name: 'medio', in: 'query', schema: { type: 'string' } },
          { name: 'termino', in: 'query', schema: { type: 'string' } },
          { name: 'buscar', in: 'query', description: 'Texto que tiene que aparecer en la nota.', schema: { type: 'string' } },
          page.pageSize,
          page.cursor,
          page.formato,
        ],
        responses: {
          '200': pageOf({
            type: 'object',
            properties: {
              fecha: { type: 'string', format: 'date' },
              medio: { type: 'string' },
              seccion: { type: 'string' },
              tema: { type: 'string' },
              tono: { type: 'string' },
              region: { type: 'string' },
              titular: { type: 'string' },
              entradilla: { type: ['string', 'null'] },
              enlace: { type: 'string' },
              obtencion: { type: ['string', 'null'] },
              evidencia_sha256: { type: ['string', 'null'] },
            },
          }),
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
        properties: { error: { type: 'string' }, planes: { type: 'string' } },
      },
      Serie: {
        type: 'object',
        properties: {
          codigo: { type: 'string' },
          nombre: { type: 'string' },
          fuente: { type: 'string', enum: ['diario', 'macro', 'panel', 'bcb'] },
          rubro: { type: ['string', 'null'] },
          unidad: { type: ['string', 'null'] },
          frecuencia: { type: 'string' },
          desde: { type: ['string', 'null'] },
          hasta: { type: ['string', 'null'] },
          observaciones: { type: 'integer' },
          editor: { type: ['string', 'null'] },
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
          barrio: { type: ['string', 'null'] },
          direccion: { type: ['string', 'null'] },
          marca: { type: ['string', 'null'] },
          latitud: { type: 'number' },
          longitud: { type: 'number' },
          actividad_regulada: { type: 'boolean' },
          registro_que_lo_confirmaria: { type: ['string', 'null'] },
          confianza: { type: ['number', 'null'] },
          grado_de_calidad: { type: ['string', 'null'] },
          metodo_de_ubicacion: { type: ['string', 'null'] },
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
