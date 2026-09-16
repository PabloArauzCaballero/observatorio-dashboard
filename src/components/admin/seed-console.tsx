'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SeedPackage, SeedRun, SeedValidation } from '@/lib/admin/contracts';
import { SeedDifference } from './seed-difference';

type Phase = 'idle' | 'validating' | 'reviewing' | 'applying' | 'watching' | 'done';

/**
 * Validate, read the difference, then apply exactly what was read.
 *
 * The order is the design. An operator cannot reach the apply button without
 * the validation that produced a version and a checksum, and those travel with
 * the request: if the package changed in between, the core refuses with a
 * conflict instead of applying something nobody looked at.
 *
 * Nothing here reports success optimistically. Applying returns a run
 * identifier and the dialog then polls that run until it reaches a terminal
 * state, so «aplicado» is something the database said and not something the
 * browser assumed because a request returned 202.
 */
export function SeedConsole({ entry, csrf }: { entry: SeedPackage; csrf: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [phase, setPhase] = useState<Phase>('idle');
  const [validation, setValidation] = useState<SeedValidation | null>(null);
  const [run, setRun] = useState<SeedRun | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const close = useCallback((): void => {
    setPhase('idle');
    setValidation(null);
    setRun(null);
    setProblem(null);
    setReason('');
    openerRef.current?.focus();
  }, []);

  // Escape closes, and focus is put inside the dialog when it opens and given
  // back to the button that opened it when it closes.
  useEffect(() => {
    if (phase === 'idle') return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && phase !== 'applying') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, close]);

  // While a run is open, ask the core what it is doing. The interval stops the
  // moment the run reaches a state that will not change again.
  useEffect(() => {
    if (phase !== 'watching' || !run) return;
    if (!['QUEUED', 'RUNNING'].includes(run.status)) {
      setPhase('done');
      router.refresh();
      return;
    }
    const timer = setTimeout(() => {
      void fetch(`/api/admin/seeds/runs/${run.seedRunId}`, { cache: 'no-store' })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((body: { data?: SeedRun } | null) => {
          if (body?.data) setRun(body.data);
        })
        .catch(() => undefined);
    }, 1200);
    return () => clearTimeout(timer);
  }, [phase, run, router]);

  const validate = async (): Promise<void> => {
    setPhase('validating');
    setProblem(null);
    const response = await fetch('/api/admin/seeds/validations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-obs-csrf': csrf },
      body: JSON.stringify({ packageCode: entry.code }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      data?: SeedValidation;
      error?: { message?: string };
    };
    if (!response.ok || !body.data) {
      setProblem(body.error?.message ?? 'No fue posible validar el paquete');
      setPhase('reviewing');
      return;
    }
    setValidation(body.data);
    setPhase('reviewing');
  };

  const apply = async (): Promise<void> => {
    if (!validation) return;
    setPhase('applying');
    setProblem(null);
    const response = await fetch('/api/admin/seeds/reconciliations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-obs-csrf': csrf },
      body: JSON.stringify({
        packageCode: validation.code,
        expectedVersion: validation.version,
        expectedChecksum: validation.checksum,
        reason: reason.trim(),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      data?: { seedRunId: string; status: string; accepted: boolean };
      error?: { message?: string };
    };
    if (!response.ok || !body.data) {
      setProblem(body.error?.message ?? 'El núcleo rechazó la reconciliación');
      setPhase('reviewing');
      return;
    }
    setRun({
      seedRunId: body.data.seedRunId,
      packageCode: validation.code,
      packageVersion: validation.version,
      operation: 'RECONCILIATION',
      status: body.data.status,
      attemptNo: 1,
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      completedAt: null,
      errorSummary: body.data.accepted
        ? null
        : 'Ya había una ejecución idéntica: se está siguiendo esa.',
      checkpoint: null,
      counters: {},
    });
    setPhase('watching');
  };

  return (
    <>
      <button
        type="button"
        ref={openerRef}
        className="admin-button"
        onClick={() => void validate()}
        disabled={!entry.applicable}
        title={entry.refusal?.message ?? 'Validar y revisar la diferencia antes de aplicar'}
      >
        Validar
      </button>

      {phase === 'idle' ? null : (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            ref={dialogRef}
          >
            <h2 id={titleId}>{entry.label}</h2>

            {problem ? (
              <p className="admin-error" role="alert">
                {problem}
              </p>
            ) : null}

            {phase === 'validating' ? <p className="admin-note">Validando el paquete…</p> : null}

            {validation ? (
              <>
                <dl>
                  <dt>Versión</dt>
                  <dd>{validation.version}</dd>
                  <dt>Checksum</dt>
                  <dd>{validation.checksum}</dd>
                  <dt>Estado en el registro</dt>
                  <dd>{validation.ledgerState}</dd>
                  <dt>Propiedad</dt>
                  <dd>{validation.ownership}</dd>
                </dl>
                <SeedDifference
                  difference={validation.difference}
                  ownership={validation.ownership}
                />
              </>
            ) : null}

            {phase === 'reviewing' && validation && !validation.refusal ? (
              <>
                <label className="admin-field" htmlFor={`${titleId}-reason`}>
                  Motivo de la reconciliación
                  <input
                    id={`${titleId}-reason`}
                    value={reason}
                    minLength={4}
                    maxLength={500}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <div className="admin-actions">
                  <button
                    type="button"
                    className="admin-button admin-button-strong"
                    disabled={reason.trim().length < 4}
                    onClick={() => void apply()}
                  >
                    Aplicar esta diferencia
                  </button>
                  <button type="button" className="admin-button" onClick={close}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : null}

            {run ? (
              <dl>
                <dt>Ejecución</dt>
                <dd>{run.seedRunId}</dd>
                <dt>Estado</dt>
                <dd>{run.status}</dd>
                {run.errorSummary ? (
                  <>
                    <dt>Detalle</dt>
                    <dd>{run.errorSummary}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}

            {phase === 'applying' ? <p className="admin-note">Enviando la solicitud…</p> : null}

            {phase === 'watching' ? (
              <p className="admin-note" role="status">
                Aceptada. Siguiendo la ejecución hasta que termine; esto no es una confirmación de
                que los datos ya estén aplicados.
              </p>
            ) : null}

            {phase === 'done' || (validation?.refusal ?? null) ? (
              <div className="admin-actions">
                <button type="button" className="admin-button" onClick={close}>
                  Cerrar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
