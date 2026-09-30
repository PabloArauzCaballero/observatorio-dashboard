/**
 * A CSV reader that understands quoting, because the files do.
 *
 * Counting `split('\n')` would be shorter and would be wrong: an article
 * headline with a comma or a line break in it is one record that looks like
 * two, and a test that counted lines would report the file as longer than it
 * is and pass while the export was broken.
 */
export interface ParsedCsv {
  readonly headers: readonly string[];
  readonly rows: ReadonlyArray<Record<string, string>>;
}

export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === ',') {
      record.push(field);
      field = '';
      continue;
    }
    if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      continue;
    }
    field += character;
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const headers = records.shift() ?? [];
  return {
    headers,
    rows: records
      .filter((entry) => entry.some((value) => value !== ''))
      .map((entry) =>
        Object.fromEntries(headers.map((header, position) => [header, entry[position] ?? ''])),
      ),
  };
}
