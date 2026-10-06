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
  status: 'VENTA' | 'SIN_VENTA' | 'EXTRANJERO';
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

export type Dimension = 'rubro' | 'city' | 'size' | 'slot' | 'weekday';

export interface LiveFilters {
  rubro: ReadonlySet<string>;
  city: ReadonlySet<string>;
  size: ReadonlySet<string>;
  slot: ReadonlySet<string>;
  weekday: ReadonlySet<string>;
  from: string;
  to: string;
  /** Solo los lives donde se vendió algo (precio dicho o pedidos en el chat). */
  commerceOnly: boolean;
}

export const NO_FILTERS: LiveFilters = {
  rubro: new Set(),
  city: new Set(),
  size: new Set(),
  slot: new Set(),
  weekday: new Set(),
  from: '',
  to: '',
  commerceOnly: true,
};

const valueOf = (room: LiveRoom, dimension: Dimension): string => {
  switch (dimension) {
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

const DIMENSIONS: readonly Dimension[] = ['rubro', 'city', 'size', 'slot', 'weekday'];

/** Los lives del recorte. `except` deja libre una dimensión: así se cuentan sus opciones (filtro cruzado). */
export function filterRooms(rooms: readonly LiveRoom[], filters: LiveFilters, except?: Dimension): LiveRoom[] {
  return rooms.filter((room) => {
    if (filters.commerceOnly && room.status !== 'VENTA') return false;
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
