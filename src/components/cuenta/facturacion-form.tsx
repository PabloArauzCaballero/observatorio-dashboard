'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import styles from '@/app/cuenta/cuenta.module.css';
import type { BillingChanges } from '@/lib/cuenta/puro';
import { Aviso, enviar, errorDe, useFormulario } from './formulario';
import { BILLING_LIMITS, TAX_ID_PATTERN } from './limites';

/** Los datos con que se emite la factura. Solo la titular ve este formulario. */
export function FacturacionForm({ datos }: { datos: BillingChanges }) {
  const router = useRouter();
  const { formRef, setEstado, enviando, campo, aviso } = useFormulario();

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const valor = (nombre: keyof BillingChanges): string => String(formulario.get(nombre) ?? '').trim();
    const taxId = valor('taxId');
    if (taxId && !TAX_ID_PATTERN.test(taxId)) {
      return setEstado({
        tipo: 'error',
        mensaje: 'El NIT lleva de 3 a 20 cifras, letras o guiones, sin espacios.',
        campo: 'taxId',
      });
    }
    setEstado({ tipo: 'enviando' });
    const r = await enviar('/api/cuenta/facturacion', {
      organization: valor('organization'),
      legalName: valor('legalName'),
      taxId,
    });
    if (!r.ok) return setEstado(errorDe(r));
    setEstado({ tipo: 'hecho', mensaje: 'Los datos de facturación se guardaron.' });
    router.refresh();
  };

  return (
    <form ref={formRef} className={styles.form} onSubmit={(e) => void alEnviar(e)} noValidate aria-busy={enviando}>
      <label className={styles.campo}>
        Organización
        <input
          name="organization"
          type="text"
          autoComplete="organization"
          maxLength={BILLING_LIMITS.organization}
          defaultValue={datos.organization ?? ''}
          {...campo('organization')}
        />
      </label>
      <label className={styles.campo}>
        Razón social
        <input
          name="legalName"
          type="text"
          autoComplete="off"
          maxLength={BILLING_LIMITS.legalName}
          defaultValue={datos.legalName ?? ''}
          {...campo('legalName')}
        />
      </label>
      <label className={styles.campo}>
        NIT
        <input
          name="taxId"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={BILLING_LIMITS.taxId}
          defaultValue={datos.taxId ?? ''}
          {...campo('taxId')}
        />
      </label>
      <p className={styles.nota}>Un campo en blanco se borra. La factura sale con estos datos.</p>
      <div className={styles.acciones}>
        <button className={styles.secundario} type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar los datos'}
        </button>
      </div>
      <Aviso {...aviso} />
    </form>
  );
}
