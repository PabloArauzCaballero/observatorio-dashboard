/**
 * One icon language for the whole report.
 *
 * Stroke-only on a 24 grid, sized in the caller and coloured by `currentColor`,
 * so an icon inherits the weight and hue of the text it sits beside instead of
 * carrying its own. No emoji: they cannot be recoloured, they render
 * differently on every platform, and they read as decoration rather than as
 * part of the type.
 *
 * The set is deliberately closed. A name that is not here is a deliberate
 * addition, not a string that silently renders nothing.
 */

const PATHS = {
  area: '<path d="M3.5 20.5V3.5M3.5 20.5h17"/><path d="m6 17 4-6 4 3 6-8v11z"/>',
  balanza: '<path d="M12 4v16M6 20h12M5 8h14M5 8l-2.5 5.5h5zM19 8l2.5 5.5h-5z"/>',
  banco: '<path d="M3.5 9.5 12 4l8.5 5.5M5 9.5v9M9.5 9.5v9M14.5 9.5v9M19 9.5v9M3 21h18"/>',
  barras:
    '<path d="M3.5 20.5V3.5M3.5 20.5h17"/><path d="M7 20.5v-6M11.5 20.5v-10M16 20.5v-4M20 20.5v-8"/>',
  buscar: '<circle cx="11" cy="11" r="6.4"/><path d="m20.5 20.5-4.9-4.9"/>',
  desplegar: '<path d="m6 9.5 6 6 6-6"/>',
  plegar: '<path d="m6 14.5 6-6 6 6"/>',
  cajas:
    '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.4"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.4"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.4"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.4"/>',
  calendario:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  camion:
    '<path d="M2.8 6.5h10.4v10H2.8z"/><path d="M13.2 10h4l3 3.3v3.2h-7z"/><circle cx="7" cy="18.5" r="2"/><circle cx="17" cy="18.5" r="2"/>',
  campana:
    '<path d="M12 3.5a5.6 5.6 0 0 0-5.6 5.6c0 5.3-2 6.9-2 6.9h15.2s-2-1.6-2-6.9A5.6 5.6 0 0 0 12 3.5z"/><path d="M10.3 19.5a2 2 0 0 0 3.4 0"/>',
  capas: '<path d="M12 3.2 21 8l-9 4.8L3 8z"/><path d="m3 12.5 9 4.8 9-4.8M3 16.8l9 4.8 9-4.8"/>',
  casco:
    '<path d="M3.5 17.5a8.5 8.5 0 0 1 17 0z"/><path d="M9 17.5V8.2A2.2 2.2 0 0 1 11.2 6h1.6A2.2 2.2 0 0 1 15 8.2v9.3M2.5 20.5h19"/>',
  chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/>',
  descarga:
    '<path d="M12 3.5v11m0 0 4-4m-4 4-4-4"/><path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16"/>',
  corazon:
    '<path d="M12 20.4C6.4 16.7 3.4 13.4 3.4 9.9a4.4 4.4 0 0 1 8.6-1.5 4.4 4.4 0 0 1 8.6 1.5c0 3.5-3 6.8-8.6 10.5z"/>',
  diana:
    '<circle cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r=".9"/>',
  edificio:
    '<path d="M4 21V4.5A1.5 1.5 0 0 1 5.5 3h9A1.5 1.5 0 0 1 16 4.5V21"/><path d="M16 10h3.5A1.5 1.5 0 0 1 21 11.5V21M2.5 21h19M7.5 7h2M11 7h2M7.5 11h2M11 11h2M7.5 15h2M11 15h2"/>',
  escudo:
    '<path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z"/><path d="m9 12 2.2 2.2L15.3 10"/>',
  espiga:
    '<path d="M12 21V8.5"/><path d="M12 8.5c0-2.4 1.8-4.4 4.2-4.4 0 2.4-1.8 4.4-4.2 4.4zM12 8.5c0-2.4-1.8-4.4-4.2-4.4 0 2.4 1.8 4.4 4.2 4.4z"/><path d="M12 14c0-2.4 1.8-4.4 4.2-4.4 0 2.4-1.8 4.4-4.2 4.4zM12 14c0-2.4-1.8-4.4-4.2-4.4 0 2.4 1.8 4.4 4.2 4.4z"/>',
  etiqueta:
    '<path d="M3.5 11V4.5c0-.6.4-1 1-1H11l9.2 9.2a1.6 1.6 0 0 1 0 2.3l-6.2 6.2a1.6 1.6 0 0 1-2.3 0z"/><circle cx="7.8" cy="7.8" r="1.4"/>',
  fabrica:
    '<path d="M3 21V9.5l6 3.6V9.5l6 3.6V6h6v15z"/><path d="M3 21h18M18.5 10.5h0M18.5 15h0"/>',
  filtro: '<path d="M3.5 5h17l-6.6 7.6v5.9l-3.8 2v-7.9z"/>',
  gema: '<path d="M7 3.5h10l4 5.5-9 11.5L3 9z"/><path d="M3 9h18M7 3.5 9.5 9 12 20.5 14.5 9 17 3.5"/>',
  globo:
    '<circle cx="12" cy="12" r="8.8"/><path d="M3.4 12h17.2M12 3.2c2.3 2.5 3.4 5.5 3.4 8.8s-1.1 6.3-3.4 8.8c-2.3-2.5-3.4-5.5-3.4-8.8S9.7 5.7 12 3.2z"/>',
  gota: '<path d="M12 3.2c3.4 4 6 7 6 9.8a6 6 0 0 1-12 0c0-2.8 2.6-5.8 6-9.8z"/>',
  hoja: '<path d="M20 4c0 9-5.5 13-11 13a5.5 5.5 0 0 1 0-11c4 0 6-2 11-2z"/><path d="M4.5 20.5C7 15 11 11.5 16 9.5"/>',
  info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.5M12 7.6v.9"/>',
  linea: '<path d="M3.5 20.5V3.5M3.5 20.5h17"/><path d="m6.5 16 4-5 3.5 3 5.5-8"/>',
  maletin:
    '<rect x="2.8" y="7.5" width="18.4" height="12.5" rx="2"/><path d="M8.5 7.5V5.6A1.6 1.6 0 0 1 10.1 4h3.8a1.6 1.6 0 0 1 1.6 1.6v1.9M2.8 13h18.4"/>',
  monedas:
    '<ellipse cx="12" cy="6.6" rx="7.2" ry="3.1"/><path d="M4.8 6.6v5.2c0 1.7 3.2 3.1 7.2 3.1s7.2-1.4 7.2-3.1V6.6"/><path d="M4.8 11.8v5.2c0 1.7 3.2 3.1 7.2 3.1s7.2-1.4 7.2-3.1v-5.2"/>',
  personas:
    '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20.2a6.2 6.2 0 0 1 12.4 0"/><path d="M16.2 5.1a3.4 3.4 0 0 1 0 6.6M17.6 14.4a6.2 6.2 0 0 1 3.6 5.8"/>',
  pulso: '<path d="M3 12.5h4l2-5 3.5 10 2.5-5h6"/>',
  rayo: '<path d="M13.2 3 5 13.5h5.5L9.8 21 18 10.5h-5.5z"/>',
  refrescar: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.4 4v4.4H16"/>',
  reloj: '<circle cx="12" cy="12" r="8.8"/><path d="M12 6.8V12l3.4 2.2"/>',
  sigma: '<path d="M17.5 5.5h-11l6 6.5-6 6.5h11"/>',
  tendencia: '<path d="m3.5 16.5 5.5-5.5 3.5 3.5 8-8"/><path d="M15.5 6.5h5v5"/>',
  tienda:
    '<path d="M4 9.5V21h16V9.5"/><path d="M2.8 9.5 5 3.5h14l2.2 6a3.2 3.2 0 0 1-6.1 1 3.2 3.2 0 0 1-6.2 0 3.2 3.2 0 0 1-6.1-1z"/><path d="M9.5 21v-6h5v6"/>',
  velas:
    '<path d="M3.5 20.5V3.5M3.5 20.5h17"/><path d="M8 7v11M8 9.5h0M8 9.5a0 0 0 0 1 0 0"/><rect x="6.4" y="9.5" width="3.2" height="6" rx=".8"/><path d="M15 5v14"/><rect x="13.4" y="7.5" width="3.2" height="7.5" rx=".8"/>',
  ventana: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className ? `ic ${className}` : 'ic'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
