'use client';

import { useEffect, useState } from 'react';

/**
 * Lo que una pestaña pide cuando alguien la abre.
 *
 * `Tabs` dibuja **sólo la pestaña activa** —a propósito: un gráfico medido
 * dentro de un contenedor escondido sale de ancho cero y nunca recibe el
 * redimensionado que lo arreglaría—. Pero eso vale en el navegador, no en el
 * servidor: las siete se dibujaban en el servidor y las siete viajaban en el
 * documento. Medido el 2026-09-22 sobre lo que servía `test`: **7,9 MB** de
 * informe, de los que unos 6,3 eran de pestañas que el lector no había abierto y
 * que React analizaba para descartarlas.
 *
 * Peor que el peso era el turno: la portada esperaba a que las veinte lecturas
 * de las siete pestañas terminaran antes de emitir una sola línea de contenido.
 * La conexión quedaba **muda desde el segundo 1 hasta el 16** y el informe
 * completo llegaba entre los 16 y los 23 s. Ni la red ni el tamaño lo explican:
 * el mismo servidor entrega un megabyte en dos segundos.
 *
 * Así que una pestaña que no es la primera no viaja: se monta cuando alguien la
 * elige, y entonces pide lo suyo. El patrón ya estaba en el repositorio —«Social
 * Info» y «Bolivia ante el mundo» lo hacían— y esto es el mismo, escrito una vez
 * para que las seis lo compartan en vez de repetirlo seis veces.
 *
 * `null` mientras no ha llegado, y `failed` cuando no va a llegar. Son dos
 * estados y no uno porque dicen cosas opuestas al lector: «espera» y «esto no
 * se pudo leer, el resto del informe sigue al día».
 */
export function useOnOpen<T>(url: string): { payload: T | null; failed: boolean } {
  const [payload, setPayload] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(url))))
      .then((body: T) => {
        if (alive) setPayload(body);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return { payload, failed };
}

/**
 * El aviso de que algo está en camino, o de que no viene.
 *
 * Un aviso y no una retícula vacía: mil lecturas tardan lo suyo en llegar, y una
 * pantalla en blanco durante ese rato se lee como un fallo. Y cuando de verdad
 * lo es, se dice qué sección falta y que el resto del informe no está afectado —
 * que es lo único que puede publicarse en una dirección abierta: ni el código
 * del error, ni el servidor, ni el rol.
 *
 * La espera es un `role="status"` con `aria-live`, que es la forma que «Economía
 * mundial» ya usaba y la que hay que usar ahora que seis de las siete pestañas
 * llegan así: sin eso, quien navega con lector de pantalla abre un capítulo, no
 * oye nada, y no tiene manera de distinguir «está leyendo» de «está vacío».
 *
 * El fallo NO es un estado: es una advertencia, y va como aviso con su texto,
 * sin girar nada ni prometer que algo viene en camino.
 */
export function OnOpenNotice({ what, failed }: { what: string; failed: boolean }) {
  if (failed) {
    return (
      <div className="callout">No se pudo leer {what}. El resto del informe sigue al día.</div>
    );
  }

  return (
    <div className="loading-note" role="status" aria-live="polite">
      <span className="loading-spin" aria-hidden="true" />
      <div>
        <b>Leyendo {what}…</b>
      </div>
    </div>
  );
}
