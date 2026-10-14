/*
 * Una tabla en el tablero público es una decisión, no un descuido.
 *
 * Pasó una y otra vez: una página nueva llegaba con su serie de precios, su ránking o su desglose
 * en una tabla —«Carburantes» fue el caso más claro— cuando un gráfico se lee de un vistazo. La
 * regla del proyecto (`.claude/skills/tablero-premium/SKILL.md › «Tablas → gráficos»`): una serie,
 * un ránking o un desglose se dibujan y la tabla queda a un clic dentro del mismo panel
 * (`ViewToggle`). Solo un registro —texto, enlaces, normas, catálogos— se queda tabla.
 *
 * Esta prueba lo vuelve mecánico: un componente público con `<table` tiene que usar `ViewToggle`
 * o estar en la lista de abajo, **con su razón**. Agregar una tabla nueva sin decidirlo rompe aquí.
 *
 * Correr con: node --test tests/unit/tablas-y-graficos.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const DIRECTORIO = new URL('../../src/components/', import.meta.url);

/** Componentes que siguen mostrando una tabla, y por qué es correcto. */
const REGISTROS = {
  'accounts-norms.tsx': 'normas con su enlace y texto, y aranceles de pares «antes → ahora»',
  'asistente.tsx': 'la tabla que el chat devuelve al lector, no un panel del informe',
  'bank-assets-section.tsx': 'registro de bancos con enlace a su fuente',
  'bcb-section.tsx': 'catálogo de series del BCB con el botón «Elegir»',
  'business-directory-panel.tsx': 'directorio nominal de empresas',
  'city-places-explorer.tsx': 'registro de lugares, paginado, con enlace al mapa',
  'company-social-table.tsx': 'cuentas por empresa: ordenable, con enlaces y estados de lectura',
  'departments-explorer.tsx':
    '«Las seis cuentas regionales»: cada fila en su propia unidad, y la tabla es la comparación con el país',
  'freight-references.tsx': 'citas de tarifas con texto y fuente enlazada por fila',
  'macro-analysis.tsx': 'años atípicos de una serie: una o dos filas, un gráfico quedaría vacío',
  'macro-explorer.tsx':
    'estadísticos con minigráficos por fila y la tabla de observaciones de cada tarjeta',
  'sources-explorer.tsx': 'catálogo de fuentes del Método, con enlaces',
  'trade-records-panels.tsx': 'el ránking ya trae su propio selector Barras/Tabla',
  'transport-prices-explorer.tsx':
    'arma las tablas que `transport-prices-views.tsx` envuelve en ViewToggle (gráfico primero); los detalles por versión y tarifario son registros con enlace o resolución',
};

/** Se revisa solo lo público: el portal de administración tiene sus propias tablas de datos. */
const archivos = readdirSync(DIRECTORIO, { withFileTypes: true })
  .filter((entrada) => entrada.isFile() && entrada.name.endsWith('.tsx'))
  .map((entrada) => entrada.name);

const conTabla = archivos.filter((nombre) =>
  readFileSync(new URL(nombre, DIRECTORIO), 'utf8').includes('<table'),
);
const usaVistas = (nombre) =>
  readFileSync(new URL(nombre, DIRECTORIO), 'utf8').includes('ViewToggle');

test('toda tabla del tablero público se decidió: gráfico con la tabla a un clic, o registro', () => {
  const sinDecidir = conTabla.filter((nombre) => !usaVistas(nombre) && !(nombre in REGISTROS));
  assert.deepEqual(
    sinDecidir,
    [],
    `Estos componentes dibujan una tabla sin ViewToggle y no están en REGISTROS: ${sinDecidir.join(', ')}.\n` +
      'Si es una serie, un ránking o un desglose: dibújalo (charts.tsx) y deja la tabla a un clic con ViewToggle.\n' +
      'Si es un registro (texto, enlaces, catálogo): agrégalo a REGISTROS en esta prueba con su razón.',
  );
});

test('la lista de registros no guarda archivos que ya no existen ni que ya usan ViewToggle', () => {
  for (const nombre of Object.keys(REGISTROS)) {
    assert.ok(archivos.includes(nombre), `${nombre} ya no existe: quítalo de REGISTROS`);
    assert.ok(conTabla.includes(nombre), `${nombre} ya no dibuja una tabla: quítalo de REGISTROS`);
  }
});
