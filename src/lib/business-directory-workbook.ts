import type { Writable } from 'node:stream';
import ExcelJS from 'exceljs';
import type { BusinessDirectoryMeta, BusinessDirectoryRow } from './business-directory-contract';

function validateExport(rows: readonly BusinessDirectoryRow[], meta: BusinessDirectoryMeta): void {
  if (rows.length === 0) throw new Error('La selección no contiene empresas para exportar');
  if (!meta.redistributable) throw new Error('La redistribución no está autorizada para esta fuente');
}

/** Escribe un XLSX auténtico y documentado sin cargar sus bytes completos en memoria. */
export async function writeBusinessDirectoryWorkbook(
  stream: Writable,
  rows: readonly BusinessDirectoryRow[],
  meta: BusinessDirectoryMeta,
): Promise<void> {
  validateExport(rows, meta);
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream,
    useStyles: true,
    useSharedStrings: true,
  });
  workbook.creator = 'Observatorio Económico y de Mercados de Bolivia';
  workbook.created = new Date();

  const companies = workbook.addWorksheet('Empresas', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });
  companies.columns = [
    { header: 'Identificador de registro', key: 'registrationId', width: 24 },
    { header: 'Nombre', key: 'name', width: 42 },
    { header: 'Departamento', key: 'department', width: 18 },
    { header: 'Municipio', key: 'municipality', width: 24 },
    { header: 'Dirección declarada', key: 'address', width: 46 },
    { header: 'Categoría disponible', key: 'activity', width: 30 },
    { header: 'Fecha de corte', key: 'cutDate', width: 22 },
    { header: 'Licencia / condición de uso', key: 'licence', width: 46 },
    { header: 'Clave técnica', key: 'placeId', width: 34 },
  ];
  companies.autoFilter = 'A1:I1';
  const header = companies.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF264653' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 30;
  header.commit();

  for (const company of rows) {
    const row = companies.addRow(company);
    row.getCell(1).numFmt = '@';
    row.alignment = { vertical: 'top', wrapText: true };
    row.commit();
  }
  companies.commit();

  const metadata = workbook.addWorksheet('Metadatos', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });
  metadata.columns = [
    { header: 'Campo', key: 'field', width: 34 },
    { header: 'Valor', key: 'value', width: 100 },
  ];
  const metadataHeader = metadata.getRow(1);
  metadataHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  metadataHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF264653' } };
  metadataHeader.commit();
  const metadataRows: Array<[string, string | number]> = [
    ['Cobertura', meta.coverage],
    ['Filas incluidas', rows.length],
    ['Registros disponibles en el Observatorio', meta.availableRecords],
    ['Publicador', meta.publisher],
    ['Fuente', meta.sourceUrl],
    ['Fecha de corte disponible', meta.cutDate ?? 'No declarada por la fuente'],
    ['Licencia / condición de uso', meta.licence],
    ['Base oficial completa', meta.officialFullDatabaseUrl],
    ['Nota metodológica', meta.note],
  ];
  for (const [field, value] of metadataRows) metadata.addRow({ field, value }).commit();
  metadata.commit();

  await workbook.commit();
}
