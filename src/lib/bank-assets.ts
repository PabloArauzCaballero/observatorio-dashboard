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
    const { rows } = await pool().query<BankAssetRow>(
      `SELECT indicator_code, bank, bank_name, product, asset, kind, limit_name, unit, note,
              to_char(reading_date, 'YYYY-MM-DD') AS reading_date, value::text, basis, source_url
       FROM read_models.bank_virtual_asset
       ORDER BY indicator_code, reading_date`,
    );
    return buildBankBoard(rows);
  } catch (error) {
    // El tablero se despliega a veces antes que la migración 0089 del núcleo:
    // un modelo que todavía no existe es un panel vacío que lo dice.
    const code = (error as { code?: string }).code;
    if (code === '42P01' || code === '42501' || code === '42703') {
      console.warn(`[observatorio] modelo ilegible: read_models.bank_virtual_asset (${code})`);
      return EMPTY_BANK_BOARD;
    }
    throw error;
  }
}
