import { COMPANY_LOGOS } from '@/lib/company-logos';

/**
 * La marca de una empresa, o sus iniciales cuando no la tenemos.
 *
 * Los logotipos se sirven desde `public/logos/` y no desde la web de cada
 * empresa: cargados en caliente, cien dominios distintos por página serían cien
 * conexiones más en la portada de alguien con datos móviles, y bastaría con que
 * un filtro corporativo bloqueara uno de esos dominios para que la fila saliera
 * con una imagen rota. El catálogo de qué empresa tiene logotipo vive en
 * `company-logos.ts`, generado junto con los archivos.
 *
 * Las iniciales no son un adorno de relleno: una fila sin marca tiene que
 * ocupar el mismo sitio que una con marca, o la columna de nombres se
 * desalinea y el ojo lee un salto donde no lo hay.
 */

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', '&']);

function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)/gu, ' ')
    .split(/[\s.\-–]+/u)
    .filter((word) => word && !PARTICLES.has(word.toLocaleLowerCase('es')));
  const letters = words.length > 1 ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}` : (words[0] ?? '').slice(0, 2);
  return letters.toLocaleUpperCase('es');
}

export function CompanyLogo({
  slug,
  name,
  size = 32,
}: {
  slug: string;
  name: string;
  size?: number;
}) {
  const file = COMPANY_LOGOS[slug];
  const style = { width: size, height: size };
  if (!file) {
    return (
      <span
        className="company-logo company-logo-initials"
        style={{ ...style, fontSize: Math.max(10, Math.round(size * 0.36)) }}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
    );
  }
  return (
    <span className="company-logo" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element -- archivos propios y pequeños: el optimizador de Next no añade nada y cuesta una ida al servidor por logotipo */}
      <img src={`/logos/${file}`} alt="" width={size} height={size} loading="lazy" decoding="async" />
    </span>
  );
}
