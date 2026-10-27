'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { InquiryStatus } from '@/lib/admin/contracts';

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  WON: 'Cliente',
  LOST: 'Descartado',
};

/**
 * El estado de un pedido y la nota del operador, guardados en un solo envío.
 *
 * Se recarga la pantalla después de guardar y no se pinta el cambio a mano: la
 * fila que se ve es la que devolvió el núcleo, no la que el navegador supone.
 */
export function InquiryStatusForm({
  id,
  status,
  note,
  csrf,
}: {
  id: string;
  status: InquiryStatus;
  note: string | null;
  csrf: string;
}) {
  const router = useRouter();
  const [next, setNext] = useState<InquiryStatus>(status);
  const [text, setText] = useState(note ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch(`/api/admin/pedidos/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-obs-csrf': csrf },
        body: JSON.stringify({ status: next, operatorNote: text }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setProblem(body?.error?.message ?? `No se guardó (${response.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setProblem('Sin conexión con el servidor.');
    } finally {
      setBusy(false);
    }
  };

  const changed = next !== status || text.trim() !== (note ?? '');

  return (
    <div className="admin-inquiry-form">
      <label>
        <span className="sr-only">Estado</span>
        <select
          value={next}
          onChange={(event) => setNext(event.target.value as InquiryStatus)}
          disabled={busy}
        >
          {(Object.keys(INQUIRY_STATUS_LABEL) as InquiryStatus[]).map((option) => (
            <option key={option} value={option}>
              {INQUIRY_STATUS_LABEL[option]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Nota interna</span>
        <input
          type="text"
          value={text}
          maxLength={2000}
          placeholder="Nota interna"
          onChange={(event) => setText(event.target.value)}
          disabled={busy}
        />
      </label>
      <button type="button" onClick={() => void save()} disabled={busy || !changed}>
        {busy ? 'Guardando…' : 'Guardar'}
      </button>
      {problem ? (
        <p className="admin-inquiry-problem" role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
