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

export const GUIA_VERSION = 'guia-tablero-v4-2026-10-15';

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
    que: 'Seis páginas: «Resumen» (cuánto cuesta hoy el dólar oficial y el paralelo, la brecha y su cambio en 30 días, con un gráfico y un glosario), «Dólar digital» (USDT y USDC en bolivianos y el mercado de USDT que informa el BCB), «Otras monedas» (conversor, el boliviano frente a 22 monedas del BCB y qué monedas se encarecieron), «Bancos» (lo que cobra cada banco por un dólar digital y qué bancos lo ofrecen), «Poder de compra» (el paralelo descontada la inflación con la UFV y las lecturas derivadas) y «Análisis técnico» (el explorador con filtros, la estadística de retornos y el informe econométrico).',
    como: 'Se elige la página en el índice. En «Resumen», el periodo del gráfico (1 mes a todo); en «Análisis técnico», el periodo y la serie medida. El menú «Descargar» de cada panel baja lo que se ve. «Descargar informe econométrico (PDF)», en «Análisis técnico», genera las pruebas formales (raíz unitaria, cointegración, volatilidad).',
  },
  {
    pestana: 'Macroeconomía',
    que: 'Ocho páginas: «Series de Bolivia» (indicadores anuales por rubro, con los rubros invitados «Departamentos», «Cuentas públicas» —qué cobra, gasta y debe el Estado, qué dicen las normas de cada impuesto y cuánto de un precio es impuesto—, y «Energía»), «Indicadores sociales» (el catálogo del Banco Mundial para Bolivia, con el invitado «Instituciones»), «Bolivia ante el mundo», «Variables exógenas» (con tres pestañas arriba: «Precios por producto», «Comparativos» y «Demanda externa y clima», series de fuentes externas con licencia y disponibilidad verificables, con su historia y descarga), «Series del BCB» y «Comercio exterior» (con una pestaña por fuente: «Resumen: Comtrade e INE», con socios, productos, departamentos y principales exportadoras, y «Detalle aduanero (INE)»), «Recursos naturales» (mapa del mundo con a dónde van los minerales, el gas, el litio y los boratos y cuánto crece cada destino, con filtros de recurso, años, valor o peso, departamento y país, según la base aduanera del INE; debajo, la renta natural del Banco Mundial) y «Clima y ambiente» (temperatura, lluvia y calor extremo por departamento desde ERA5 y NASA POWER, calidad del aire de las capitales con CAMS, focos de calor de NASA FIRMS, pérdida de bosque de Global Forest Watch, El Niño (ONI de la NOAA) y los indicadores ambientales del Banco Mundial).',
    como: 'Se elige la página arriba y después el rubro, el indicador o el filtro. El control «Desde» recorta los años. Los exploradores que ofrecen «Descargar análisis (PDF)» incluyen distribución y atípicos; las descargas disponibles se indican en cada tabla. En «Variables exógenas», «Precios por producto» es el explorador de precios, «Comparativos» pone dos precios frente a frente —el de Bolivia contra su referencia mundial, lo exportado contra su cotización— con su cambio y su correlación, y «Demanda externa y clima» muestra el crecimiento de los socios y el índice ONI.',
  },
  {
    pestana: 'Empresas',
    que: 'Siete páginas: «Tejido empresarial» (cuántas empresas tiene Bolivia por tipo societario, departamento, actividad y tamaño desde 2008; cierres por cancelación de matrícula; y el directorio nominal disponible con nube de palabras y Excel), «Principales empresas» (el ránking anual de las que más impuestos pagan y de «Las 500» por ingresos, utilidad, activos y patrimonio), «Empresarios» (las fortunas que publica Forbes y la estimación de DatosBolivia.com por participaciones en empresas, siempre rotulada como cota inferior), «Bolsa de valores (BBV)» con los hechos relevantes que publican los emisores, «Reputación empresarial» (las ediciones del monitor Merco), «Redes sociales» (seguidores, interacción, sentimiento de los comentarios y palabras más repetidas de las cuentas oficiales de esas empresas) y «Ventas en vivo» (los lives de venta de TikTok observados en Bolivia: qué se vende, a qué precio, qué pide el chat y con qué ánimo, semana a semana).',
    como: 'En «Tejido empresarial» se elige la medida, el lugar (también desde el mapa), la dimensión, las categorías y los años, y todo se cruza. El directorio se busca por nombre, departamento, municipio o palabra; «Excel» descarga todas las coincidencias, no solo la página visible. En «Principales empresas» se elige la medida, el año, el departamento y el sector; al seleccionar una empresa se abre su ficha. En la Bolsa se filtra por empresa, sector y categoría y la selección se descarga en CSV o JSON. En «Redes sociales» se filtra por red, sector, tono y empresa; al seleccionar una empresa de la tabla se aísla en los gráficos. En «Ventas en vivo» se filtra por rubro, departamento, audiencia, franja horaria, día y fechas; al seleccionar una barra de rubro se recorta toda la página.',
  },
  {
    pestana: 'Ciudades',
    que: 'Los lugares y negocios mapeados por ciudad y por familia (comercios, restaurantes, salud, educación, etc.), en mapa y en tabla.',
    como: 'Se elige la ciudad y la familia; la tabla y el mapa se filtran juntos y la selección se descarga en CSV o JSON.',
  },
  {
    pestana: 'Transporte',
    que: 'Cuatro páginas, cada una con sus pestañas: «Parque y mercado» (Automotor: parque 2003–2025, servicio, clase, capacidad y GNV; Vehículos 0 km; Estudio automotor), «Combustible y pasajes» (Carburantes, Pasajes con los tarifarios ATT de 2013 y 2025 por ruta y tipo de asiento, y Tarifas publicadas), «Infraestructura» (Carreteras, Ferrocarriles, Ríos y puertos) y «Fletes» (histórico boliviano de aduana, índices internacionales y referencias nacionales documentadas).',
    como: 'En «Combustible y pasajes › Pasajes» se elige el tarifario y se busca el origen o el destino. En «Fletes» la vista inicial muestra el histórico boliviano; los filtros permiten comparar otras familias sin mezclar unidades. En las pestañas de infraestructura se filtra por departamento y red.',
  },
  {
    pestana: 'Prensa',
    que: 'Dos páginas: «Cobertura» (el archivo de noticias desde 2020 con su tema, tono y región) y «Temas» (cuánto se habla de cada término mes a mes).',
    como: 'En «Cobertura» se filtra por año, tono, tema, región, medio o término, o se busca una palabra; los conteos y las notas cambian juntos. El tema y el tono se derivan del titular: no los publica el medio.',
  },
  {
    pestana: 'Método',
    que: 'De dónde sale cada cifra: fuente, enlace y notas metodológicas.',
    como: 'Se consulta para saber quién publica un dato o cada cuánto se actualiza. El dólar y la prensa se recogen tres veces al día; los indicadores anuales, cuando la fuente publica.',
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
  COMERCIO: 'Macroeconomía',
  EMPRESAS: 'Empresas',
  VENTAS_VIVO: 'Empresas',
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
  POLITICA: { pestana: 'Macroeconomía', pagina: 'Indicadores sociales' },
  ENERGIA: { pestana: 'Macroeconomía', pagina: 'Series de Bolivia' },
  RECURSOS: { pestana: 'Macroeconomía', pagina: 'Series de Bolivia' },
  AMBIENTE: { pestana: 'Macroeconomía', pagina: 'Series de Bolivia' },
  EXOGENAS: { pestana: 'Macroeconomía', pagina: 'Variables exógenas' },
  MUNDO: { pestana: 'Macroeconomía', pagina: 'Bolivia ante el mundo' },
  COMERCIO: { pestana: 'Macroeconomía', pagina: 'Comercio exterior' },
  EMPRESAS: { pestana: 'Empresas', pagina: 'Bolsa de valores (BBV)' },
  VENTAS_VIVO: { pestana: 'Empresas', pagina: 'Ventas en vivo' },
  CIUDADES: { pestana: 'Ciudades' },
  CARRETERAS: { pestana: 'Transporte', pagina: 'Combustible y pasajes' },
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
  return [...vistos.values()]
    .sort((a, b) => PESTANAS.indexOf(a.pestana) - PESTANAS.indexOf(b.pestana))
    .slice(0, 3);
}

/** Dónde está cada cosa dentro de su pestaña, para decirlo en la respuesta. */
export const RUTA_DE_PAQUETE: Record<string, string> = {
  HOY: '«Hoy»',
  DOLAR: '«Tipo de cambio»',
  MERCADOS: '«Hoy», tarjetas de mercados',
  MACRO: '«Macroeconomía» › «Series de Bolivia»',
  DEPTO: '«Macroeconomía» › «Series de Bolivia» › rubro «Departamentos»',
  DEPTOS: '«Macroeconomía» › «Series de Bolivia» › rubro «Departamentos»',
  POLITICA:
    '«Macroeconomía» › «Indicadores sociales» › «Instituciones», y «Prensa» filtrando el tema «Política y Estado»',
  ENERGIA: '«Macroeconomía» › «Series de Bolivia» › rubro «Energía»',
  RECURSOS: '«Macroeconomía» › «Recursos naturales»',
  AMBIENTE: '«Macroeconomía» › «Clima y ambiente»',
  EXOGENAS: '«Macroeconomía» › «Variables exógenas»',
  MUNDO: '«Macroeconomía» › «Bolivia ante el mundo»',
  COMERCIO: '«Macroeconomía» › «Comercio exterior»',
  EMPRESAS: '«Empresas» › «Bolsa de valores (BBV)» y «Reputación empresarial»',
  VENTAS_VIVO: '«Empresas» › «Ventas en vivo»',
  CIUDADES: '«Ciudades»',
  CARRETERAS: '«Transporte» › «Pasajes»',
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
