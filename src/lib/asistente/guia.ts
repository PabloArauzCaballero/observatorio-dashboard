/**
 * Cómo se usa el tablero, escrito una vez y versionado.
 *
 * Es el equivalente del catálogo de Atlas: hechos verificados contra la
 * interfaz, no redactados por el modelo. Si una pestaña cambia de nombre o de
 * lugar, este archivo cambia con ella y sube de versión; el asistente cita los
 * nombres tal como aparecen aquí, entre «».
 *
 * Puro, como `alcance.ts`, para poder probarlo sin levantar nada.
 */

export const GUIA_VERSION = 'guia-tablero-v2-2026-09-27';

/** Las ocho pestañas, con el rótulo exacto del botón. */
export const PESTANAS = [
  'Hoy',
  'Tipo de cambio',
  'Macroeconomía',
  'Empresas',
  'Ciudades',
  'Transporte',
  'Prensa',
  'Método',
] as const;

export type Pestana = (typeof PESTANAS)[number];

export interface EntradaGuia {
  pestana: Pestana;
  que: string;
  como: string;
}

export const GUIA: readonly EntradaGuia[] = [
  {
    pestana: 'Hoy',
    que: 'El resumen del día: dólar oficial, paralelo (punto medio), brecha cambiaria, su máximo histórico y la UFV; bitcoin, USDT y oro; un cuadro de mando con veredictos (favorable, vigilar, adverso) sobre inflación, reservas, crecimiento, deuda e instituciones, cada uno con la regla que lo decide; el análisis del día y las novedades de prensa.',
    como: 'Es la pestaña que se abre primero. Cada bloque del cuadro de mando dice a qué pestaña ir para ver el detalle.',
  },
  {
    pestana: 'Tipo de cambio',
    que: 'El explorador del dólar oficial, el paralelo (compra, venta y medio) y las stablecoins USDT/USDC en bolivianos; paneles de régimen cambiario, nivel real deflactado por la UFV e inflación implícita; y el informe econométrico.',
    como: 'Elegí el rango (desde 90 días hasta todo el histórico) y las series a mostrar. Los botones «CSV» y «JSON» bajan lo que ves. «Descargar el informe (PDF)» arma las pruebas formales (raíz unitaria, cointegración, volatilidad).',
  },
  {
    pestana: 'Macroeconomía',
    que: 'Cuatro páginas: «Series de Bolivia» (indicadores anuales por rubro, con los rubros invitados «Departamentos», «Cuentas públicas» —qué cobra, gasta y debe el Estado, qué dicen las normas de cada impuesto y cuánto de un precio es impuesto—, «Energía», «Recursos naturales» y «Medio ambiente»), «Social Info» (el catálogo del Banco Mundial para Bolivia, con el invitado «Instituciones»), «Bolivia ante el mundo» (comparación con vecinos y el mundo) y «Variables exógenas» (precios internacionales de petróleo, metales, granos y fertilizantes).',
    como: 'Elegí la página arriba y después el rubro o el indicador. El control «Desde» recorta los años. Cada serie tiene «Descargar análisis (PDF)» con su distribución y atípicos, y las tablas se bajan en CSV o JSON.',
  },
  {
    pestana: 'Empresas',
    que: 'Ocho páginas: «Tejido empresarial» (cuántas empresas tiene Bolivia por tipo societario, departamento, actividad y tamaño desde 2008, quién las encabeza, y cómo se reparte el padrón de Impuestos entre PRICO, GRACO y el resto), «Principales empresas» (el ránking anual de las que más impuestos pagan y de «Las 500» por ingresos, utilidad, activos y patrimonio), «Empresarios» (las fortunas que publica Forbes y la estimación del observatorio por participaciones en empresas, siempre rotulada como cota inferior), «Bolsa de valores (BBV)» con los hechos relevantes que publican los emisores, «Comercio exterior» (socios, productos y exportaciones por departamento, más las principales exportadoras), «Detalle aduanero (INE)», «Reputación empresarial» (las ediciones del monitor Merco) y «Redes sociales» (seguidores, interacción, sentimiento de los comentarios y palabras más repetidas de las cuentas oficiales de esas empresas).',
    como: 'En «Tejido empresarial» elegís la medida, el lugar (también tocando el mapa), la dimensión, las categorías y los años, y todo se cruza. En «Principales empresas» elegís la vara, el año, el departamento y el sector, y tocar una empresa abre su ficha. En la Bolsa podés filtrar por empresa, sector y categoría y bajar la selección en CSV o JSON. En «Redes sociales» filtrás por red, sector, tono y empresa; tocar una empresa de la tabla la aísla en los gráficos.',
  },
  {
    pestana: 'Ciudades',
    que: 'Los lugares y negocios mapeados por ciudad y por familia (comercios, restaurantes, salud, educación, etc.), en mapa y en tabla.',
    como: 'Elegí la ciudad y la familia; la tabla y el mapa se filtran juntos y la selección se baja en CSV o JSON.',
  },
  {
    pestana: 'Transporte',
    que: 'Tres páginas: «Carreteras» (la red vial por ruta, rodadura y departamento, con la longitud oficial del INE por red y departamento), «Ferrocarriles» (la Red Andina, la Oriental y el tren de Cochabamba, sus estaciones y la carga y pasajeros del INE) y «Ríos y puertos» (hidrovías, ríos navegables, cruces en transbordador y puertos).',
    como: 'En cada página filtrá por departamento y por red, estado o navegabilidad; el mapa, las cifras y la tabla cambian juntos, y un clic en una ruta, línea o río la aísla.',
  },
  {
    pestana: 'Prensa',
    que: 'Dos páginas: «Cobertura» (el archivo de noticias desde 2020 con su tema, tono y región) y «Temas» (cuánto se habla de cada término mes a mes).',
    como: 'En «Cobertura» filtrá por año, tono, tema, región, medio o término, o buscá una palabra; los conteos y las notas cambian juntos. El tema y el tono se derivan del titular: no los publica el medio.',
  },
  {
    pestana: 'Método',
    que: 'De dónde sale cada cifra: fuente, enlace y notas metodológicas.',
    como: 'Consultala cuando quieras saber quién publica un dato o cada cuánto se actualiza. El dólar y la prensa se recogen tres veces al día; los indicadores anuales, cuando la fuente publica.',
  },
];

/** Qué pestaña muestra cada paquete: es el botón «Ir a…» de la respuesta. */
export const PESTANA_DE_PAQUETE: Record<string, Pestana> = {
  HOY: 'Hoy',
  DOLAR: 'Tipo de cambio',
  MERCADOS: 'Hoy',
  MACRO: 'Macroeconomía',
  DEPTO: 'Macroeconomía',
  DEPTOS: 'Macroeconomía',
  POLITICA: 'Macroeconomía',
  ENERGIA: 'Macroeconomía',
  RECURSOS: 'Macroeconomía',
  AMBIENTE: 'Macroeconomía',
  EXOGENAS: 'Macroeconomía',
  MUNDO: 'Macroeconomía',
  COMERCIO: 'Empresas',
  EMPRESAS: 'Empresas',
  CIUDADES: 'Ciudades',
  CARRETERAS: 'Transporte',
  PRENSA: 'Prensa',
  METODO: 'Método',
};

/**
 * El lugar exacto de cada paquete: la pestaña y, si la tiene, su página. Es el
 * enlace de la respuesta; los rótulos son los de los botones, así que un
 * cambio de nombre en el tablero se nota en las pruebas.
 */
export interface Destino {
  pestana: Pestana;
  pagina?: string;
}

export const DESTINO_DE_PAQUETE: Record<string, Destino> = {
  HOY: { pestana: 'Hoy' },
  DOLAR: { pestana: 'Tipo de cambio' },
  MERCADOS: { pestana: 'Hoy' },
  MACRO: { pestana: 'Macroeconomía', pagina: 'Series de Bolivia' },
  DEPTO: { pestana: 'Macroeconomía', pagina: 'Series de Bolivia' },
  DEPTOS: { pestana: 'Macroeconomía', pagina: 'Series de Bolivia' },
  POLITICA: { pestana: 'Macroeconomía', pagina: 'Social Info' },
  ENERGIA: { pestana: 'Macroeconomía', pagina: 'Series de Bolivia' },
  RECURSOS: { pestana: 'Macroeconomía', pagina: 'Series de Bolivia' },
  AMBIENTE: { pestana: 'Macroeconomía', pagina: 'Series de Bolivia' },
  EXOGENAS: { pestana: 'Macroeconomía', pagina: 'Variables exógenas' },
  MUNDO: { pestana: 'Macroeconomía', pagina: 'Bolivia ante el mundo' },
  COMERCIO: { pestana: 'Empresas', pagina: 'Comercio exterior' },
  EMPRESAS: { pestana: 'Empresas', pagina: 'Bolsa de valores (BBV)' },
  CIUDADES: { pestana: 'Ciudades' },
  CARRETERAS: { pestana: 'Transporte', pagina: 'Carreteras' },
  PRENSA: { pestana: 'Prensa', pagina: 'Cobertura' },
  METODO: { pestana: 'Método' },
};

export interface Enlace extends Destino {
  /** «Macroeconomía › Variables exógenas», el texto del botón. */
  etiqueta: string;
}

/**
 * Los destinos a ofrecer, sin repetir y en el orden del tablero. La dirección
 * la pone quien arma la respuesta con `hrefDe`, para que este archivo siga sin
 * importar nada y se pruebe con `node --test`.
 */
export function enlacesPara(paquetes: readonly string[]): Enlace[] {
  const vistos = new Map<string, Enlace>();
  for (const paquete of paquetes) {
    const destino = DESTINO_DE_PAQUETE[paquete];
    if (!destino) continue;
    const etiqueta = destino.pagina ? `${destino.pestana} › ${destino.pagina}` : destino.pestana;
    if (!vistos.has(etiqueta)) vistos.set(etiqueta, { ...destino, etiqueta });
  }
  return [...vistos.values()].sort((a, b) => PESTANAS.indexOf(a.pestana) - PESTANAS.indexOf(b.pestana)).slice(0, 3);
}

/** Dónde está cada cosa dentro de su pestaña, para decirlo en la respuesta. */
export const RUTA_DE_PAQUETE: Record<string, string> = {
  HOY: '«Hoy»',
  DOLAR: '«Tipo de cambio»',
  MERCADOS: '«Hoy», tarjetas de mercados',
  MACRO: '«Macroeconomía» › «Series de Bolivia»',
  DEPTO: '«Macroeconomía» › «Series de Bolivia» › rubro «Departamentos»',
  DEPTOS: '«Macroeconomía» › «Series de Bolivia» › rubro «Departamentos»',
  POLITICA: '«Macroeconomía» › «Social Info» › «Instituciones», y «Prensa» filtrando el tema «Política y Estado»',
  ENERGIA: '«Macroeconomía» › «Series de Bolivia» › rubro «Energía»',
  RECURSOS: '«Macroeconomía» › «Series de Bolivia» › rubro «Recursos naturales»',
  AMBIENTE: '«Macroeconomía» › «Series de Bolivia» › rubro «Medio ambiente»',
  EXOGENAS: '«Macroeconomía» › «Variables exógenas»',
  MUNDO: '«Macroeconomía» › «Bolivia ante el mundo»',
  COMERCIO: '«Empresas» › «Comercio exterior»',
  EMPRESAS: '«Empresas» › «Bolsa de valores (BBV)» y «Reputación empresarial»',
  CIUDADES: '«Ciudades»',
  CARRETERAS: '«Transporte» › «Carreteras»',
  PRENSA: '«Prensa» › «Cobertura»',
  METODO: '«Método»',
};

/** La guía entera, como evidencia para una pregunta de uso. */
export function guiaCompleta(): string {
  return GUIA.map((e) => `«${e.pestana}»: ${e.que} Cómo: ${e.como}`).join('\n');
}

/** Una línea por pestaña, para que toda respuesta pueda remitir a la correcta. */
export function guiaBreve(): string {
  return Object.entries(RUTA_DE_PAQUETE)
    .map(([paquete, ruta]) => `${paquete} → ${ruta}`)
    .join('; ');
}

/** Las pestañas a ofrecer como botón, sin repetir y en el orden del tablero. */
export function pestanasPara(paquetes: readonly string[]): Pestana[] {
  const vistas = new Set<Pestana>();
  for (const paquete of paquetes) {
    const pestana = PESTANA_DE_PAQUETE[paquete];
    if (pestana) vistas.add(pestana);
  }
  return PESTANAS.filter((p) => vistas.has(p)).slice(0, 3);
}
