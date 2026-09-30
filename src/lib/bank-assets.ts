import 'server-only';
import { pool } from './db';
import { held } from './hold';
import { buildBankBoard, EMPTY_BANK_BOARD } from './bank-assets-board';
import type { BankAssetRow, BankAssetsBoard } from './bank-assets-board';

/**
 * Los servicios de dólar digital de los bancos, leídos de
 * `read_models.bank_virtual_asset`.
 *
 * Son unas diez series y unos cuantos cientos de puntos, y la vista ya deja una
 * fila por serie y día. Se sostiene en memoria como el resto de lo que se pide
 * al abrirse: el recolector publica una vez al día.
 */

export function readBankAssets(): Promise<BankAssetsBoard> {
  return held('bank-assets', buildBoard);
}

async function buildBoard(): Promise<BankAssetsBoard> {
  try {
    return buildBankBoard(await readRows(true));
  } catch (error) {
    const code = (error as { code?: string }).code;
    // El tablero se despliega a veces antes que las migraciones del núcleo. Sin
    // la 0090 falta la columna del lado (42703): se lee sin ella y las
    // cotizaciones esperan, en vez de llevarse consigo el panel entero.
    if (code === '42703') {
      try {
        return buildBankBoard(await readRows(false));
      } catch (inner) {
        return emptyOrThrow(inner);
      }
    }
    return emptyOrThrow(error);
  }
}

async function readRows(withSide: boolean): Promise<BankAssetRow[]> {
  const side = withSide ? 'side' : 'NULL::text AS side';
  const { rows } = await pool().query<BankAssetRow>(
    `SELECT indicator_code, bank, bank_name, product, asset, kind, limit_name, ${side}, unit, note,
            to_char(reading_date, 'YYYY-MM-DD') AS reading_date, value::text, basis, source_url
     FROM read_models.bank_virtual_asset
     ORDER BY indicator_code, reading_date`,
  );
  return rows;
}

/** Un modelo que todavía no existe es un panel vacío que lo dice; lo demás se propaga. */
function emptyOrThrow(error: unknown): BankAssetsBoard {
  const code = (error as { code?: string }).code;
  if (code === '42P01' || code === '42501' || code === '42703') {
    console.warn(`[observatorio] modelo ilegible: read_models.bank_virtual_asset (${code})`);
    return EMPTY_BANK_BOARD;
  }
  throw error;
}
