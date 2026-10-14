import { vehiclePhoto } from '@/lib/vehicle-photos';

interface Offer {
  brand: string;
  model: string;
  price: number;
  currency: string;
}

/**
 * Los modelos de la selección, cada uno con su foto y el rango de precios anunciado.
 *
 * Todas las tarjetas tienen el mismo tamaño y la imagen ocupa el mismo cuadro (3:2): un modelo sin
 * foto libre muestra la marca en grande en ese cuadro, así la rejilla no se descuadra ni se
 * inventa una imagen. Las fotos cargan al acercarse.
 */
export function VehicleModelGallery({
  rows,
  money,
}: {
  rows: Offer[];
  money: (value: number, currency: string) => string;
}) {
  const models = new Map<string, { brand: string; model: string; prices: Offer[] }>();
  for (const row of rows) {
    const key = `${row.brand}|${row.model}`;
    const entry = models.get(key) ?? { brand: row.brand, model: row.model, prices: [] };
    entry.prices.push(row);
    models.set(key, entry);
  }
  const cards = [...models.values()].sort(
    (a, b) => a.brand.localeCompare(b.brand, 'es') || a.model.localeCompare(b.model, 'es'),
  );
  if (!cards.length) return null;
  return (
    <ul className="vehicle-gallery">
      {cards.map((card) => {
        const photo = vehiclePhoto(card.brand, card.model);
        const currencies = [...new Set(card.prices.map((offer) => offer.currency))];
        const range = currencies.length === 1 ? currencies[0] : null;
        const values = card.prices.map((offer) => offer.price);
        const low = Math.min(...values);
        const high = Math.max(...values);
        return (
          <li key={`${card.brand}|${card.model}`} className="vehicle-card">
            <div className="vehicle-card-photo">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- archivos propios de 480 px
                <img src={photo} alt={`${card.brand} ${card.model}`} width={480} height={320} loading="lazy" decoding="async" />
              ) : (
                <span aria-hidden="true">{card.brand}</span>
              )}
            </div>
            <div className="vehicle-card-body">
              <strong>
                {card.brand} {card.model}
              </strong>
              <span>
                {card.prices.length} {card.prices.length === 1 ? 'versión' : 'versiones'}
                {range ? ` · ${low === high ? money(low, range) : `${money(low, range)} – ${money(high, range)}`}` : ''}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
