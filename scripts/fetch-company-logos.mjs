/**
 * Baja la marca de cada empresa del monitor de reputación y la deja en `public/logos/`.
 *
 * Se corre a mano cuando entra una edición nueva de Merco o una empresa nueva al
 * catálogo de dominios:
 *
 *   node scripts/fetch-company-logos.mjs            # sólo las que faltan
 *   node scripts/fetch-company-logos.mjs --all      # rehace todas
 *
 * **De dónde sale cada marca.** Del sitio de la propia empresa, que es la única
 * fuente que no hay que creerle a nadie: `scripts/company-domains.json` dice qué
 * dominio es de quién (y con `"logo": false`, qué web sirve un icono que no es
 * la marca: el de WordPress, uno en blanco, el de la empresa madre), y de ese
 * dominio se toma el icono para pantallas de inicio (`apple-touch-icon`,
 * cuadrado y de 180 px), los iconos declarados, el que el buscador de Google ya
 * tiene guardado para ese dominio y, si es cuadrada, la imagen para compartir.
 * Un logotipo apaisado de cabecera no sirve: metido en una baldosa cuadrada de
 * 32 px queda como una raya.
 *
 * **Por qué se guardan y no se enlazan.** Ver `company-logo.tsx`: cien dominios
 * por página son cien conexiones más, y un filtro corporativo que bloquee uno
 * rompe la fila.
 *
 * Todo sale normalizado a 128 × 128 PNG con fondo transparente, y el catálogo
 * `src/lib/company-logos.ts` se reescribe con lo que de verdad hay en disco. De
 * todos los candidatos se queda el de más resolución; uno de menos de 32 px se
 * descarta: ampliado se ve borroso, y unas iniciales limpias informan más que
 * una marca pixelada. Muchas webs bolivianas sólo declaran un `favicon.ico`,
 * así que el `.ico` se abre a mano (sharp no lo lee) y se toma su imagen mayor.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, '$1');
const DOMAINS = join(ROOT, 'scripts', 'company-domains.json');
const OUT = join(ROOT, 'public', 'logos');
const CATALOGUE = join(ROOT, 'src', 'lib', 'company-logos.ts');
const SIZE = 128;
const MIN_SOURCE = 32;
const GOOD_ENOUGH = 128;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const all = process.argv.includes('--all');

async function get(url, timeout = 20_000) {
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`${response.status}`);
  return response;
}

/** Los iconos que la portada declara, del más prometedor al menos. */
function declaredIcons(html, base) {
  const out = [];
  for (const tag of html.match(/<link\b[^>]*>/giu) ?? []) {
    const rel = /\brel\s*=\s*["']?([^"'>]+)/iu.exec(tag)?.[1]?.toLowerCase() ?? '';
    const href = /\bhref\s*=\s*["']?([^"'\s>]+)/iu.exec(tag)?.[1];
    if (!href || !/icon/u.test(rel) || /mask-icon/u.test(rel)) continue;
    const sizes = /\bsizes\s*=\s*["']?(\d+)x(\d+)/iu.exec(tag);
    const size = sizes ? Number(sizes[1]) : /apple-touch/u.test(rel) ? 180 : 0;
    let url;
    try {
      url = new URL(href.replace(/&amp;/gu, '&'), base).href;
    } catch {
      continue;
    }
    const svg = /\.svg(\?|$)/iu.test(url) || /svg/iu.test(tag);
    out.push({ url, score: (/apple-touch/u.test(rel) ? 1000 : 0) + size + (svg ? 600 : 0) });
  }
  return out.sort((left, right) => right.score - left.score).map((icon) => icon.url);
}

/**
 * La imagen mayor de un `.ico`, como algo que sharp sepa abrir: el PNG
 * incrustado tal cual, o el mapa de bits de 32 bits pasado a píxeles crudos.
 */
function fromIco(bytes) {
  if (bytes.length < 6 || bytes.readUInt16LE(0) !== 0 || bytes.readUInt16LE(2) !== 1) return null;
  const count = bytes.readUInt16LE(4);
  let best = null;
  for (let index = 0; index < count; index += 1) {
    const at = 6 + index * 16;
    if (at + 16 > bytes.length) break;
    const side = bytes[at] || 256;
    const size = bytes.readUInt32LE(at + 8);
    const offset = bytes.readUInt32LE(at + 12);
    if (offset + size > bytes.length) continue;
    if (!best || side > best.side) best = { side, data: bytes.subarray(offset, offset + size) };
  }
  if (!best) return null;
  const { data } = best;
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { input: data };
  }
  const width = data.readInt32LE(4);
  const height = Math.abs(data.readInt32LE(8)) / 2;
  const bits = data.readUInt16LE(14);
  if (bits !== 32 || width <= 0 || height <= 0) return null;
  const start = data.readUInt32LE(0);
  const raw = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const source = start + (height - 1 - row) * width * 4;
    for (let column = 0; column < width; column += 1) {
      const from = source + column * 4;
      const to = (row * width + column) * 4;
      raw[to] = data[from + 2];
      raw[to + 1] = data[from + 1];
      raw[to + 2] = data[from];
      raw[to + 3] = data[from + 3];
    }
  }
  return { input: raw, raw: { width, height, channels: 4 } };
}

/**
 * La imagen para compartir de la portada. Sólo cuenta si es cuadrada (ver
 * `normalise`): muchas webs que sólo tienen un favicon de 16 px ponen ahí su
 * marca a 800 px, pero otras ponen una foto o un cartel apaisado.
 */
function shareImage(html, base) {
  const tag = /<meta\b[^>]*og:image["']?\s[^>]*>/iu.exec(html)?.[0];
  const href = tag && /\bcontent\s*=\s*["']([^"']+)/iu.exec(tag)?.[1];
  if (!href) return null;
  try {
    return new URL(href.replace(/&amp;/gu, '&'), base).href;
  } catch {
    return null;
  }
}

/** Una imagen normalizada y el lado de su original, o `null` si no sirve. */
async function normalise(bytes, squareOnly = false) {
  try {
    const ico = fromIco(bytes);
    const image = ico
      ? sharp(ico.input, ico.raw ? { raw: ico.raw } : {})
      : sharp(bytes, { density: 300 });
    const meta = await image.metadata();
    const side = Math.min(meta.width ?? 0, meta.height ?? 0);
    const svg = meta.format === 'svg';
    if (!svg && side < MIN_SOURCE) return null;
    if (squareOnly && Math.max(meta.width ?? 0, meta.height ?? 0) > side * 1.05) return null;
    const png = await image
      .trim({ threshold: 8 })
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return { png, side: svg ? Infinity : side };
  } catch {
    return null;
  }
}

async function logoFor(home, domain) {
  const candidates = [];
  let share = null;
  try {
    const response = await get(home);
    const html = await response.text();
    candidates.push(...declaredIcons(html, response.url));
    candidates.push(new URL('/apple-touch-icon.png', response.url).href);
    share = shareImage(html, response.url);
  } catch {
    candidates.push(`https://${domain}/apple-touch-icon.png`);
  }
  candidates.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`);
  candidates.push(`https://www.google.com/s2/favicons?domain=www.${domain}&sz=256`);
  candidates.push(`https://www.google.com/s2/favicons?domain=https://www.${domain}&sz=256`);
  if (share) candidates.push(share);

  let best = null;
  for (const url of [...new Set(candidates)]) {
    try {
      const response = await get(url, 15_000);
      const type = response.headers.get('content-type') ?? '';
      if (/text\/html/u.test(type)) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      const logo = await normalise(bytes, url === share);
      if (logo && (!best || logo.side > best.side)) best = { ...logo, from: url };
      if (best && best.side >= GOOD_ENOUGH) break;
    } catch {
      /* el siguiente candidato */
    }
  }
  return best;
}

async function main() {
  const domains = JSON.parse(readFileSync(DOMAINS, 'utf-8'));
  mkdirSync(OUT, { recursive: true });
  const present = new Set(readdirSync(OUT).filter((file) => file.endsWith('.png')));

  const jobs = Object.entries(domains).filter(
    ([slug, entry]) =>
      entry?.domain && entry.logo !== false && (all || !present.has(`${slug}.png`)),
  );
  const failed = [];
  let done = 0;
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const [slug, entry] = job;
        const logo = await logoFor(entry.home ?? `https://${entry.domain}/`, entry.domain);
        if (logo) {
          writeFileSync(join(OUT, `${slug}.png`), logo.png);
          done += 1;
        } else {
          failed.push(`${slug} (${entry.domain})`);
        }
      }
    }),
  );

  const files = readdirSync(OUT)
    .filter((file) => file.endsWith('.png'))
    .sort();
  const lines = files.map((file) => {
    const slug = file.slice(0, -4);
    const key = /^[A-Za-z_$][\w$]*$/u.test(slug) ? slug : `'${slug}'`;
    return `  ${key}: '${file}',`;
  });
  writeFileSync(
    CATALOGUE,
    `/**
 * Qué empresas tienen logotipo en \`public/logos/\`, y con qué archivo.
 *
 * Generado por \`scripts/fetch-company-logos.mjs\` a partir de lo que hay en
 * disco: no se edita a mano. Una empresa que no está aquí sale con sus
 * iniciales.
 */
export const COMPANY_LOGOS: Readonly<Record<string, string>> = {
${lines.join('\n')}
};
`,
    'utf-8',
  );

  console.log(`${done} logotipos nuevos, ${files.length} en total, ${failed.length} sin marca`);
  if (failed.length) console.log(`  sin marca: ${failed.join(', ')}`);
  if (!existsSync(CATALOGUE)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
