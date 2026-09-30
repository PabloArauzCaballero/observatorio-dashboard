/**
 * Los bancos que ofrecen dólar digital, armados para dibujarse.
 *
 * Ningún banco publica su cotización fuera de la aplicación: lo que el
 * observatorio sigue es si el servicio existe, desde cuándo y con qué límites.
 * Este módulo no toca la base; recibe las filas de la vista y las ordena.
 */

export interface BankAssetRow {
  indicator_code: string;
  bank: string;
  bank_name: string;
  product: string;
  asset: string;
  kind: 'OFFERED' | 'LIMIT';
  limit_name: string | null;
  unit: string;
  note: string;
  reading_date: string;
  value: string;
  basis: 'ANNOUNCEMENT' | 'FIRST_PUBLIC_DOCUMENT' | 'OFFICIAL_PAGE';
  source_url: string | null;
}

export interface BankLimit {
  label: string;
  value: number;
  unit: string;
}

export interface BankProduct {
  bank: string;
  bankName: string;
  product: string;
  asset: string;
  /** El día desde el que el servicio consta. */
  since: string;
  /** Cómo consta: anunciado, o solo por el primer documento oficial. */
  sinceBasis: BankAssetRow['basis'];
  sinceSource: string | null;
  /** `null` si el banco no tiene lectura diaria de su página. */
  offeredNow: boolean | null;
  lastRead: string | null;
  limits: BankLimit[];
  note: string;
}

export interface AdoptionPoint {
  date: string;
  total: number;
  usdt: number;
  usdc: number;
  [key: string]: string | number;
}

export interface BankAssetsBoard {
  banks: BankProduct[];
  adoption: AdoptionPoint[];
  latestRead: string | null;
}

export const EMPTY_BANK_BOARD: BankAssetsBoard = { banks: [], adoption: [], latestRead: null };

const LIMIT_LABEL: Record<string, string> = {
  TRADE_MIN: 'Mínimo por compra o venta',
  TRADE_MAX_DAY: 'Máximo por día en compra o venta',
  TRANSFER_MIN: 'Mínimo por giro al exterior',
  TRANSFER_MAX_DAY: 'Máximo por día en giros al exterior',
};

const DAY = 86_400_000;
const isoDay = (time: number): string => new Date(time).toISOString().slice(0, 10);

/** Un día del calendario a la vez, sin que el cambio de hora mueva ninguno. */
function daysBetween(first: string, last: string): string[] {
  const out: string[] = [];
  for (let time = Date.parse(`${first}T00:00:00Z`); isoDay(time) <= last; time += DAY) {
    out.push(isoDay(time));
  }
  return out;
}

interface Track {
  readonly product: BankProduct;
  readonly points: readonly { date: string; on: boolean }[];
}

/** El estado de un día es el de la última lectura que no sea posterior a él. */
function stateOn(track: Track, day: string): boolean {
  let on = false;
  for (const point of track.points) {
    if (point.date > day) break;
    on = point.on;
  }
  return on;
}

export function buildBankBoard(rows: readonly BankAssetRow[]): BankAssetsBoard {
  const byCode = new Map<string, BankAssetRow[]>();
  for (const row of rows) {
    const own = byCode.get(row.indicator_code);
    if (own) own.push(row);
    else byCode.set(row.indicator_code, [row]);
  }

  const limitsByBank = new Map<string, BankLimit[]>();
  const tracks: Track[] = [];
  for (const own of byCode.values()) {
    const sorted = [...own].sort((a, b) => a.reading_date.localeCompare(b.reading_date));
    const first = sorted[0];
    const last = sorted.at(-1);
    if (!first || !last) continue;
    if (first.kind === 'LIMIT') {
      const value = Number(last.value);
      const label = LIMIT_LABEL[first.limit_name ?? ''];
      if (!label || !Number.isFinite(value)) continue;
      const bucket = limitsByBank.get(first.bank) ?? [];
      bucket.push({ label, value, unit: first.unit });
      limitsByBank.set(first.bank, bucket);
      continue;
    }
    const pageReads = sorted.filter((row) => row.basis === 'OFFICIAL_PAGE');
    const lastPage = pageReads.at(-1);
    tracks.push({
      points: sorted.map((row) => ({ date: row.reading_date, on: Number(row.value) === 1 })),
      product: {
        bank: first.bank,
        bankName: first.bank_name,
        product: first.product,
        asset: first.asset,
        since: first.reading_date,
        sinceBasis: first.basis,
        sinceSource: first.source_url,
        offeredNow: lastPage ? Number(lastPage.value) === 1 : null,
        lastRead: lastPage?.reading_date ?? null,
        limits: [],
        note: first.note,
      },
    });
  }

  const order = Object.keys(LIMIT_LABEL);
  for (const track of tracks) {
    track.product.limits = (limitsByBank.get(track.product.bank) ?? []).sort(
      (a, b) =>
        order.findIndex((key) => LIMIT_LABEL[key] === a.label) -
        order.findIndex((key) => LIMIT_LABEL[key] === b.label),
    );
  }
  tracks.sort((a, b) => a.product.since.localeCompare(b.product.since));

  const dates = rows.map((row) => row.reading_date).sort();
  const firstDay = dates[0];
  const latestRead = rows
    .filter((row) => row.basis === 'OFFICIAL_PAGE')
    .map((row) => row.reading_date)
    .sort()
    .at(-1);
  const lastDay = dates.at(-1);
  const adoption: AdoptionPoint[] =
    firstDay && lastDay
      ? daysBetween(firstDay, lastDay).map((date) => {
          const on = tracks.filter((track) => stateOn(track, date));
          return {
            date,
            total: on.length,
            usdt: on.filter((track) => track.product.asset === 'USDT').length,
            usdc: on.filter((track) => track.product.asset === 'USDC').length,
          };
        })
      : [];

  return {
    banks: tracks.map((track) => track.product),
    adoption,
    latestRead: latestRead ?? null,
  };
}
