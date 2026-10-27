'use client';

import { useState } from 'react';
import styles from './api.module.css';

/** Un bloque de código con su botón «Copiar». Sin portapapeles, el texto sigue seleccionable. */
export function Codigo({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    void navigator.clipboard
      ?.writeText(texto)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2_000);
      })
      .catch(() => setCopiado(false));
  };
  return (
    <figure className={styles.codigo}>
      <figcaption className={styles.codigoPie}>
        <span>{etiqueta}</span>
        <button type="button" className={styles.copiar} onClick={copiar} aria-live="polite">
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </figcaption>
      <pre tabIndex={0}>
        <code>{texto}</code>
      </pre>
    </figure>
  );
}
