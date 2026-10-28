/**
 * Los planes de DatosBolivia.com y el tope de quien no tiene uno.
 *
 * Leer el tablero es gratis y lo sigue siendo. Lo que se cobra es el volumen:
 * descargar una base entera, consultarla por API, preguntarle mucho al chat.
 * Precios y cupos viven aquí y en ningún otro sitio, así que la página de
 * Servicios, las rutas de descarga y el chat no pueden contar cifras distintas.
 *
 * Puro —ni servidor ni navegador— para usarlo en los dos lados y probarlo con
 * `node --test`. El plan completo, con las decisiones que llevaron a estas
 * cifras, está en `docs/plan-monetizacion-2026-10-27.md`.
 */

export type PlanCode = 'gratis' | 'analista' | 'profesional' | 'institucional';

/** Lo que alguien puede pedir desde el formulario de Servicios. */
export type InquiryPlan = Exclude<PlanCode, 'gratis'> | 'a-medida';

export interface Plan {
  code: PlanCode;
  nombre: string;
  /** Bolivianos por mes; `null` es «se cotiza». */
  mensual: number | null;
  /** Bolivianos por año: diez meses, dos de regalo. */
  anual: number | null;
  /** «desde» delante del precio: el institucional se arma a medida. */
  desde?: boolean;
  resumen: string;
  usuarios: number;
  llaves: number;
  /** Consultas a `/api/v1` por mes. */
  apiPorMes: number;
  apiPorMinuto: number;
  /** Filas por archivo; `null` es sin tope. */
  filasPorArchivo: number | null;
  /** Lugares por descarga del mapa; `null` es completo. */
  lugaresPorDescarga: number | null;
  chatPorDia: number;
  incluye: readonly string[];
}

/** Filas que se llevan por archivo sin un plan: alcanzan para ver la forma, no para copiar la base. */
export const FREE_ROW_CAP = 500;

/** Preguntas al chat por día y por dirección, sin un plan. */
export const FREE_CHAT_PER_DAY = 10;

/** Pedidos al mapa de lugares por hora y por dirección, sin un plan. */
export const FREE_MAP_PER_HOUR = 120;

/**
 * Lugares que el mapa sirve por hora y por dirección, sin un plan: unas cinco
 * vistas llenas. Ciento veinte vistas de cuatro mil eran casi siete veces la
 * base entera; con este techo recorrerla toma más de tres horas a una misma
 * conexión, y una persona mirando ciudades no lo toca.
 */
export const FREE_MAP_PLACES_PER_HOUR = 20_000;

/** Lugares que el mapa dibuja por vista. Pasado eso un dibujo es una mancha. */
export const MAP_VIEW_CAP = 4_000;

export const SERVICES_PATH = '/servicios';

export const PLANS: readonly Plan[] = [
  {
    code: 'gratis',
    nombre: 'Gratis',
    mensual: 0,
    anual: 0,
    resumen: 'Todo el tablero, para leerlo y citarlo.',
    usuarios: 1,
    llaves: 0,
    apiPorMes: 0,
    apiPorMinuto: 0,
    filasPorArchivo: FREE_ROW_CAP,
    lugaresPorDescarga: FREE_ROW_CAP,
    chatPorDia: FREE_CHAT_PER_DAY,
    incluye: [
      'Todas las páginas, gráficos y mapas',
      'Imágenes de los gráficos (PNG y SVG)',
      `Descargas de hasta ${FREE_ROW_CAP} filas por archivo`,
      `${FREE_CHAT_PER_DAY} preguntas al asistente por día`,
    ],
  },
  {
    code: 'analista',
    nombre: 'Analista',
    mensual: 350,
    anual: 3_500,
    resumen: 'Para una persona que trabaja con los datos todos los días.',
    usuarios: 1,
    llaves: 1,
    apiPorMes: 10_000,
    apiPorMinuto: 60,
    filasPorArchivo: null,
    lugaresPorDescarga: 5_000,
    chatPorDia: 100,
    incluye: [
      'Descargas completas de todas las series y tablas',
      'Mapa de lugares: hasta 5.000 por descarga',
      'API: 10.000 consultas al mes',
      '100 preguntas al asistente por día',
      '10 vistas guardadas',
      'Soporte por correo',
    ],
  },
  {
    code: 'profesional',
    nombre: 'Profesional',
    mensual: 1_400,
    anual: 14_000,
    resumen: 'Para un equipo que arma reportes con la base.',
    usuarios: 3,
    llaves: 3,
    apiPorMes: 100_000,
    apiPorMinuto: 300,
    filasPorArchivo: null,
    lugaresPorDescarga: null,
    chatPorDia: 300,
    incluye: [
      'Todo lo de Analista, para 3 usuarios',
      'Mapa de lugares completo, todas las ciudades',
      'API: 100.000 consultas al mes',
      '300 preguntas al asistente por día',
      'Un informe mensual automático en Excel',
      'Soporte en 2 días hábiles',
    ],
  },
  {
    code: 'institucional',
    nombre: 'Institucional',
    mensual: 5_000,
    anual: null,
    desde: true,
    resumen: 'Bancos, gremios, ministerios y consultoras: reportería a medida.',
    usuarios: 10,
    llaves: 10,
    apiPorMes: 1_000_000,
    apiPorMinuto: 1_000,
    filasPorArchivo: null,
    lugaresPorDescarga: null,
    chatPorDia: 1_000,
    incluye: [
      'Todo lo de Profesional, hasta 10 usuarios',
      'API: 1.000.000 de consultas al mes, o a medida',
      'Un informe a pedido al mes',
      'Informes periódicos semanales',
      'Volcado completo mensual de la base',
      'Soporte prioritario con acuerdo de servicio',
    ],
  },
];

export const INQUIRY_PLANS: readonly { code: InquiryPlan; nombre: string }[] = [
  { code: 'analista', nombre: 'Analista' },
  { code: 'profesional', nombre: 'Profesional' },
  { code: 'institucional', nombre: 'Institucional' },
  { code: 'a-medida', nombre: 'Un informe o un estudio a medida' },
];

/**
 * Cuántas personas puede sumar la persona titular a su cuenta: los usuarios
 * del plan menos uno, porque la titular ya es uno de ellos.
 */
export function membersAllowed(plan: Pick<Plan, 'usuarios'>): number {
  return Math.max(0, plan.usuarios - 1);
}

export function isInquiryPlan(value: unknown): value is InquiryPlan {
  return INQUIRY_PLANS.some((plan) => plan.code === value);
}

/**
 * «14.000», de tres en tres. A mano y no con `Intl`: el español agrupa solo
 * desde cinco cifras, y «1400» al lado de «14.000» se lee como un error.
 */
export function miles(valor: number): string {
  return String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/gu, '.');
}

/** «Bs 1.400», como se escribe en Bolivia. */
export function bolivianos(monto: number): string {
  return `Bs ${miles(monto)}`;
}

export interface FreeCut<T> {
  filas: T[];
  total: number;
  recortado: boolean;
}

/**
 * Las filas que se lleva quien no tiene plan.
 *
 * Una serie de tiempo ordenada de lo viejo a lo nuevo se corta por la cola: las
 * quinientas filas más recientes sirven para algo, las quinientas de 2004 no.
 * Una tabla ordenada por importancia se corta por la cabeza. Quien llama sabe
 * cuál de las dos tiene.
 */
export function freeCut<T>(
  filas: readonly T[],
  orden: 'cabeza' | 'cola' = 'cabeza',
  tope: number = FREE_ROW_CAP,
): FreeCut<T> {
  if (filas.length <= tope) return { filas: [...filas], total: filas.length, recortado: false };
  return {
    filas: orden === 'cola' ? filas.slice(filas.length - tope) : filas.slice(0, tope),
    total: filas.length,
    recortado: true,
  };
}

/** Si la primera columna es una fecha o un periodo («2024», «2024-07-01»). */
function esFechada(valor: unknown): boolean {
  return typeof valor === 'string' ? /^\d{4}(\b|-)/u.test(valor) : typeof valor === 'number' && valor >= 1900 && valor <= 2100;
}

/**
 * Por dónde cortar una tabla que llega sin decirlo: las que empiezan con una
 * fecha ascendente se cortan por la cola, todas las demás por la cabeza.
 */
export function cutOrder(filas: ReadonlyArray<ReadonlyArray<unknown>>): 'cabeza' | 'cola' {
  const primera = filas[0]?.[0];
  const ultima = filas[filas.length - 1]?.[0];
  if (!esFechada(primera) || !esFechada(ultima)) return 'cabeza';
  return String(primera) < String(ultima) ? 'cola' : 'cabeza';
}

/** La frase que acompaña a un archivo recortado, en el archivo mismo. */
export function freeCutNote(total: number, tope: number = FREE_ROW_CAP): string {
  return `Archivo recortado: ${miles(tope)} de ${miles(total)} filas. La descarga completa es parte de los planes de DatosBolivia.com: datosbolivia.com${SERVICES_PATH}`;
}
