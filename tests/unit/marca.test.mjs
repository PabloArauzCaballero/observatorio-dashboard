/**
 * La marca no se rompe sola, pero se rompe en cada página nueva: un color
 * escrito a mano, una variable que no existe y cae a un gris de respaldo, un
 * «Observatorio» que vuelve en un texto o un «Elegí…» en voseo. Estas pruebas
 * leen el código fuente (sin importarlo) y fallan en cuanto aparece uno de
 * esos cuatro defectos fuera de los sitios donde están permitidos.
 *
 * Reglas: `docs/estilo/LIBRO-DE-ESTILO.md` y `.claude/skills/tablero-premium`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const SRC = path.join(RAIZ, 'src');

function archivos(dir, exts) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...archivos(p, exts));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(RAIZ, p).replace(/\\/g, '/');
const leer = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** El portal administrativo tiene su propia hoja y no forma parte de la marca pública. */
const esAdmin = (r) => /(^|\/)(admin)(\/|\.css$)/.test(r) || r.includes('/admin/');

/** Sin comentarios (bloque y línea), para no confundir prosa interna con texto visible. */
function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, (m, a) => a + ' '.repeat(m.length - a.length));
}

const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g;

/**
 * Archivos que repiten la paleta a propósito: documentos impresos e imágenes que
 * no heredan las variables CSS, metadatos del navegador y el arte de la marca.
 */
const PALETA_IMPRESA = new Set([
  'src/lib/analysis-pdf.ts',
  'src/lib/pdf-sheet.ts',
  'src/lib/export/informe.ts',
  'src/lib/export/afiche.ts',
  'src/app/layout.tsx',
  'src/app/manifest.ts',
]);

/** Reglas de globals.css que necesitan blanco puro: un QR, logos de terceros, señales viales, impresión. */
const BLANCO_LEGITIMO = [
  '.donate-qr',
  '.company-logo',
  '.roads-map-shield text',
  '.roads-shield',
  '.heat-cell-filled',
  'html, body',
];

test('ningún color se escribe a mano fuera de los tokens', () => {
  const fallos = [];
  for (const f of archivos(SRC, ['.ts', '.tsx', '.css'])) {
    const r = rel(f);
    if (esAdmin(r) || PALETA_IMPRESA.has(r)) continue;
    const texto = sinComentarios(leer(f));
    if (r === 'src/app/globals.css') {
      const pila = [];
      texto.split('\n').forEach((linea, i) => {
        const t = linea.trim();
        if (t.endsWith('{')) pila.push(t.slice(0, -1).trim());
        // Solo declaraciones (`propiedad: valor`): en un selector, `#id` no es un color.
        const esDeclaracion = t.includes(':') && !t.endsWith('{') && !t.endsWith(',');
        const hex = esDeclaracion ? t.match(HEX) : null;
        // Las definiciones de tokens (`--x: #…`) son el único sitio de un color.
        if (hex && !t.startsWith('--')) {
          const selector = pila.at(-1) ?? '';
          if (!BLANCO_LEGITIMO.some((s) => selector.includes(s))) {
            fallos.push(`${r}:${i + 1} ${selector} → ${t}`);
          }
        }
        for (const _ of t.match(/}/g) ?? []) pila.pop();
      });
      continue;
    }
    texto.split('\n').forEach((linea, i) => {
      // El respaldo de un token leído en un lienzo (`read('--x', '#…')`) es legítimo.
      const limpia = linea.replace(/read\(\s*'--[a-z0-9-]+'\s*,\s*'#[0-9a-fA-F]+'\s*\)/g, '');
      if (limpia.match(HEX)) fallos.push(`${r}:${i + 1} → ${linea.trim()}`);
    });
  }
  assert.deepEqual(fallos, [], `Colores literales fuera de los tokens:\n${fallos.join('\n')}`);
});

test('toda variable CSS que se usa existe', () => {
  const definidas = new Set(['--font-gelasio', '--font-libre-franklin']);
  const todos = archivos(SRC, ['.ts', '.tsx', '.css']).filter((f) => !esAdmin(rel(f)));
  for (const f of todos) {
    const texto = leer(f);
    for (const m of texto.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) definidas.add(m[1]);
    // Propiedades puestas desde React: `{ '--board-tone': … }` o `['--map-aspect' as string]: …`.
    for (const m of texto.matchAll(/['"](--[a-zA-Z0-9-]+)['"]\s*(?:[:,\]]|as\b)/g)) definidas.add(m[1]);
    for (const m of texto.matchAll(/setProperty\(\s*['"](--[a-zA-Z0-9-]+)['"]/g)) definidas.add(m[1]);
  }
  const fallos = [];
  for (const f of todos) {
    const texto = sinComentarios(leer(f));
    texto.split('\n').forEach((linea, i) => {
      for (const m of linea.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
        if (!definidas.has(m[1])) fallos.push(`${rel(f)}:${i + 1} usa ${m[1]}, que no existe`);
      }
    });
  }
  assert.deepEqual(fallos, [], `Variables CSS sin definir (caen a su respaldo):\n${fallos.join('\n')}`);
});

/** Cadenas del código: lo que puede acabar en pantalla. */
function cadenas(texto) {
  const out = [];
  const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|>([^<>{}\n]+)</g;
  for (const m of texto.matchAll(re)) out.push({ s: m[1] ?? m[0], i: m.index ?? 0 });
  return out;
}

const lineaDe = (texto, indice) => texto.slice(0, indice).split('\n').length;

test('el nombre del sitio es DatosBolivia.com, no «Observatorio»', () => {
  const fallos = [];
  for (const f of archivos(SRC, ['.ts', '.tsx'])) {
    const r = rel(f);
    if (esAdmin(r) && !r.includes('components/admin')) continue;
    const texto = sinComentarios(leer(f));
    for (const { s, i } of cadenas(texto)) {
      // «observatorio» en minúscula son claves internas (almacenamiento, eventos); el
      // User-Agent de un recolector es un identificador técnico, no texto para el lector.
      if (/Mozilla\/|compatible;/.test(s)) continue;
      if (/Observatorio|OBSERVATORIO/.test(s)) fallos.push(`${r}:${lineaDe(texto, i)} → ${s.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(fallos, [], `Textos que todavía firman como Observatorio:\n${fallos.join('\n')}`);
});

/*
 * El voseo siempre lleva tilde («Elegí», «Tocá»); sin tilde, «Suma» o «Descarga» son
 * sustantivos o tercera persona y no se marcan. Del tuteo solo se marcan las frases
 * que no pueden ser otra cosa que una orden al lector.
 */
const VOSEO =
  /(?<![\p{L}])(Elegí|Tocá|Pasá|Mirá|Buscá|Descargá|Probá|Hacé|Usá|Cambiá|Completá|Revisá|Escribí|Abrí|Quitá|Sumá|Arrastrá|Acotá|Ampliá|podés|tenés|querés|sabés|Preguntale|Elige|Escoge|Haz clic|Pasa el cursor|Toca (?:una|un|el|la|los|las|cualquier))(?![\p{L}])/u;

test('el texto público no tutea ni vosea al lector', () => {
  const fallos = [];
  for (const f of archivos(SRC, ['.tsx', '.ts'])) {
    const r = rel(f);
    // El asistente conversa (su prompt es otra cosa) y el admin es interno.
    if (esAdmin(r) || r.includes('lib/asistente/')) continue;
    const texto = sinComentarios(leer(f));
    for (const { s, i } of cadenas(texto)) {
      if (VOSEO.test(s)) fallos.push(`${r}:${lineaDe(texto, i)} → ${s.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(fallos, [], `Voseo o tuteo en texto público (ver el libro de estilo, §2):\n${fallos.join('\n')}`);
});
