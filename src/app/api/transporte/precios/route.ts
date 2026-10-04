import { NextRequest, NextResponse } from 'next/server';
import fuels from '@/data/fuel-prices.json';
import fares from '@/data/passenger-fares.json';
import { readVehiclePrices } from '@/lib/vehicle-prices';

/** Public, versioned snapshots behind the three price views. Source URLs stay in each row. */
export async function GET(request: NextRequest) {
  const dataset = request.nextUrl.searchParams.get('conjunto');
  const vehicleRead = dataset === 'vehiculos' ? await readVehiclePrices() : null;
  const rows = vehicleRead?.rows ?? (dataset === 'carburantes' ? fuels : dataset === 'pasajes' ? fares : null);
  if (!rows) return NextResponse.json({ error: 'Elegí vehiculos, carburantes o pasajes.' }, { status: 400 });
  const observedAt = dataset === 'vehiculos'
    ? vehicleRead?.rows.reduce((latest, row) => row.observedAt > latest ? row.observedAt : latest, '') ?? ''
    : '2026-10-03';
  if (request.nextUrl.searchParams.get('formato') === 'csv') {
    const records = rows as Record<string, unknown>[];
    const columns = Object.keys(records[0] ?? {});
    const safe = (value: unknown) => {
      const text = value == null ? '' : String(value);
      const neutral = /^[=+@\-]/.test(text) ? `'${text}` : text;
      return `"${neutral.replaceAll('"', '""')}"`;
    };
    const csv = '\uFEFF' + [columns.join(';'), ...records.map(row => columns.map(column => safe(row[column])).join(';'))].join('\r\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="transporte-${dataset}-${observedAt || 'sin-datos'}.csv"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
  return NextResponse.json({ observedAt, dataset, count: rows.length, rows, ...(vehicleRead ? { catalogOrigin: vehicleRead.catalogOrigin } : {}) }, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
