import { PanelSkeleton } from '@/components/admin/panel';

/**
 * Lo que se ve mientras una pantalla espera al núcleo.
 *
 * Tiene la forma de lo que va a llegar —una banda de cifras y dos paneles— y no
 * un porcentaje inventado: una barra de progreso que no sabe cuánto falta es
 * una promesa que nadie puede cumplir. Se anuncia como estado para lectores de
 * pantalla, pero no lleva encabezado: el de la página real es el único h1.
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Cargando la pantalla">
      <section className="pg-stats" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div className="pg-stat" key={index}>
            <PanelSkeleton rows={2} />
          </div>
        ))}
      </section>
      <section className="admin-panel" style={{ marginTop: 'var(--s3)' }} aria-hidden="true">
        <PanelSkeleton rows={6} />
      </section>
    </div>
  );
}
