/**
 * Recolector de «Clima y ambiente»: el clima, el aire, el fuego y el bosque de
 * Bolivia por departamento, de fuentes abiertas y sin clave.
 *
 *   node scripts/clima/collect-climate.mjs --raw <carpeta-de-descargas>
 *
 * Se corre a mano, no en el build: cada fuente se descarga una vez a la carpeta
 * `--raw` (fuera del repositorio) y se reutiliza en la corrida siguiente, así que
 * repetirlo solo vuelve a pedir lo que falta. Para refrescar una fuente basta con
 * borrar su archivo de la carpeta. Escribe `src/data/clima-*.json`, compactos:
 * series mensuales en listas alineadas desde un mes de inicio, redondeadas.
 *
 * Fuentes (todas abiertas; ninguna pide clave):
 *
 *  1. ERA5 por Open-Meteo (Historical Weather API), diario desde 1971 en las nueve
 *     capitales de departamento: https://archive-api.open-meteo.com/v1/archive
 *     (modelo `era5`, el reanálisis del Centro Europeo de Previsiones Meteorológicas
 *     a Plazo Medio, ECMWF; Copernicus). Se agrega a meses aquí: medias, sumas y
 *     conteos de días extremos.
 *  2. NASA POWER, mensual por rejilla (MERRA-2, 0,5° × 0,625°) desde 1981:
 *     https://power.larc.nasa.gov/api/temporal/monthly/regional — se promedian las
 *     celdas cuyo centro cae dentro de cada departamento (límites de geoBoundaries,
 *     que redistribuye los de geo.gob.bo).
 *  3. CAMS por Open-Meteo (Air Quality API), horario desde agosto de 2022 en las
 *     capitales: https://air-quality-api.open-meteo.com/v1/air-quality
 *  4. NASA FIRMS, archivo anual por país de focos de calor MODIS (colección 6.1),
 *     2001-2025: https://firms.modaps.eosdis.nasa.gov/data/country/ — cada foco se
 *     ubica en su departamento por su coordenada.
 *  5. Global Forest Watch (Hansen/UMD y WRI), pérdida de cobertura arbórea por
 *     departamento, 2001-2025, y alertas MODIS semanales de 2026:
 *     https://data-api.globalforestwatch.org (descargas CSV abiertas).
 *  6. Índice Oceánico El Niño (ONI) de la NOAA:
 *     https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt
 *
 * Nada se rellena: un mes sin dato completo queda `null`.
 */

import { setDefaultResultOrder } from 'node:dns';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setDefaultAutoSelectFamily } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Primero IPv4 y sin carrera de familias: con la carrera por omisión (250 ms por
 * intento) `fetch` abandonaba los servidores de Open-Meteo antes de que el
 * saludo por IPv4 llegara, en una red sin salida IPv6.
 */
setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamily(false);

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../src/data');

const args = process.argv.slice(2);
const rawAt = args.indexOf('--raw');
if (rawAt < 0 || !args[rawAt + 1]) {
  console.error('Uso: node scripts/clima/collect-climate.mjs --raw <carpeta-de-descargas>');
  process.exit(1);
}
const RAW = resolve(args[rawAt + 1]);
mkdirSync(RAW, { recursive: true });

const TODAY = new Date().toISOString().slice(0, 10);

/* ───────────────────────── utilidades ───────────────────────── */

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** Con `--sin-descargar` solo se usa lo que ya está en la carpeta: lo que falte queda fuera. */
const OFFLINE = args.includes('--sin-descargar');

/**
 * Cuánto esperar ante un 429 de Open-Meteo. El plan gratuito cuenta las llamadas
 * por peso (una llamada son 10 variables y 14 días: una serie diaria desde 1971
 * pesa unas 1.400) con topes de 5.000 por hora y 10.000 por día; el mensaje dice
 * cuál se pasó y se espera a que ese tope vuelva a abrir.
 */
function patience(body) {
  const now = new Date();
  if (/hourly/i.test(body)) {
    const next = new Date(now);
    next.setUTCMinutes(61, 0, 0);
    return next.getTime() - now.getTime();
  }
  if (/daily/i.test(body)) {
    const next = new Date(now);
    next.setUTCHours(24, 1, 0, 0);
    return next.getTime() - now.getTime();
  }
  if (/minutely/i.test(body)) return 61_000;
  return 0;
}

/** Descarga con caché en disco y reintentos ante 429 o fallos de red. */
async function cached(name, url, { text = false, tries = 6 } = {}) {
  const path = join(RAW, name);
  if (existsSync(path)) {
    const body = readFileSync(path, 'utf8');
    return text ? body : JSON.parse(body);
  }
  if (OFFLINE) throw Object.assign(new Error(`no descargado: ${name}`), { fatal: true });
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
      if (response.status === 429) {
        const pause = patience(await response.text()) || 60_000 * attempt;
        console.warn(`  429 en ${name}; se espera ${Math.round(pause / 60_000)} min al tope`);
        await wait(pause);
        attempt -= 1; // esperar el tope no gasta un intento
        continue;
      }
      if (response.status >= 500) {
        const pause = 30_000 * attempt;
        console.warn(`  ${response.status} en ${name}; reintento en ${pause / 1000} s`);
        await wait(pause);
        continue;
      }
      if (!response.ok) {
        // Un 4xx es una consulta mal hecha: reintentar no la arregla.
        const error = new Error(`${response.status} ${await response.text()}`);
        error.fatal = true;
        throw error;
      }
      const body = await response.text();
      if (!text) JSON.parse(body); // valida antes de guardar
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, body);
      return text ? body : JSON.parse(body);
    } catch (error) {
      if (error.fatal || attempt === tries) throw error;
      console.warn(`  fallo en ${name} (${error.message}); reintento`);
      await wait(10_000 * attempt);
    }
  }
  throw new Error(`sin respuesta: ${name}`);
}

const round = (value, decimals) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? null
    : Number(value.toFixed(decimals));

const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

/** Los meses entre dos claves AAAA-MM, ambas incluidas. */
function monthsBetween(from, to) {
  const out = [];
  let [year, month] = from.split('-').map(Number);
  const [lastYear, lastMonth] = to.split('-').map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    out.push(monthKey(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

const daysIn = (key) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

/** El último mes completo antes de un día dado (AAAA-MM-DD). */
function lastFullMonth(day) {
  const [year, month, date] = day.split('-').map(Number);
  const complete = date === daysIn(monthKey(year, month));
  if (complete) return monthKey(year, month);
  return month === 1 ? monthKey(year - 1, 12) : monthKey(year, month - 1);
}

function writeData(name, payload) {
  const path = join(OUT, name);
  const body = `${JSON.stringify(payload)}\n`;
  writeFileSync(path, body);
  console.log(`→ ${name}: ${(body.length / 1024).toFixed(0)} KB`);
}

/* ───────────────────────── departamentos ───────────────────────── */

/** Los nueve departamentos con su capital y la coordenada de la ciudad. */
const PLACES = [
  { code: 'CHUQUISACA', dept: 'Chuquisaca', city: 'Sucre', lat: -19.0475, lon: -65.26, gadm: 1 },
  {
    code: 'COCHABAMBA',
    dept: 'Cochabamba',
    city: 'Cochabamba',
    lat: -17.3895,
    lon: -66.1568,
    gadm: 2,
  },
  { code: 'BENI', dept: 'Beni', city: 'Trinidad', lat: -14.8333, lon: -64.9, gadm: 3 },
  { code: 'LA_PAZ', dept: 'La Paz', city: 'La Paz', lat: -16.4955, lon: -68.1336, gadm: 4 },
  { code: 'ORURO', dept: 'Oruro', city: 'Oruro', lat: -17.9647, lon: -67.106, gadm: 5 },
  { code: 'PANDO', dept: 'Pando', city: 'Cobija', lat: -11.0267, lon: -68.7692, gadm: 6 },
  { code: 'POTOSI', dept: 'Potosí', city: 'Potosí', lat: -19.5836, lon: -65.7531, gadm: 7 },
  {
    code: 'SANTA_CRUZ',
    dept: 'Santa Cruz',
    city: 'Santa Cruz de la Sierra',
    lat: -17.7833,
    lon: -63.1821,
    gadm: 8,
  },
  { code: 'TARIJA', dept: 'Tarija', city: 'Tarija', lat: -21.5355, lon: -64.7296, gadm: 9 },
];
const CODES = PLACES.map((place) => place.code);

/** Nombre del límite de geoBoundaries → código del tablero. */
const BOUNDARY_CODE = {
  Beni: 'BENI',
  Chuquisaca: 'CHUQUISACA',
  Cochabamba: 'COCHABAMBA',
  'La Paz': 'LA_PAZ',
  Oruro: 'ORURO',
  Pando: 'PANDO',
  Potosí: 'POTOSI',
  'Santa Cruz': 'SANTA_CRUZ',
  Tarija: 'TARIJA',
};

const ADM1_URL =
  'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BOL/ADM1/geoBoundaries-BOL-ADM1_simplified.geojson';

async function loadDepartments() {
  const geo = await cached('adm1-simple.geojson', ADM1_URL);
  return geo.features.map((feature) => {
    const code = BOUNDARY_CODE[feature.properties.shapeName];
    if (!code) throw new Error(`departamento desconocido: ${feature.properties.shapeName}`);
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    const rings = polygons.flat(1);
    const all = rings.flat();
    return {
      code,
      rings,
      box: [
        Math.min(...all.map((p) => p[0])),
        Math.min(...all.map((p) => p[1])),
        Math.max(...all.map((p) => p[0])),
        Math.max(...all.map((p) => p[1])),
      ],
    };
  });
}

/** Par-impar sobre todos los anillos: los huecos quedan fuera solos. */
function insideRings(lon, lat, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
  }
  return inside;
}

function locator(departments) {
  const memo = new Map();
  return (lon, lat) => {
    const key = `${lon.toFixed(3)}|${lat.toFixed(3)}`;
    if (memo.has(key)) return memo.get(key);
    let found = null;
    for (const department of departments) {
      const [x0, y0, x1, y1] = department.box;
      if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue;
      if (insideRings(lon, lat, department.rings)) {
        found = department.code;
        break;
      }
    }
    memo.set(key, found);
    return found;
  };
}

/* ───────────────────────── 1. ERA5 en las capitales ───────────────────────── */

const ERA5_DAILY = [
  'temperature_2m_mean',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'et0_fao_evapotranspiration',
  'shortwave_radiation_sum',
  'relative_humidity_2m_mean',
  'soil_moisture_0_to_100cm_mean',
  'wind_speed_10m_max',
];

async function collectEra5() {
  console.log('ERA5 (Open-Meteo) en las capitales…');
  /*
   * Desde 1971 y no desde 1950: con el tope gratuito de Open-Meteo (10.000 llamadas
   * de peso al día) las nueve capitales desde 1950 no caben en un día; desde 1971
   * sí, y siguen siendo 55 años, con la normal 1991-2020 entera y diez años más
   * que NASA POWER.
   */
  const start = '1971-01-01';
  const out = {};
  const grid = {};
  const missing = [];
  let lastDay = null;
  for (const place of PLACES) {
    const url =
      'https://archive-api.open-meteo.com/v1/archive' +
      `?latitude=${place.lat}&longitude=${place.lon}&start_date=${start}&end_date=${TODAY}` +
      `&daily=${ERA5_DAILY.join(',')}&timezone=America%2FLa_Paz&models=era5`;
    let body;
    try {
      // Una descarga anterior desde 1950 sirve igual: se recorta abajo.
      const longer = `era5-${place.code}-${TODAY.slice(0, 7)}.json`;
      body = existsSync(join(RAW, longer))
        ? await cached(longer, url)
        : await cached(`era5-${place.code}-1971-${TODAY.slice(0, 7)}.json`, url);
    } catch (error) {
      if (!OFFLINE) throw error;
      missing.push(place.code);
      continue;
    }
    const daily = body.daily;
    // El último día con temperatura es el último del reanálisis (ERA5T, unos 5 días de rezago).
    let last = daily.time.length - 1;
    while (last > 0 && daily.temperature_2m_mean[last] === null) last -= 1;
    const placeLast = daily.time[last];
    lastDay = lastDay === null || placeLast < lastDay ? placeLast : lastDay;
    grid[place.code] = { lat: body.latitude, lon: body.longitude, elev: body.elevation };

    const byMonth = new Map();
    for (let i = 0; i <= last; i += 1) {
      const key = daily.time[i].slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(i);
    }
    out[place.code] = { byMonth, daily };
  }

  const end = lastFullMonth(lastDay);
  const months = monthsBetween(start.slice(0, 7), end);
  const series = {};
  for (const place of PLACES) {
    if (!out[place.code]) continue;
    const { byMonth, daily } = out[place.code];
    const pick = (name, days) => days.map((i) => daily[name][i]);
    const s = {
      t: [],
      tx: [],
      tn: [],
      p: [],
      rx: [],
      r20: [],
      d35: [],
      d30: [],
      fr: [],
      et0: [],
      rad: [],
      rh: [],
      sm: [],
      w: [],
    };
    for (const key of months) {
      const days = byMonth.get(key) ?? [];
      const full = days.length === daysIn(key);
      const columns = Object.fromEntries(ERA5_DAILY.map((name) => [name, pick(name, days)]));
      const ok = (name) => full && columns[name].every((value) => value !== null);
      const mean = (name, decimals) =>
        ok(name) ? round(columns[name].reduce((a, b) => a + b, 0) / days.length, decimals) : null;
      const sum = (name, decimals) =>
        ok(name)
          ? round(
              columns[name].reduce((a, b) => a + b, 0),
              decimals,
            )
          : null;
      const count = (name, test) => (ok(name) ? columns[name].filter(test).length : null);
      s.t.push(mean('temperature_2m_mean', 2));
      s.tx.push(mean('temperature_2m_max', 2));
      s.tn.push(mean('temperature_2m_min', 2));
      s.p.push(sum('precipitation_sum', 1));
      s.rx.push(ok('precipitation_sum') ? round(Math.max(...columns.precipitation_sum), 1) : null);
      s.r20.push(count('precipitation_sum', (value) => value >= 20));
      s.d35.push(count('temperature_2m_max', (value) => value > 35));
      s.d30.push(count('temperature_2m_max', (value) => value > 30));
      s.fr.push(count('temperature_2m_min', (value) => value < 0));
      s.et0.push(sum('et0_fao_evapotranspiration', 0));
      s.rad.push(mean('shortwave_radiation_sum', 1));
      s.rh.push(mean('relative_humidity_2m_mean', 0));
      s.sm.push(mean('soil_moisture_0_to_100cm_mean', 3));
      s.w.push(mean('wind_speed_10m_max', 1));
    }
    series[place.code] = s;
  }
  writeData('clima-capitales.json', {
    fuente: {
      nombre: 'ERA5 (Copernicus / ECMWF), servido por Open-Meteo Historical Weather API',
      url: 'https://archive-api.open-meteo.com/v1/archive',
      nota: 'Reanálisis diario a 0,25° (unos 28 km), ajustado a la altura de la ciudad por Open-Meteo; agregado a meses por DatosBolivia.com.',
    },
    consultado: TODAY,
    inicio: start.slice(0, 7),
    fin: end,
    ultimoDia: lastDay,
    ...(missing.length ? { faltan: missing } : {}),
    lugares: PLACES.filter((place) => out[place.code]).map((place) => ({
      code: place.code,
      dept: place.dept,
      city: place.city,
      lat: place.lat,
      lon: place.lon,
      grid: grid[place.code],
    })),
    series,
  });
}

/* ───────────────────────── 2. NASA POWER por departamento ───────────────────────── */

const POWER_PARAMS = [
  ['T2M', 't', 2],
  ['T2M_MAX', 'tx', 1],
  ['T2M_MIN', 'tn', 1],
  ['PRECTOTCORR', 'p', 1],
  ['FROST_DAYS', 'fr', 1],
  ['RH2M', 'rh', 1],
  ['ALLSKY_SFC_SW_DWN', 'rad', 2],
  ['WS2M', 'w', 2],
  ['GWETROOT', 'sm', 3],
];

/** Cuatro cajas que cubren Bolivia sobre la rejilla de POWER (0,5° × 0,625°). */
const POWER_BOXES = [
  { id: 'so', lat: [-23, -16.5], lon: [-70, -63.75] },
  { id: 'se', lat: [-23, -16.5], lon: [-63.125, -57.5] },
  { id: 'no', lat: [-16, -9.5], lon: [-70, -63.75] },
  { id: 'ne', lat: [-16, -9.5], lon: [-63.125, -57.5] },
];

async function collectPower(departments) {
  console.log('NASA POWER por rejilla…');
  const locate = locator(departments);
  const endYear = Number(TODAY.slice(0, 4));
  const cells = {}; // código → [clave de celda]
  const values = {}; // parámetro → clave de celda → { AAAAMM: valor }
  for (const [param] of POWER_PARAMS) {
    values[param] = {};
    for (const box of POWER_BOXES) {
      const url =
        'https://power.larc.nasa.gov/api/temporal/monthly/regional' +
        `?latitude-min=${box.lat[0]}&latitude-max=${box.lat[1]}` +
        `&longitude-min=${box.lon[0]}&longitude-max=${box.lon[1]}` +
        `&parameters=${param}&community=AG&start=1981&end=${endYear}&format=JSON`;
      const body = await cached(`power-${param}-${box.id}-${TODAY.slice(0, 7)}.json`, url);
      for (const feature of body.features) {
        const [lon, lat] = feature.geometry.coordinates;
        const key = `${lon}|${lat}`;
        values[param][key] = feature.properties.parameter[param];
        if (param === 'T2M') {
          const code = locate(lon, lat);
          if (code) (cells[code] ??= new Set()).add(key);
        }
      }
    }
  }
  // El último mes con temperatura en todas las celdas.
  const sample = Object.values(values.T2M)[0];
  const keys = Object.keys(sample)
    .filter((key) => !key.endsWith('13') && sample[key] !== -999)
    .sort();
  const end = `${keys.at(-1).slice(0, 4)}-${keys.at(-1).slice(4)}`;
  const months = monthsBetween('1981-01', end);

  const series = {};
  for (const code of CODES) {
    const inside = [...(cells[code] ?? [])];
    if (!inside.length) throw new Error(`sin celdas de POWER en ${code}`);
    const s = {};
    for (const [param, short, decimals] of POWER_PARAMS) {
      s[short] = months.map((key) => {
        const stamp = key.replace('-', '');
        const readings = inside.map((cell) => values[param][cell]?.[stamp]);
        if (readings.some((value) => value === undefined || value === null || value === -999))
          return null;
        let mean = readings.reduce((a, b) => a + b, 0) / readings.length;
        if (param === 'PRECTOTCORR') mean *= daysIn(key); // mm/día → mm en el mes
        if (param === 'GWETROOT') return round(mean, 3);
        return round(mean, decimals);
      });
    }
    series[code] = s;
  }
  // Para cotejar con ERA5: la celda de POWER donde cae cada capital.
  const capital = {};
  for (const place of PLACES) {
    let best = null;
    for (const key of Object.keys(values.T2M)) {
      const [lon, lat] = key.split('|').map(Number);
      const distance = Math.hypot(lon - place.lon, lat - place.lat);
      if (!best || distance < best.distance) best = { key, distance };
    }
    capital[place.code] = months.map((key) => {
      const value = values.T2M[best.key]?.[key.replace('-', '')];
      return value === undefined || value === -999 ? null : round(value, 2);
    });
  }
  writeData('clima-departamentos.json', {
    fuente: {
      nombre: 'NASA POWER (Prediction Of Worldwide Energy Resources), con MERRA-2 y CERES',
      url: 'https://power.larc.nasa.gov/api/temporal/monthly/regional',
      nota: 'Promedio de las celdas de 0,5° × 0,625° cuyo centro cae dentro del departamento; cálculo de DatosBolivia.com.',
    },
    limites: { nombre: 'geoBoundaries gbOpen (geo.gob.bo), versión 9469f09', url: ADM1_URL },
    consultado: TODAY,
    inicio: '1981-01',
    fin: end,
    celdas: Object.fromEntries(CODES.map((code) => [code, cells[code].size])),
    series,
    capitalT: capital,
  });
}

/* ───────────────────────── 3. Aire (CAMS) ───────────────────────── */

async function collectAir() {
  console.log('Calidad del aire (CAMS, Open-Meteo)…');
  const start = '2022-09-01';
  const series = {};
  let end = null;
  const raw = {};
  for (const place of PLACES) {
    const url =
      'https://air-quality-api.open-meteo.com/v1/air-quality' +
      `?latitude=${place.lat}&longitude=${place.lon}&start_date=${start}&end_date=${TODAY}` +
      '&hourly=pm2_5,pm10,carbon_monoxide,aerosol_optical_depth&timezone=America%2FLa_Paz&domains=cams_global';
    const body = await cached(`cams-${place.code}-${TODAY.slice(0, 7)}.json`, url);
    raw[place.code] = body.hourly;
    let last = body.hourly.time.length - 1;
    while (last > 0 && body.hourly.pm2_5[last] === null) last -= 1;
    const day = body.hourly.time[last].slice(0, 10);
    end = end === null || day < end ? day : end;
  }
  const lastMonth = lastFullMonth(end);
  const months = monthsBetween('2022-09', lastMonth);
  for (const place of PLACES) {
    const hourly = raw[place.code];
    const days = new Map(); // día → índices de hora
    hourly.time.forEach((stamp, i) => {
      const day = stamp.slice(0, 10);
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(i);
    });
    const dailyMean = (name, idx) => {
      const values = idx.map((i) => hourly[name][i]).filter((value) => value !== null);
      return values.length >= 18 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };
    const s = { pm25: [], pm10: [], co: [], aod: [], d15: [], pmx: [] };
    for (const key of months) {
      const inMonth = [...days.entries()].filter(([day]) => day.startsWith(key));
      const pm25 = inMonth.map(([, idx]) => dailyMean('pm2_5', idx));
      const full = inMonth.length === daysIn(key) && pm25.every((value) => value !== null);
      const monthMean = (name, decimals) => {
        if (!full) return null;
        const values = inMonth.map(([, idx]) => dailyMean(name, idx));
        if (values.some((value) => value === null)) return null;
        return round(values.reduce((a, b) => a + b, 0) / values.length, decimals);
      };
      s.pm25.push(monthMean('pm2_5', 1));
      s.pm10.push(monthMean('pm10', 1));
      s.co.push(monthMean('carbon_monoxide', 0));
      s.aod.push(monthMean('aerosol_optical_depth', 3));
      s.d15.push(full ? pm25.filter((value) => value > 15).length : null);
      s.pmx.push(full ? round(Math.max(...pm25), 1) : null);
    }
    series[place.code] = s;
  }
  writeData('clima-aire.json', {
    fuente: {
      nombre:
        'Servicio de Vigilancia Atmosférica de Copernicus (CAMS), modelo global, servido por Open-Meteo Air Quality API',
      url: 'https://air-quality-api.open-meteo.com/v1/air-quality',
      nota: 'Modelo de pronóstico y análisis a unos 45 km, no medición de estación; promedios diarios y mensuales de DatosBolivia.com.',
    },
    consultado: TODAY,
    inicio: '2022-09',
    fin: lastMonth,
    series,
  });
}

/* ───────────────────────── 4 y 5. Fuego y bosque ───────────────────────── */

const GFW = 'https://data-api.globalforestwatch.org/dataset';
const GFW_TCL_VERSION = 'v20260424';
const GFW_FIRE_VERSION = 'v20251202';

const sql = (text) => encodeURIComponent(text.replace(/\s+/g, ' ').trim());

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map((cell) => cell.replace(/"/g, ''));
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((cell) => cell.replace(/"/g, ''));
    return Object.fromEntries(header.map((name, i) => [name, cells[i]]));
  });
}

const GADM_CODE = Object.fromEntries(PLACES.map((place) => [String(place.gadm), place.code]));

const DRIVERS = {
  'Permanent agriculture': 'agricultura',
  Wildfire: 'incendio',
  'Other natural disturbances': 'natural',
  'Shifting cultivation': 'rotativa',
  Logging: 'tala',
  'Hard commodities': 'mineria',
  'Settlements & Infrastructure': 'asentamientos',
  Unknown: 'desconocido',
};

async function collectFireAndForest(departments) {
  console.log('Focos de calor (FIRMS) y bosque (GFW)…');
  const locate = locator(departments);
  const firstYear = 2001;
  const lastYear = 2025;
  const counts = Object.fromEntries(CODES.map((code) => [code, new Map()]));
  let outside = 0;
  let total = 0;
  for (let year = firstYear; year <= lastYear; year += 1) {
    const text = await cached(
      join('firms', `modis_${year}.csv`),
      `https://firms.modaps.eosdis.nasa.gov/data/country/modis/${year}/modis_${year}_Bolivia.csv`,
      { text: true },
    );
    const lines = text.split(/\r?\n/);
    const header = lines[0].split(',');
    const at = (name) => header.indexOf(name);
    const [iLat, iLon, iDate, iType] = [
      at('latitude'),
      at('longitude'),
      at('acq_date'),
      at('type'),
    ];
    for (let i = 1; i < lines.length; i += 1) {
      if (!lines[i]) continue;
      const cells = lines[i].split(',');
      if (iType >= 0 && cells[iType] !== '0') continue; // 0 = presunto incendio de vegetación
      total += 1;
      const code = locate(Number(cells[iLon]), Number(cells[iLat]));
      if (!code) {
        outside += 1;
        continue;
      }
      const key = cells[iDate].slice(0, 7);
      counts[code].set(key, (counts[code].get(key) ?? 0) + 1);
    }
  }
  console.log(`  focos de vegetación: ${total}; fuera de los límites departamentales: ${outside}`);
  const months = monthsBetween(`${firstYear}-01`, `${lastYear}-12`);
  const fires = Object.fromEntries(
    CODES.map((code) => [code, months.map((key) => counts[code].get(key) ?? 0)]),
  );

  // 2026: alertas MODIS semanales de GFW (las mismas detecciones de FIRMS, contadas por semana).
  const weekly = parseCsv(
    await cached(
      `gfw-modis-weekly-${TODAY.slice(0, 7)}.csv`,
      `${GFW}/gadm__modis__adm1_weekly_alerts/${GFW_FIRE_VERSION}/download/csv?sql=${sql(`
        SELECT adm1, alert__year, alert__week, SUM(alert__count) AS n FROM data
        WHERE iso = 'BOL' AND alert__year >= 2025 GROUP BY adm1, alert__year, alert__week`)}`,
      { text: true },
    ),
  );
  const check = Object.fromEntries(CODES.map((code) => [code, { firms: 0, gfw: 0 }]));
  for (const code of CODES) check[code].firms = fires[code].slice(-12).reduce((a, b) => a + b, 0);
  let lastWeek = 0;
  const weeks = { 2025: {}, 2026: {} };
  for (const year of ['2025', '2026']) for (const code of CODES) weeks[year][code] = [];
  for (const row of weekly) {
    const code = GADM_CODE[row.adm1];
    if (!code || !weeks[row.alert__year]) continue;
    const n = Number(row.n);
    const week = Number(row.alert__week);
    if (row.alert__year === '2025') check[code].gfw += n;
    if (row.alert__year === '2026') lastWeek = Math.max(lastWeek, week);
    weeks[row.alert__year][code][week - 1] = (weeks[row.alert__year][code][week - 1] ?? 0) + n;
  }
  for (const year of ['2025', '2026']) {
    const length = year === '2026' ? lastWeek : 53;
    for (const code of CODES) {
      weeks[year][code] = Array.from({ length }, (_, i) => weeks[year][code][i] ?? 0);
    }
  }
  console.log('  cotejo 2025 FIRMS vs GFW:', JSON.stringify(check));

  // Pérdida de cobertura arbórea (≥ 30 % de copa en 2000), por departamento y año.
  const tcl = async (name, select, where = '') =>
    parseCsv(
      await cached(
        `gfw-tcl-${name}.csv`,
        `${GFW}/gadm__tcl__adm1_change/${GFW_TCL_VERSION}/download/csv?sql=${sql(`
          SELECT adm1, umd_tree_cover_loss__year AS y, ${select} FROM data
          WHERE iso = 'BOL' AND umd_tree_cover_density_2000__threshold = 30 ${where}
          GROUP BY adm1, umd_tree_cover_loss__year${name === 'drivers' ? ', wri_google_tree_cover_loss_drivers__driver' : ''}`)}`,
        { text: true },
      ),
    );
  const loss = await tcl(
    'loss',
    'SUM(umd_tree_cover_loss__ha) AS loss, SUM(umd_tree_cover_loss_from_fires__ha) AS fire, SUM("gfw_gross_emissions_co2e_all_gases__Mg") AS co2',
  );
  const primary = await tcl(
    'primary',
    'SUM(umd_tree_cover_loss__ha) AS loss',
    'AND is__umd_regional_primary_forest_2001 = true',
  );
  const drivers = await tcl(
    'drivers',
    'wri_google_tree_cover_loss_drivers__driver AS driver, SUM(umd_tree_cover_loss__ha) AS loss',
  );
  const extent = parseCsv(
    await cached(
      'gfw-tcl-extent.csv',
      `${GFW}/gadm__tcl__adm1_summary/${GFW_TCL_VERSION}/download/csv?sql=${sql(`
        SELECT adm1, SUM(umd_tree_cover_extent_2000__ha) AS extent FROM data
        WHERE iso = 'BOL' AND umd_tree_cover_density_2000__threshold = 30 GROUP BY adm1`)}`,
      { text: true },
    ),
  );
  const years = [];
  for (let year = 2001; year <= 2025; year += 1) years.push(year);
  const blank = () => Object.fromEntries(CODES.map((code) => [code, years.map(() => 0)]));
  const forest = { perdida: blank(), porFuego: blank(), primario: blank(), emisiones: blank() };
  const causes = Object.fromEntries(
    CODES.map((code) => [
      code,
      Object.fromEntries(Object.values(DRIVERS).map((id) => [id, years.map(() => 0)])),
    ]),
  );
  const yearAt = (row) => years.indexOf(Number(row.y));
  for (const row of loss) {
    const code = GADM_CODE[row.adm1];
    const i = yearAt(row);
    if (!code || i < 0) continue;
    forest.perdida[code][i] = Math.round(Number(row.loss));
    forest.porFuego[code][i] = Math.round(Number(row.fire));
    forest.emisiones[code][i] = round(Number(row.co2) / 1e6, 2); // Mt de CO2e
  }
  for (const row of primary) {
    const code = GADM_CODE[row.adm1];
    const i = yearAt(row);
    if (code && i >= 0) forest.primario[code][i] = Math.round(Number(row.loss));
  }
  for (const row of drivers) {
    const code = GADM_CODE[row.adm1];
    const i = yearAt(row);
    const id = DRIVERS[row.driver];
    if (code && i >= 0 && id) causes[code][id][i] += Math.round(Number(row.loss));
  }
  const cover = Object.fromEntries(
    extent
      .map((row) => [GADM_CODE[row.adm1], Math.round(Number(row.extent))])
      .filter(([code]) => code),
  );

  writeData('clima-fuego-bosque.json', {
    focos: {
      fuente: {
        nombre:
          'NASA FIRMS, archivo anual por país (MODIS colección 6.1, presuntos incendios de vegetación)',
        url: 'https://firms.modaps.eosdis.nasa.gov/data/country/',
      },
      inicio: `${firstYear}-01`,
      fin: `${lastYear}-12`,
      series: fires,
      fueraDeLimites: outside,
    },
    focos2026: {
      fuente: {
        nombre:
          'Global Forest Watch, alertas de incendio MODIS por semana (versión ' +
          GFW_FIRE_VERSION +
          ')',
        url: `${GFW}/gadm__modis__adm1_weekly_alerts`,
      },
      semanas: weeks,
      ultimaSemana: lastWeek,
      cotejo2025: check,
    },
    bosque: {
      fuente: {
        nombre:
          'Global Forest Watch: pérdida de cobertura arbórea de Hansen/UMD (copa ≥ 30 %), causas de WRI y Google, emisiones de Harris et al.',
        url: `${GFW}/gadm__tcl__adm1_change/${GFW_TCL_VERSION}`,
      },
      anios: years,
      cobertura2000: cover,
      ...forest,
      causas: causes,
    },
    consultado: TODAY,
  });
}

/* ───────────────────────── 6. ONI ───────────────────────── */

const SEASON_MONTH = {
  DJF: 1,
  JFM: 2,
  FMA: 3,
  MAM: 4,
  AMJ: 5,
  MJJ: 6,
  JJA: 7,
  JAS: 8,
  ASO: 9,
  SON: 10,
  OND: 11,
  NDJ: 12,
};

async function collectOni() {
  console.log('ONI (NOAA)…');
  const text = await cached(
    `oni-${TODAY.slice(0, 7)}.txt`,
    'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
    {
      text: true,
    },
  );
  const values = new Map();
  for (const line of text.split(/\r?\n/).slice(1)) {
    const [season, year, , anomaly] = line.trim().split(/\s+/);
    if (!SEASON_MONTH[season]) continue;
    values.set(monthKey(Number(year), SEASON_MONTH[season]), Number(anomaly));
  }
  const keys = [...values.keys()].sort();
  const months = monthsBetween(keys[0], keys.at(-1));
  writeData('clima-oni.json', {
    fuente: {
      nombre: 'NOAA, Centro de Predicción del Clima (CPC): Índice Oceánico El Niño (ONI, ERSST v5)',
      url: 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
      nota: 'Media móvil de tres meses; cada valor se fecha en el mes central del trimestre.',
    },
    consultado: TODAY,
    inicio: keys[0],
    fin: keys.at(-1),
    valores: months.map((key) => (values.has(key) ? values.get(key) : null)),
  });
}

/* ───────────────────────── todo ───────────────────────── */

const departments = await loadDepartments();
await collectOni();
await collectAir();
await collectFireAndForest(departments);
await collectPower(departments);
await collectEra5();
console.log('Listo.');
