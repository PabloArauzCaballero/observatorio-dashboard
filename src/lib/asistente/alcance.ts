/**
 * Qué pregunta es, y qué datos hacen falta para contestarla.
 *
 * El asistente no responde de memoria: cada respuesta se arma con los
 * «paquetes» que el propio tablero calcula. Este módulo decide cuáles. Primero
 * por palabras, que es gratis y no se equivoca con «dólar» ni con «Santa Cruz»;
 * solo lo que las palabras no alcanzan pasa por el clasificador del modelo.
 *
 * Es puro a propósito —sin base, sin red, sin importaciones— para que sus
 * reglas se prueben con `node --test` sin levantar nada.
 */

export const PAQUETES = [
  'HOY',
  'DOLAR',
  'MACRO',
  'DEPTO',
  'DEPTOS',
  'POLITICA',
  'PRENSA',
  'ENERGIA',
  'RECURSOS',
  'AMBIENTE',
  'COMERCIO',
  'EMPRESAS',
  'EXOGENAS',
  'MERCADOS',
  'MUNDO',
  'CARRETERAS',
  'CIUDADES',
  'METODO',
  'GUIA',
] as const;

export type PaqueteId = (typeof PAQUETES)[number];

/**
 * Qué clase de respuesta pide la pregunta.
 *
 * `ASESORIA` y `OPINION` no cambian qué datos se leen sino cómo se contesta: la
 * primera no recibe una recomendación personal y la segunda no recibe una
 * postura partidaria. `FUERA` recibe una respuesta fija, sin modelo.
 */
export type Tipo = 'DATOS' | 'ASESORIA' | 'OPINION' | 'GUIA' | 'FUERA';

export interface Clasificacion {
  tipo: Tipo;
  paquetes: PaqueteId[];
  departamento: string | null;
  /** Un término para buscar en el archivo de prensa, si la pregunta nombra uno. */
  busqueda: string | null;
}

/** Lo que el clasificador del modelo ve de cada paquete. */
export const DESCRIPCION_PAQUETE: Record<PaqueteId, string> = {
  HOY: 'panorama general de Bolivia hoy: cuadro de mando con inflación, reservas, crecimiento, deuda, instituciones y novedades del día',
  DOLAR: 'dólar oficial y paralelo, brecha cambiaria, stablecoins USDT/USDC en bolivianos, UFV e inflación diaria implícita',
  MACRO: 'indicadores macro anuales de Bolivia: PIB, inflación, reservas, deuda, fiscal, empleo, pobreza, salud, educación, sector externo',
  DEPTO: 'un departamento concreto: su PIB, crecimiento, actividades, exportaciones, carreteras y noticias de su región',
  DEPTOS: 'comparación entre los nueve departamentos',
  POLITICA: 'situación política e institucional: libertad, democracia, corrupción, estado de derecho y noticias políticas y de conflicto',
  PRENSA: 'noticias recientes del archivo de prensa, por tema y tono',
  ENERGIA: 'matriz energética, gas, electricidad, combustibles',
  RECURSOS: 'recursos naturales: minería, litio, gas, rentas del subsuelo, exportaciones de materias primas',
  AMBIENTE: 'medio ambiente: bosques, deforestación, emisiones, aire, agua',
  COMERCIO: 'comercio exterior: socios, productos exportados, principales empresas exportadoras',
  EMPRESAS: 'empresas: hechos relevantes de la Bolsa Boliviana de Valores y reputación corporativa (Merco)',
  EXOGENAS: 'precios internacionales que afectan a Bolivia: petróleo, gas, metales, granos, fertilizantes',
  MERCADOS: 'bitcoin, USDT y oro en dólares',
  MUNDO: 'Bolivia comparada con sus vecinos y con el mundo',
  CARRETERAS: 'red vial: kilómetros, pavimento, rutas por departamento',
  CIUDADES: 'lugares y negocios mapeados por ciudad (comercios, restaurantes, farmacias, etc.)',
  METODO: 'de dónde salen los datos, fuentes y cada cuánto se actualizan',
  GUIA: 'cómo usar el tablero: pestañas, filtros, descargas, informes PDF',
};

export const DEPARTAMENTOS: ReadonlyArray<{ slug: string; nombre: string; alias: readonly string[] }> = [
  { slug: 'SANTA_CRUZ', nombre: 'Santa Cruz', alias: ['santa cruz', 'scz', 'cruceno', 'cruceña', 'crucena', 'cruceños', 'crucenos'] },
  { slug: 'LA_PAZ', nombre: 'La Paz', alias: ['la paz', 'paceno', 'pacena', 'pacenos', 'el alto', 'lpz'] },
  { slug: 'COCHABAMBA', nombre: 'Cochabamba', alias: ['cochabamba', 'cocha', 'cochala', 'cochalo', 'cbba'] },
  { slug: 'ORURO', nombre: 'Oruro', alias: ['oruro', 'orureno', 'orurena'] },
  { slug: 'POTOSI', nombre: 'Potosí', alias: ['potosi', 'potosino', 'potosina'] },
  { slug: 'TARIJA', nombre: 'Tarija', alias: ['tarija', 'chapaco', 'chapaca', 'tarijeno', 'tarijena'] },
  { slug: 'CHUQUISACA', nombre: 'Chuquisaca', alias: ['chuquisaca', 'sucre', 'chuquisaqueno'] },
  { slug: 'BENI', nombre: 'Beni', alias: ['beni', 'trinidad', 'beniano', 'beniana', 'riberalta'] },
  { slug: 'PANDO', nombre: 'Pando', alias: ['pando', 'cobija', 'pandino'] },
];

const SLUGS = new Set(DEPARTAMENTOS.map((d) => d.slug));

/** Minúsculas y sin tildes: «Potosí», «POTOSI» y «potosi» son la misma palabra. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Coincide por palabra entera, para que «beni» no salga de «beneficio». */
function tiene(texto: string, patron: RegExp): boolean {
  return patron.test(texto);
}

/**
 * Raíces que empiezan palabra. Una raíz que termina en `$` tiene que ser la
 * palabra entera: «gas$» no puede salir de «gastos» ni «oro$» de «Orobó».
 */
const palabra = (raices: readonly string[]): RegExp =>
  new RegExp(
    `(?:^|[^a-z0-9])(?:${raices.map((r) => (r.endsWith('$') ? `${r.slice(0, -1)}(?![a-z0-9])` : r)).join('|')})`,
    'i',
  );

const palabraExacta = (palabras: readonly string[]): RegExp =>
  new RegExp(`(?:^|[^a-z0-9])(?:${palabras.join('|')})(?:$|[^a-z0-9])`, 'i');

export function detectarDepartamento(texto: string): string | null {
  const t = normalizar(texto);
  for (const d of DEPARTAMENTOS) {
    if (tiene(t, palabraExacta(d.alias.map((a) => normalizar(a).replace(/ /g, '\\s+'))))) return d.slug;
  }
  return null;
}

/*
 * Las reglas de palabras. Cada una suma paquetes; el orden no importa. Las
 * raíces van sin tildes porque el texto ya llega normalizado, y cortas a
 * propósito («inflaci» atrapa inflación e inflacionario) para aguantar faltas.
 */
const REGLAS: ReadonlyArray<{ patron: RegExp; paquetes: readonly PaqueteId[] }> = [
  { patron: palabra(['dolar', 'dollar', 'paralelo', 'tipo de cambio', 'brecha', 'divisa', 'usdt', 'usdc', 'stablecoin', 'binance', 'p2p$', 'verdes?$', 'cotiza', 'tasa de cambio', 'casas? de cambio', 'cambista']), paquetes: ['DOLAR'] },
  { patron: palabra(['inflaci', 'ufv$', 'precios? sub', 'canasta', 'carestia', 'costo de vida', 'suben los precios', 'todo sube', 'todo esta caro']), paquetes: ['DOLAR', 'MACRO'] },
  { patron: palabra(['pib$', 'producto interno', 'crecimiento', 'crece', 'recesi', 'reservas', 'deuda', 'deficit', 'fiscal', 'desempleo', 'empleo', 'pobreza', 'salario', 'tasas? de interes', 'credito', 'depositos', 'balanza', 'remesas', 'inversion extranjera', 'ied$', 'macro']), paquetes: ['MACRO'] },
  { patron: palabra(['politic', 'gobierno', 'elecci', 'democra', 'corrupci', 'estado de derecho', 'libertad', 'presidente', 'asamblea', 'justicia', 'tribunal', 'institucion', 'partidos?$', 'ministro', 'oposici']), paquetes: ['POLITICA'] },
  { patron: palabra(['bloqueo', 'conflict', 'protesta', 'paros?$', 'marchas?$', 'huelga', 'movilizaci']), paquetes: ['POLITICA', 'PRENSA'] },
  { patron: palabra(['gas$', 'gas natural', 'petrole', 'combustible', 'diesel', 'gasolina', 'electric', 'energia', 'energetic', 'ypfb', 'hidrocarbur']), paquetes: ['ENERGIA'] },
  { patron: palabra(['litio', 'mineria', 'minero', 'minera', 'minas?$', 'estano', 'zinc', 'recursos naturales', 'subsuelo', 'extractiv']), paquetes: ['RECURSOS'] },
  { patron: palabra(['bosque', 'incendio', 'deforest', 'ambient', 'emision', 'contamina', 'chaqueo', 'clima']), paquetes: ['AMBIENTE'] },
  { patron: palabra(['exporta', 'importa', 'comercio exterior', 'socios? comercial', 'aduana', 'soya', 'soja']), paquetes: ['COMERCIO'] },
  { patron: palabra(['empresa', 'bolsa boliviana', 'bolsa de valores', 'bbv$', 'hechos? relevantes?', 'merco$', 'reputaci', 'emisor', 'bonos?$']), paquetes: ['EMPRESAS'] },
  { patron: palabra(['precios? internacional', 'materias primas', 'commodit', 'exogen', 'trigo', 'fertilizante', 'cobre', 'aluminio', 'crudo', 'brent', 'wti$']), paquetes: ['EXOGENAS'] },
  { patron: palabra(['bitcoin', 'btc$', 'cripto', 'oro$']), paquetes: ['MERCADOS'] },
  { patron: palabra(['vecinos?$', 'el mundo', 'compara', 'latinoameric', 'america latina', 'la region', 'peru$', 'chile$', 'paraguay', 'argentina', 'brasil']), paquetes: ['MUNDO'] },
  { patron: palabra(['carretera', 'rutas?$', 'caminos?$', 'red vial', 'vial$', 'asfalt', 'paviment']), paquetes: ['CARRETERAS'] },
  { patron: palabra(['restaurant', 'farmacia', 'negocios', 'comercios', 'lugares', 'tiendas', 'supermercado', 'hotel', 'ciudades']), paquetes: ['CIUDADES'] },
  { patron: palabra(['noticia', 'prensa', 'periodic', 'medios', 'titular', 'que paso', 'que esta pasando', 'actualidad', 'ultimas']), paquetes: ['PRENSA'] },
  { patron: palabra(['fuente', 'de donde salen', 'metodolog', 'confiable', 'se actualiza', 'actualizan', 'cada cuanto']), paquetes: ['METODO'] },
  { patron: palabra(['departamentos', 'regiones', 'por departamento']), paquetes: ['DEPTOS'] },
  { patron: palabra(['situacion', 'como esta bolivia', 'como va bolivia', 'panorama', 'resumen', 'economia boliviana', 'economia de bolivia', 'como estamos', 'la economia']), paquetes: ['HOY', 'DOLAR', 'MACRO'] },
];

/** Preguntas sobre cómo usar la herramienta, no sobre el país. */
const USO = palabra([
  'tablero', 'pestana', 'como uso', 'como se usa', 'donde veo', 'donde encuentro', 'donde esta',
  'descarg', 'csv', 'excel', 'pdf', 'filtr', 'grafico', 'herramienta', 'pagina', 'sitio', 'web',
  'observatorio', 'como funciona', 'para que sirve', 'que puedo hacer', 'que haces', 'quien sos',
  'quien eres', 'ayuda', 'como te uso', 'que sabes',
]);

const ASESORIA = palabra([
  'invertir', 'inversion', 'invierto', 'conviene', 'deberia comprar', 'deberia vender', 'compro$',
  'vendo$', 'ahorrar', 'ahorro', 'plazo fijo', 'meter mi plata', 'mis ahorros', 'que hago con mi',
  'es buen momento', 'buen negocio', 'recomiendas', 'recomendas', 'me recomiendas', 'me recomendas',
]);

const OPINION = palabra([
  'que pensas', 'que piensas', 'que opinas', 'tu opinion', 'que te parece', 'por quien',
  'a quien votar', 'votar', 'quien es mejor', 'quien tiene la culpa', 'es culpa',
]);

const SALUDO = /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal|gracias|muchas gracias|ok|okay|dale|genial|perfecto|chau|adios)[\s!.?¡¿,]*$/i;

/** Intentos de cambiarle la función al asistente o sacarle sus reglas. */
const MANIPULACION = palabra([
  'ignora (?:tus|las|todas)', 'olvida (?:tus|las|todas)', 'system prompt', 'prompt del sistema',
  'tus instrucciones', 'revela(?:me)? (?:tus|las|el) (?:reglas|instrucciones|prompt)', 'actua como', 'modo desarrollador', 'jailbreak', 'dan mode',
  'sin restricciones', 'eres ahora', 'sos ahora',
]);

/**
 * Lo que la pregunta dice sola, sin modelo.
 *
 * Devuelve `null` en `paquetes` cuando ninguna palabra decide: esas preguntas
 * van al clasificador. Una pregunta de uso sin datos va directo a la guía.
 */
export interface Previo {
  saludo: boolean;
  manipulacion: boolean;
  tipo: Tipo;
  paquetes: PaqueteId[] | null;
  departamento: string | null;
  busqueda: string | null;
}

/**
 * El tema de una pregunta sobre la prensa: «¿qué dicen las noticias sobre
 * YPFB?» busca «YPFB». Se toma del texto original, con sus tildes, porque la
 * búsqueda del archivo compara el titular tal como se publicó.
 */
export function terminoDePrensa(pregunta: string): string | null {
  const m = /(?:noticias?|prensa|medios|titulares|dicen|se dice|publican|publicaron)\b.*?\b(?:sobre|acerca de|respecto a|de)\s+([^?¿!.,;]{2,60})/i.exec(pregunta);
  const termino = m?.[1]
    ?.trim()
    .replace(/^(?:el|la|los|las|lo|un|una)\s+/i, '')
    .replace(/\s+(?:hoy|ahora|últimamente|ultimamente|recientemente)$/i, '')
    .trim();
  if (!termino || termino.length < 3) return null;
  // «qué dicen las noticias de hoy» no es un tema.
  if (/^(?:hoy|ayer|esta semana|este mes|bolivia|todo|todos)$/i.test(termino)) return null;
  return termino;
}

export function preclasificar(pregunta: string): Previo {
  const t = normalizar(pregunta);
  const departamento = detectarDepartamento(t);
  const saludo = SALUDO.test(t);
  const manipulacion = tiene(t, MANIPULACION);

  const paquetes = new Set<PaqueteId>();
  for (const regla of REGLAS) if (tiene(t, regla.patron)) regla.paquetes.forEach((p) => paquetes.add(p));
  if (departamento) {
    paquetes.add('DEPTO');
    paquetes.delete('DEPTOS');
  }

  const uso = tiene(t, USO);
  const asesoria = tiene(t, ASESORIA);
  const opinion = tiene(t, OPINION);

  let tipo: Tipo = 'DATOS';
  if (asesoria) {
    tipo = 'ASESORIA';
    ['DOLAR', 'MACRO', 'MERCADOS'].forEach((p) => paquetes.add(p as PaqueteId));
  } else if (opinion) {
    tipo = 'OPINION';
    if (paquetes.size === 0 || paquetes.has('POLITICA')) paquetes.add('POLITICA');
  } else if (uso && paquetes.size === 0) {
    tipo = 'GUIA';
  }
  if (uso) paquetes.add('GUIA');

  const busqueda = terminoDePrensa(pregunta);
  if (busqueda) paquetes.add('PRENSA');

  const lista = ordenar([...paquetes]).slice(0, 5);
  return {
    saludo,
    manipulacion,
    tipo,
    paquetes: lista.length > 0 ? lista : null,
    departamento,
    busqueda,
  };
}

function ordenar(paquetes: PaqueteId[]): PaqueteId[] {
  return [...new Set(paquetes)].sort((a, b) => PAQUETES.indexOf(a) - PAQUETES.indexOf(b));
}

/**
 * Datos que no deben entrar a un chat público.
 *
 * No es un detector completo; atrapa lo reconocible (correo, celular boliviano,
 * tarjeta) y la interfaz lo advierte igual. Un año o un monto no disparan nada.
 */
export function datoPersonal(texto: string): string | null {
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(texto)) return 'correo';
  if (/(?:^|\D)(?:\+?591[\s-]?)?[67]\d{7}(?:\D|$)/.test(texto)) return 'telefono';
  if (/(?:^|\D)(?:\d[ -]?){15,18}\d(?:\D|$)/.test(texto)) return 'tarjeta';
  if (/\b(?:pin|contrasena|contraseña|password|clave)\s*(?:es|:)?\s*\d{4,}/i.test(texto)) return 'clave';
  return null;
}

/**
 * La salida del clasificador, validada contra lo que existe.
 *
 * Un paquete o un departamento inventado se descarta en vez de fallar: el
 * modelo puede escribir «SANTA CRUZ» en vez de `SANTA_CRUZ` y eso no justifica
 * dejar la pregunta sin respuesta.
 */
export function leerClasificacion(contenido: string): Clasificacion | null {
  let bruto: unknown;
  try {
    if (contenido.length > 2_000) return null;
    const json = contenido.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    bruto = JSON.parse(json);
  } catch {
    return null;
  }
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null;
  const objeto = bruto as Record<string, unknown>;

  const tipos: readonly Tipo[] = ['DATOS', 'ASESORIA', 'OPINION', 'GUIA', 'FUERA'];
  const tipo = typeof objeto.tipo === 'string' && (tipos as readonly string[]).includes(objeto.tipo.toUpperCase())
    ? (objeto.tipo.toUpperCase() as Tipo)
    : 'DATOS';

  const paquetes = Array.isArray(objeto.paquetes)
    ? ordenar(
        objeto.paquetes
          .filter((p): p is string => typeof p === 'string')
          .map((p) => p.toUpperCase().trim())
          .filter((p): p is PaqueteId => (PAQUETES as readonly string[]).includes(p)),
      ).slice(0, 5)
    : [];

  let departamento: string | null = null;
  if (typeof objeto.departamento === 'string' && objeto.departamento.trim()) {
    const slug = normalizar(objeto.departamento).toUpperCase().replace(/[\s-]+/g, '_');
    departamento = SLUGS.has(slug) ? slug : detectarDepartamento(objeto.departamento);
  }

  const busqueda = typeof objeto.busqueda === 'string' && objeto.busqueda.trim().length >= 3
    ? objeto.busqueda.trim().slice(0, 60)
    : null;

  if (departamento && !paquetes.includes('DEPTO')) paquetes.push('DEPTO');
  return { tipo, paquetes: ordenar(paquetes), departamento, busqueda };
}

/** La lista que el clasificador ve, una línea por paquete. */
export function listaParaClasificar(): string {
  return PAQUETES.map((id) => `${id}: ${DESCRIPCION_PAQUETE[id]}`).join('\n');
}

export function nombreDepartamento(slug: string | null): string | null {
  return DEPARTAMENTOS.find((d) => d.slug === slug)?.nombre ?? null;
}
