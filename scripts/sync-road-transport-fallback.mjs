import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const source = process.argv[2];
if (!source) {
  throw new Error(
    'Uso: node scripts/sync-road-transport-fallback.mjs <road-transport.json del nucleo>',
  );
}

const target = resolve('src/data/road-transport.json');
const parsed = JSON.parse(await readFile(resolve(source), 'utf8'));

if (
  !Array.isArray(parsed.sources) ||
  !Array.isArray(parsed.fleetPoints) ||
  !Array.isArray(parsed.gnvPoints) ||
  !Array.isArray(parsed.fareBands)
) {
  throw new Error('La semilla del nucleo no tiene la estructura de transporte esperada');
}

await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(parsed)}\n`, 'utf8');
console.log(
  `Sincronizado ${target}: ${parsed.fleetPoints.length} parque, ` +
    `${parsed.gnvPoints.length} GNV, ${parsed.fareBands.length} tarifas`,
);
