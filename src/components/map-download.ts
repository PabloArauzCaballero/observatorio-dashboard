'use client';

/**
 * Taking a map away with you.
 *
 * Every other section of this report offers its numbers as a file, and the two
 * maps did not — a reader who wanted the places behind the drawing had to ask
 * for them. These are the two shapes that offer takes: the picture, and the
 * table under it.
 *
 * The picture is drawn from the SVG that is on screen, at the frame the reader
 * has zoomed to, so the file and the figure cannot disagree. Nothing is
 * fetched: the browser rasterises what it already has.
 */

/** The properties a detached SVG needs carried over, because CSS will not be. */
const CARRIED = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linejoin',
  'stroke-linecap',
  'opacity',
] as const;

function handOver(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Freed on a later turn: revoking in the same tick can beat the browser to
  // the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * The SVG on screen, as a PNG the reader can paste into a document.
 *
 * The clone carries its own colours because a serialised SVG has no stylesheet
 * and no custom properties: left alone every path would come out black, which
 * on this page would erase the whole distinction between an administered
 * activity and an ordinary one.
 */
export function downloadSvgAsPng(
  svg: SVGSVGElement,
  { fileName, width = 1800 }: { fileName: string; width?: number },
): void {
  const box = svg.viewBox.baseVal;
  const ratio =
    box && box.width > 0
      ? box.height / box.width
      : svg.clientHeight / Math.max(svg.clientWidth, 1) || 0.72;
  const height = Math.max(Math.round(width * ratio), 1);

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll<SVGElement>('*')];
  const copies = [clone, ...clone.querySelectorAll<SVGElement>('*')];
  for (let index = 0; index < originals.length; index += 1) {
    const source = originals[index];
    const target = copies[index];
    if (!source || !target) continue;
    const computed = getComputedStyle(source);
    let declaration = '';
    for (const property of CARRIED) {
      const value = computed.getPropertyValue(property);
      if (value) declaration += `${property}:${value};`;
    }
    target.setAttribute('style', declaration);
    target.removeAttribute('class');
  }
  // Dropped after the styles are paired off by position, never before: removing
  // a node first would shift every element after it onto the wrong colours.
  // The pointer's own marks are not part of the map — a halo around whatever
  // the cursor happened to be over would sit in the file for ever, looking
  // like a finding.
  for (const mark of clone.querySelectorAll('[data-export="skip"]')) mark.remove();

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const paper =
    getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#ffffff';
  const markup = new XMLSerializer().serializeToString(clone);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    // A transparent PNG dropped on a white slide loses every pale mark on it.
    context.fillStyle = paper;
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (blob) handOver(URL.createObjectURL(blob), `${fileName}.png`);
    }, 'image/png');
  };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

type Cell = string | number | boolean | null | undefined;

/** Quotes a field only when it needs it, as the export route does. */
function csvField(value: Cell): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

/**
 * Rows the page already holds, as a file, without a round trip.
 *
 * The server route exists for the sections whose data lives in the database.
 * What the Bolivia map draws is already in the browser — asking the server for
 * it again would only add a way for the file and the drawing to disagree.
 */
export function downloadRows(
  rows: Array<Record<string, Cell>>,
  { fileName, format }: { fileName: string; format: 'csv' | 'json' },
): void {
  const first = rows[0];
  let body: string;
  let type: string;

  if (format === 'json') {
    body = `${JSON.stringify(
      { generado: new Date().toISOString(), filas: rows.length, datos: rows },
      null,
      2,
    )}\n`;
    type = 'application/json;charset=utf-8';
  } else {
    const headers = first ? Object.keys(first) : [];
    const lines = [headers.join(',')];
    for (const row of rows) lines.push(headers.map((header) => csvField(row[header])).join(','));
    body = `${lines.join('\n')}\n`;
    type = 'text/csv;charset=utf-8';
  }

  handOver(URL.createObjectURL(new Blob([body], { type })), `${fileName}.${format}`);
}
