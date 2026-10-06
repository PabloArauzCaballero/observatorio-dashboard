/**
 * Las ventas en vivo de TikTok (ADR 0030 del núcleo), listas para dibujar.
 *
 * Puro y sin importar módulos propios, para que `node --test` lo pruebe sin
 * resolver rutas. La base trae CONTEOS por live; aquí se suman sobre el recorte
 * que el lector elige y recién entonces se convierten en tasas. Por eso todos los
 * porcentajes de la página responden a los filtros.
 *
 * La unidad es el mercado: no hay vendedores ni compradores en este tablero. Un
 * «mío» del chat es intención declarada, no una venta.
 */

export type Counts = Record<string, number>;

export interface LiveRoom {
  key: string;
  date: string;
  week: string;
  hour: number;
  weekday: number;
  status: 'VENTA' | 'ENTRETENIMIENTO' | 'SIN_VENTA' | 'EXTRANJERO';
  rubro: string;
  product: string | null;
  city: string | null;
  size: string;
  minutes: number;
  viewersPeak: number | null;
  viewersMedian: number | null;
  messages: number;
  authors: number;
  buyers: number;
  signals: Counts;
  payments: Counts;
  destinations: Counts;
  emotions: Counts;
  polarity: Counts;
  gifts: number;
  follows: number;
  shares: number;
  likes: number;
  /** Espectadores por minuto desde que empezó el live: [minuto, espectadores]. */
  curve: ReadonlyArray<readonly [number, number]>;
  /** Mensajes que hablan del dólar, el paralelo o el tipo de cambio. */
  dollarTalk: number;
  speechSegments: number;
  screenReads: number;
}

export interface LivePrice {
  room: string;
  date: string;
  rubro: string;
  product: string | null;
  priceBs: number | null;
  currency: string;
  source: string;
  unit: string | null;
}

export interface LivePhrase {
  phrase: string;
  people: number;
  lives: number;
  rubro: string;
  emotion: string | null;
  signal: string | null;
}

export interface LiveTerm {
  rubro: string;
  scope: 'AUDIENCE' | 'SELLER';
  term: string;
  mentions: number;
}

export interface LiveCoverage {
  run: string;
  candidatesSeen: number;
  roomsOpened: number;
  roomsBlocked: number;
  roomsCommerce: number;
  roomsNoCommerce: number;
  roomsForeign: number;
  roomsUnidentified: number;
  messages: number;
  messagesWithSignal: number;
  messagesApt: number;
  speechSegments: number;
  screenReads: number;
  prices: number;
  minutes: number;
}

export interface UfvPoint {
  date: string;
  value: number;
}

export interface LiveCommerceBoard {
  analyzedAt: string | null;
  lexiconVersion: string | null;
  usdRate: number | null;
  rubros: Record<string, string>;
  departments: Record<string, string>;
  rooms: LiveRoom[];
  prices: LivePrice[];
  phrases: LivePhrase[];
  terms: LiveTerm[];
  coverage: LiveCoverage[];
  /** La UFV del Banco Central: el índice diario de precios contra el que se lee el precio de los lives. */
  ufv: UfvPoint[];
}

export const EMPTY_LIVE_BOARD: LiveCommerceBoard = {
  analyzedAt: null,
  lexiconVersion: null,
  usdRate: null,
  rubros: {},
  departments: {},
  rooms: [],
  prices: [],
  phrases: [],
  terms: [],
  coverage: [],
  ufv: [],
};

// ------------------------------------------------------------ etiquetas

export const SIGNAL_LABEL: Record<string, string> = {
  COMPRA: 'Lo pide («mío», «sepárame»)',
  PRECIO: 'Pregunta el precio',
  VARIANTE: 'Talla, color o modelo',
  ENVIO: 'Envío o entrega',
  PAGO: 'Forma de pago',
  UBICACION: 'Dónde están',
  DISPONIBILIDAD: 'Si hay o queda',
  MUESTRA: 'Pide que muestre',
  MAYOR: 'Por mayor o por docena',
  CONFIANZA: 'Original, garantía o calidad',
  PRECIO_JUICIO: 'Caro, barato u oferta',
  SALUDO: 'Saludo',
  FRICCION: 'Reclamo de precio',
  DESCONFIANZA: 'Desconfianza (estafa, no llegó)',
  DOLAR: 'Habla del dólar',
  CONTACTO: 'Pasa al privado o a WhatsApp',
  QUE_ES: 'Qué es o cómo se usa',
  PRODUCTO: 'Nombra un producto',
  REGATEO: 'Pide rebaja (regateo)',
};

/** Las preguntas del comprador, en el orden en que se leen. */
export const QUESTIONS = [
  'PRECIO',
  'VARIANTE',
  'ENVIO',
  'PAGO',
  'UBICACION',
  'DISPONIBILIDAD',
  'MUESTRA',
  'QUE_ES',
  'MAYOR',
  'REGATEO',
  'CONFIANZA',
  'CONTACTO',
] as const;

export const PAYMENT_LABEL: Record<string, string> = {
  QR: 'QR',
  TRANSFERENCIA: 'Transferencia o depósito',
  EFECTIVO: 'Efectivo',
  CONTRA_ENTREGA: 'Contra entrega',
  TIGO_MONEY: 'Tigo Money',
  DOLARES: 'Dólares',
  USDT: 'USDT o Binance',
  TARJETA: 'Tarjeta',
};

export const EMOTION_LABEL: Record<string, string> = {
  joy: 'Alegría',
  surprise: 'Sorpresa',
  sadness: 'Tristeza',
  anger: 'Enojo',
  disgust: 'Disgusto',
  fear: 'Miedo',
  others: 'Sin emoción marcada',
};

export const STATUS_LABEL: Record<string, string> = {
  VENTA: 'Venta',
  ENTRETENIMIENTO: 'Entretenimiento',
  SIN_VENTA: 'Sin venta',
  EXTRANJERO: 'De otro país',
};

export const SIZE_LABEL: Record<string, string> = {
  MICRO: 'Micro (menos de 20 espectadores)',
  CHICO: 'Chico (20 a 99)',
  MEDIANO: 'Mediano (100 a 499)',
  GRANDE: 'Grande (500 o más)',
  SIN_DATO: 'Sin dato',
};

export const SLOT_LABEL: Record<string, string> = {
  MADRUGADA: 'Madrugada (0 a 6 h)',
  MANANA: 'Mañana (6 a 12 h)',
  TARDE: 'Tarde (12 a 19 h)',
  NOCHE: 'Noche (19 a 24 h)',
};

export const WEEKDAY_LABEL = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const slotOf = (hour: number): string =>
  hour < 6 ? 'MADRUGADA' : hour < 12 ? 'MANANA' : hour < 19 ? 'TARDE' : 'NOCHE';

/** El lunes de la semana de una fecha `AAAA-MM-DD`. */
export function weekOf(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  const shift = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - shift);
  return day.toISOString().slice(0, 10);
}

// --------------------------------------------------------------- filtros

export type Dimension = 'status' | 'rubro' | 'city' | 'size' | 'slot' | 'weekday';

export interface LiveFilters {
  /** Venta, entretenimiento, sin venta o de otro país. Por defecto, solo venta. */
  status: ReadonlySet<string>;
  rubro: ReadonlySet<string>;
  city: ReadonlySet<string>;
  size: ReadonlySet<string>;
  slot: ReadonlySet<string>;
  weekday: ReadonlySet<string>;
  from: string;
  to: string;
}

export const NO_FILTERS: LiveFilters = {
  status: new Set(['VENTA']),
  rubro: new Set(),
  city: new Set(),
  size: new Set(),
  slot: new Set(),
  weekday: new Set(),
  from: '',
  to: '',
};

const valueOf = (room: LiveRoom, dimension: Dimension): string => {
  switch (dimension) {
    case 'status':
      return room.status;
    case 'rubro':
      return room.rubro;
    case 'city':
      return room.city ?? 'SIN_DATO';
    case 'size':
      return room.size;
    case 'slot':
      return slotOf(room.hour);
    case 'weekday':
      return String(room.weekday);
  }
};

const DIMENSIONS: readonly Dimension[] = ['status', 'rubro', 'city', 'size', 'slot', 'weekday'];

/** Los lives del recorte. `except` deja libre una dimensión: así se cuentan sus opciones (filtro cruzado). */
export function filterRooms(rooms: readonly LiveRoom[], filters: LiveFilters, except?: Dimension): LiveRoom[] {
  return rooms.filter((room) => {
    if (filters.from && room.date < filters.from) return false;
    if (filters.to && room.date > filters.to) return false;
    return DIMENSIONS.every((dimension) => {
      if (dimension === except) return true;
      const choice = filters[dimension];
      return choice.size === 0 || choice.has(valueOf(room, dimension));
    });
  });
}

export interface Option {
  value: string;
  count: number;
}

/** Cuántos lives quedarían con cada opción, dados los OTROS filtros. Las que dan 0 se ven apagadas. */
export function optionsFor(rooms: readonly LiveRoom[], filters: LiveFilters, dimension: Dimension): Option[] {
  const base = filterRooms(rooms, filters, dimension);
  const all = new Set(rooms.map((room) => valueOf(room, dimension)));
  const counts = new Map<string, number>();
  for (const room of base) counts.set(valueOf(room, dimension), (counts.get(valueOf(room, dimension)) ?? 0) + 1);
  return [...all]
    .map((value) => ({ value, count: counts.get(value) ?? 0 }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

// -------------------------------------------------------------- agregados

export function sumCounts(rooms: readonly LiveRoom[], field: 'signals' | 'payments' | 'destinations' | 'emotions' | 'polarity'): Counts {
  const out: Counts = {};
  for (const room of rooms) for (const [key, value] of Object.entries(room[field])) out[key] = (out[key] ?? 0) + value;
  return out;
}

export const total = (rooms: readonly LiveRoom[], field: 'messages' | 'minutes' | 'authors' | 'buyers' | 'gifts' | 'speechSegments' | 'screenReads'): number =>
  rooms.reduce((sum, room) => sum + room[field], 0);

export const perThousand = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((1000 * part) / whole * 10) / 10 : null;

export const share = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((1000 * part) / whole) / 10 : null;

export interface WeekRow {
  week: string;
  lives: number;
  hours: number;
  messages: number;
  buyIntent: number;
  questions: number;
  buyPerThousand: number | null;
  questionsPerThousand: number | null;
  /** Mensajes por hora observada: normaliza las semanas con menos noches de captura. */
  messagesPerHour: number | null;
}

/** La tendencia: cada semana con sus tasas, normalizadas por lo que se observó esa semana. */
export function weekly(rooms: readonly LiveRoom[]): WeekRow[] {
  const groups = new Map<string, LiveRoom[]>();
  for (const room of rooms) groups.set(room.week, [...(groups.get(room.week) ?? []), room]);
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([week, own]) => {
      const messages = total(own, 'messages');
      const minutes = total(own, 'minutes');
      const signals = sumCounts(own, 'signals');
      const questions = QUESTIONS.reduce((sum, code) => sum + (signals[code] ?? 0), 0);
      return {
        week,
        lives: own.length,
        hours: Math.round(minutes / 6) / 10,
        messages,
        buyIntent: signals.COMPRA ?? 0,
        questions,
        buyPerThousand: perThousand(signals.COMPRA ?? 0, messages),
        questionsPerThousand: perThousand(questions, messages),
        messagesPerHour: minutes ? Math.round((messages / minutes) * 60) : null,
      };
    });
}

export interface RubroRow {
  rubro: string;
  lives: number;
  minutes: number;
  messages: number;
  buyIntent: number;
  /** % de los minutos observados del recorte: la oferta. */
  offerShare: number | null;
  /** % de los pedidos del recorte: la demanda. */
  demandShare: number | null;
  buyPerThousand: number | null;
  enthusiasm: number | null;
  friction: number | null;
  distrust: number | null;
}

export function byRubro(rooms: readonly LiveRoom[]): RubroRow[] {
  const minutesAll = total(rooms, 'minutes');
  const buyAll = sumCounts(rooms, 'signals').COMPRA ?? 0;
  const groups = new Map<string, LiveRoom[]>();
  for (const room of rooms) groups.set(room.rubro, [...(groups.get(room.rubro) ?? []), room]);
  return [...groups.entries()]
    .map(([rubro, own]) => {
      const messages = total(own, 'messages');
      const minutes = total(own, 'minutes');
      const signals = sumCounts(own, 'signals');
      const emotions = sumCounts(own, 'emotions');
      const buy = signals.COMPRA ?? 0;
      return {
        rubro,
        lives: own.length,
        minutes,
        messages,
        buyIntent: buy,
        offerShare: share(minutes, minutesAll),
        demandShare: share(buy, buyAll),
        buyPerThousand: perThousand(buy, messages),
        enthusiasm: perThousand((emotions.joy ?? 0) + buy, messages),
        friction: perThousand((signals.FRICCION ?? 0) + (emotions.anger ?? 0) + (emotions.disgust ?? 0), messages),
        distrust: perThousand(signals.DESCONFIANZA ?? 0, messages),
      };
    })
    .sort((left, right) => right.minutes - left.minutes);
}

export interface PriceRow {
  product: string;
  rubro: string;
  n: number;
  median: number;
  p25: number;
  p75: number;
}

const quantile = (sorted: readonly number[], q: number): number => {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const lowValue = sorted[low] ?? 0;
  const highValue = sorted[high] ?? lowValue;
  return Math.round((lowValue + (highValue - lowValue) * (position - low)) * 100) / 100;
};

/** Precio mediano por producto, solo con `minimum` observaciones o más (los demás no se muestran). */
export function priceTable(prices: readonly LivePrice[], rooms: ReadonlySet<string>, minimum: number): PriceRow[] {
  const groups = new Map<string, { rubro: string; values: number[] }>();
  for (const price of prices) {
    if (!rooms.has(price.room) || price.priceBs === null || !price.product) continue;
    const group = groups.get(price.product) ?? { rubro: price.rubro, values: [] };
    group.values.push(price.priceBs);
    groups.set(price.product, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.values.length >= minimum)
    .map(([product, group]) => {
      const sorted = [...group.values].sort((left, right) => left - right);
      return {
        product,
        rubro: group.rubro,
        n: sorted.length,
        median: quantile(sorted, 0.5),
        p25: quantile(sorted, 0.25),
        p75: quantile(sorted, 0.75),
      };
    })
    .sort((left, right) => right.n - left.n);
}

/** Lives por día de la semana y hora de La Paz: dónde se concentra la oferta. */
export function heat(rooms: readonly LiveRoom[]): { row: string; column: string; value: number }[] {
  const cells = new Map<string, number>();
  for (const room of rooms) {
    const key = `${room.weekday}|${room.hour}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }
  return [...cells.entries()].map(([key, value]) => {
    const [weekday, hour] = key.split('|');
    return { row: WEEKDAY_LABEL[Number(weekday)] ?? '', column: `${String(hour).padStart(2, '0')} h`, value };
  });
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/** Mediana de espectadores por tramo de minutos desde el inicio del live (solo tramos con 3 lives o más). */
export function viewerCurve(
  rooms: readonly LiveRoom[],
  bucket = 10,
  limit = 180,
): { label: string; median: number; lives: number }[] {
  const byBucket = new Map<number, number[]>();
  for (const room of rooms) {
    const seen = new Map<number, number[]>();
    for (const [minute, viewers] of room.curve) {
      if (minute >= limit) continue;
      const slot = Math.floor(minute / bucket);
      seen.set(slot, [...(seen.get(slot) ?? []), viewers]);
    }
    // un live aporta un solo valor por tramo: su mediana en ese tramo
    for (const [slot, values] of seen) {
      byBucket.set(slot, [...(byBucket.get(slot) ?? []), median(values)]);
    }
  }
  return [...byBucket.entries()]
    .filter(([, values]) => values.length >= 3)
    .sort(([a], [b]) => a - b)
    .map(([slot, values]) => ({
      label: `${slot * bucket}–${(slot + 1) * bucket} min`,
      median: Math.round(median(values)),
      lives: values.length,
    }));
}

/** Regalos, seguidores nuevos y compartidos por hora observada, por rubro. */
export function interactionPerHour(
  rooms: readonly LiveRoom[],
): { rubro: string; gifts: number; follows: number; shares: number; hours: number }[] {
  const groups = new Map<string, LiveRoom[]>();
  for (const room of rooms) groups.set(room.rubro, [...(groups.get(room.rubro) ?? []), room]);
  return [...groups.entries()]
    .map(([rubro, own]) => {
      const hours = total(own, 'minutes') / 60;
      const per = (value: number): number => (hours > 0 ? Math.round((value / hours) * 10) / 10 : 0);
      return {
        rubro,
        hours: Math.round(hours * 10) / 10,
        gifts: per(total(own, 'gifts')),
        follows: per(own.reduce((sum, room) => sum + room.follows, 0)),
        shares: per(own.reduce((sum, room) => sum + room.shares, 0)),
      };
    })
    .filter((row) => row.hours >= 0.5)
    .sort((a, b) => b.gifts - a.gifts);
}


/**
 * Índice semanal del precio en los lives (base 100 = primera semana) frente a la UFV en la misma base.
 *
 * Encadenado: cada semana se compara con la anterior solo en los productos que tienen precio en las dos,
 * con la mediana de sus cocientes. Así un cambio de mezcla (más celulares que medias) no se lee como
 * inflación. Una semana sin productos en común con la anterior corta la cadena y no se dibuja.
 */
export function priceIndex(
  prices: readonly LivePrice[],
  rooms: ReadonlySet<string>,
  ufv: readonly UfvPoint[],
): { week: string; lives: number | null; ufv: number | null; products: number }[] {
  const byWeek = new Map<string, Map<string, number[]>>();
  for (const price of prices) {
    if (!rooms.has(price.room) || price.priceBs === null || !price.product) continue;
    const week = weekOf(price.date);
    const products = byWeek.get(week) ?? new Map<string, number[]>();
    products.set(price.product, [...(products.get(price.product) ?? []), price.priceBs]);
    byWeek.set(week, products);
  }
  const weeks = [...byWeek.keys()].sort();
  const ufvByWeek = new Map<string, number[]>();
  for (const point of ufv) ufvByWeek.set(weekOf(point.date), [...(ufvByWeek.get(weekOf(point.date)) ?? []), point.value]);
  const ufvBase = weeks[0] ? median(ufvByWeek.get(weeks[0]) ?? []) : 0;
  const rows: { week: string; lives: number | null; ufv: number | null; products: number }[] = [];
  let level: number | null = 100;
  weeks.forEach((week, index) => {
    const current = byWeek.get(week) ?? new Map<string, number[]>();
    if (index > 0 && level !== null) {
      const previous = byWeek.get(weeks[index - 1] ?? '') ?? new Map<string, number[]>();
      const ratios = [...current.keys()]
        .filter((product) => previous.has(product))
        .map((product) => median(current.get(product) ?? []) / median(previous.get(product) ?? [1]));
      level = ratios.length ? Math.round(level * median(ratios) * 10) / 10 : null;
    }
    const ufvWeek = ufvByWeek.get(week);
    rows.push({
      week,
      lives: level,
      ufv: ufvBase && ufvWeek?.length ? Math.round((median(ufvWeek) / ufvBase) * 1000) / 10 : null,
      products: current.size,
    });
  });
  return rows;
}
