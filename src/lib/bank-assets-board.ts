/**
 * Los bancos que ofrecen dólar digital, armados para dibujarse.
 *
 * Ningún banco publica su cotización fuera de la aplicación: lo que se lee solo
 * es si el servicio existe, desde cuándo y con qué límites. La cotización —lo
 * que el banco cobra y paga por cada ficha— llega a mano, de una captura de la
 * aplicación, y viaja aparte (`quotes`) para que el gráfico no dibuje nada que
 * nadie haya visto. Este módulo no toca la base; recibe las filas de la vista y
 * las ordena.
 */

export interface BankAssetRow {
  indicator_code: string;
  bank: string;
  bank_name: string;
  product: string;
  asset: string;
  kind: 'OFFERED' | 'LIMIT' | 'QUOTE';
  limit_name: string | null;
  side: 'CLIENT_BUYS' | 'CLIENT_SELLS' | null;
  unit: string;
  note: string;
  reading_date: string;
  value: string;
  basis: 'ANNOUNCEMENT' | 'FIRST_PUBLIC_DOCUMENT' | 'OFFICIAL_PAGE' | 'USER_CAPTURE';
  source_url: string | null;
}

export interface BankLimit {
  label: string;
  value: number;
  unit: string;
}

/** Lo último que se anotó de lo que un banco cobra y paga por ficha. */
export interface BankQuote {
  /** Bolivianos que el cliente paga por cada ficha. */
  clientBuys: number | null;
  /** Bolivianos que el cliente recibe por cada ficha. */
  clientSells: number | null;
  date: string;
}

export interface BankProduct {
  bank: string;
  bankName: string;
  product: string;
  asset: string;
  /** El día desde el que el servicio consta. */
  since: string;
  /** Cómo consta: anunciado, o solo por el primer documento oficial. */
  sinceBasis: Exclude<BankAssetRow['basis'], 'USER_CAPTURE' | 'OFFICIAL_PAGE'>;
  sinceSource: string | null;
  /** `null` si el banco no tiene lectura diaria de su página. */
  offeredNow: boolean | null;
  lastRead: string | null;
  limits: BankLimit[];
  quote: BankQuote | null;
  note: string;
}

/** Una fila del gráfico: el día y, por banco, lo que el cliente paga por ficha. */
export interface QuotePoint {
  date: string;
  [bank: string]: string | number | null;
}

export interface BankAssetsBoard {
  banks: BankProduct[];
  /** Cuánto paga el cliente por cada ficha, un renglón por día con alguna cotización. */
  quotes: QuotePoint[];
  latestRead: string | null;
}

export const EMPTY_BANK_BOARD: BankAssetsBoard = { banks: [], quotes: [], latestRead: null };

const LIMIT_LABEL: Record<string, string> = {
  TRADE_MIN: 'Mínimo por compra o venta',
  TRADE_MAX_DAY: 'Máximo por día en compra o venta',
  TRANSFER_MIN: 'Mínimo por giro al exterior',
  TRANSFER_MAX_DAY: 'Máximo por día en giros al exterior',
};

const byDate = (a: BankAssetRow, b: BankAssetRow): number =>
  a.reading_date.localeCompare(b.reading_date);

/** Lo último que se anotó de cada lado, y el día más reciente de los dos. */
function latestQuote(rows: readonly BankAssetRow[]): BankQuote | null {
  const buys = rows
    .filter((row) => row.side === 'CLIENT_BUYS')
    .sort(byDate)
    .at(-1);
  const sells = rows
    .filter((row) => row.side === 'CLIENT_SELLS')
    .sort(byDate)
    .at(-1);
  const dates = [buys?.reading_date, sells?.reading_date].filter((d): d is string => !!d);
  if (!dates.length) return null;
  return {
    clientBuys: buys ? Number(buys.value) : null,
    clientSells: sells ? Number(sells.value) : null,
    date: dates.sort().at(-1) ?? '',
  };
}

export function buildBankBoard(rows: readonly BankAssetRow[]): BankAssetsBoard {
  const service = rows.filter((row) => row.kind === 'OFFERED');
  const limits = rows.filter((row) => row.kind === 'LIMIT');
  const quoted = rows.filter((row) => row.kind === 'QUOTE');

  const codes = [...new Set(service.map((row) => row.indicator_code))];
  const banks: BankProduct[] = [];
  for (const code of codes) {
    const own = service.filter((row) => row.indicator_code === code).sort(byDate);
    const first = own[0];
    if (!first || first.basis === 'USER_CAPTURE' || first.basis === 'OFFICIAL_PAGE') continue;
    const lastPage = own.filter((row) => row.basis === 'OFFICIAL_PAGE').at(-1);
    const ownLimits: BankLimit[] = [];
    for (const key of Object.keys(LIMIT_LABEL)) {
      const latest = limits
        .filter((row) => row.bank === first.bank && row.limit_name === key)
        .sort(byDate)
        .at(-1);
      const value = latest ? Number(latest.value) : NaN;
      if (latest && Number.isFinite(value)) {
        ownLimits.push({ label: LIMIT_LABEL[key] ?? key, value, unit: latest.unit });
      }
    }
    banks.push({
      bank: first.bank,
      bankName: first.bank_name,
      product: first.product,
      asset: first.asset,
      since: first.reading_date,
      sinceBasis: first.basis,
      sinceSource: first.source_url,
      offeredNow: lastPage ? Number(lastPage.value) === 1 : null,
      lastRead: lastPage?.reading_date ?? null,
      limits: ownLimits,
      quote: latestQuote(quoted.filter((row) => row.bank === first.bank)),
      note: first.note,
    });
  }
  banks.sort((a, b) => a.since.localeCompare(b.since));

  const days = new Map<string, QuotePoint>();
  for (const row of quoted.filter((one) => one.side === 'CLIENT_BUYS')) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    const point = days.get(row.reading_date) ?? { date: row.reading_date };
    point[row.bank] = value;
    days.set(row.reading_date, point);
  }
  const bankKeys = banks.map((bank) => bank.bank);
  const quotes = [...days.values()]
    .map((point) => {
      const full: QuotePoint = { date: point.date };
      for (const key of bankKeys) full[key] = point[key] ?? null;
      return full;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const latestRead =
    rows
      .filter((row) => row.basis === 'OFFICIAL_PAGE')
      .map((row) => row.reading_date)
      .sort()
      .at(-1) ?? null;

  return { banks, quotes, latestRead };
}
