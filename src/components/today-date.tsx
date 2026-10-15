'use client';

import { useEffect, useState } from 'react';

/**
 * La fecha del día, como en la cabecera de un diario: «miércoles, 15 de octubre
 * de 2026», en hora de Bolivia.
 *
 * Se escribe en el navegador y no en el servidor porque la página se sirve
 * desde caché: una fecha puesta al construirla quedaría congelada en el día del
 * despliegue. Hasta que hidrata se reserva el sitio, sin texto.
 */
export function TodayDate() {
  const [hoy, setHoy] = useState('');
  useEffect(() => {
    const texto = new Intl.DateTimeFormat('es-BO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/La_Paz',
    }).format(new Date());
    setHoy(texto.charAt(0).toUpperCase() + texto.slice(1));
  }, []);
  return (
    <time className="masthead-date" suppressHydrationWarning>
      {hoy}
    </time>
  );
}
