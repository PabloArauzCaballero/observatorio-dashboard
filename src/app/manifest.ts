import type { MetadataRoute } from 'next';

/**
 * Lo que un teléfono necesita para guardar el sitio como aplicación: nombre,
 * colores de la marca y el monograma (regla móvil del manual: solo el DB, sin
 * dirección ni descriptor).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DatosBolivia.com — Centro de Datos de Bolivia',
    short_name: 'DatosBolivia',
    description:
      'Indicadores económicos, sociales y territoriales de Bolivia, con la fuente y la fecha de cada cifra.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f4ed',
    theme_color: '#17191a',
    lang: 'es-BO',
    icons: [
      { src: '/brand/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icono-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/brand/icono-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
