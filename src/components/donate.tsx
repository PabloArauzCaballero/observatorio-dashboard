'use client';

import { useEffect, useRef } from 'react';
import { Icon } from './icons';

/**
 * The ask.
 *
 * The tablero costs money that nobody is billing for: a database, a host and
 * the hours that keep the series current. A reader who would help has no way to
 * find that out from a page that never says it, so the ask sits in the
 * masthead, at the same weight as the timestamp — visible on every section,
 * loud on none.
 *
 * One QR and one line. In Bolivia a transfer is made by scanning, so the QR is
 * the whole mechanism; anything more is a form nobody fills in. Swapping the
 * placeholder for the bank's own image is a matter of replacing the file named
 * below and turning `IS_TEST` off — no code changes, so the person who has the
 * real QR does not need to be the person who can deploy.
 */

const QR_SRC = '/donacion-qr.svg';

/** The committed QR is a placeholder that encodes a notice, not an account. */
const IS_TEST = true;

export function Donate() {
  const dialog = useRef<HTMLDialogElement>(null);

  // Escape is handled by the element; the backdrop is not, and a modal that
  // only closes from its own button traps a reader who opened it by accident.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;

    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target === node) node.close();
    };

    node.addEventListener('click', closeOnBackdrop);
    return () => node.removeEventListener('click', closeOnBackdrop);
  }, []);

  return (
    <>
      <button
        type="button"
        className="donate-btn"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
      >
        <Icon name="corazon" size={14} />
        Donar
      </button>

      <dialog className="donate-dialog" ref={dialog} aria-labelledby="donate-title">
        <div className="donate-body">
          <h2 id="donate-title">Dona para mantener este sitio</h2>
          <p className="donate-lead">
            El observatorio es gratuito y sin publicidad. Lo que cuesta es la base de datos, el
            alojamiento y el trabajo de mantener las series al día. Escanea el código con tu app
            del banco.
          </p>

          <figure className="donate-qr">
            {/* eslint-disable-next-line @next/next/no-img-element -- a QR is served as-is: any resizing pass risks the modules. */}
            <img src={QR_SRC} alt="Código QR para donar al observatorio" width={220} height={220} />
            {IS_TEST ? (
              <figcaption className="donate-test">
                Código de prueba: todavía no recibe pagos.
              </figcaption>
            ) : null}
          </figure>

          <p className="donate-note">
            Una donación no compra cobertura ni cambia una cifra. Las fuentes y el método siguen
            siendo los de la pestaña «Método».
          </p>

          <button type="button" className="donate-close" onClick={() => dialog.current?.close()}>
            Cerrar
          </button>
        </div>
      </dialog>
    </>
  );
}
