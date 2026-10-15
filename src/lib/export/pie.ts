/**
 * El pie de una figura como lo escribe un banco central: «Fuente: BCB.
 * Elaboración: DatosBolivia.com. Actualizado el 3-oct-2026.». Si la fuente ya
 * declara el cálculo propio («INE; cálculo de DatosBolivia.com»), no se repite.
 *
 * Lo usan el panel en pantalla y la imagen que se descarga, para que digan lo mismo.
 */
export function pieDeFuente(source: string, updated?: string): string {
  const fuente = source.trim().replace(/\.\s*$/, '');
  const propio = /datosbolivia/i.test(fuente);
  return (
    `Fuente: ${fuente}.` +
    (propio ? '' : ' Elaboración: DatosBolivia.com.') +
    (updated ? ` Actualizado el ${updated}.` : '')
  );
}

/** El nombre con que firma el sitio en archivos, informes e imágenes. */
export const MARCA = 'DatosBolivia.com';
export const DESCRIPTOR = 'Centro de Datos de Bolivia';
