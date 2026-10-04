/**
 * Entregar un archivo al lector: el único camino de «blob → clic» del tablero.
 *
 * Había cinco copias de este mismo gesto (`bcb-section`, `street-data-explorer`,
 * `trade-records-panels`, `asistente`, `places-map`), cada una con su manera de
 * avisar —o no— a la telemetría. Este es el sitio donde se hace bien una vez.
 */
import { reportDownloadIntent } from '@/lib/analytics';

/** Fecha de hoy en La Paz como «2026-10-03»: el sello de un nombre de archivo. */
export function hoyEnLaPaz(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
}

/** «3 de octubre de 2026», para el pie de una imagen. */
export function fechaLarga(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/La_Paz',
  }).format(ahora);
}

export function entregar(contenido: Blob, nombre: string, intencion: string): void {
  reportDownloadIntent(intencion);
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // Se libera en otro turno: revocarla en el mismo puede ganarle al navegador la
  // descarga en Safari.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const TIPO = {
  csv: 'text/csv;charset=utf-8',
  svg: 'image/svg+xml;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;
