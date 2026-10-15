'use client';

import { useState } from 'react';
import { findPersonPhoto } from '@/lib/person-photos';

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', '&', 'vda', 'd']);

function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)/gu, ' ')
    .split(/[\s.\-–_]+/u)
    .filter((word) => word && !PARTICLES.has(word.toLocaleLowerCase('es')));
  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`
      : (words[0] ?? '').slice(0, 2);
  return letters.toLocaleUpperCase('es');
}

/**
 * Un solo estilo de medalla para todos: retrato o iniciales en serif, oro profundo
 * sobre arena y filete de oro, como un sello. El color por sector era una gama
 * ajena a la marca y no decía nada que el rótulo de al lado no diga ya.
 */
const MEDALLA = {
  bg: 'var(--panel-tint)',
  color: 'var(--accent)',
  border: 'var(--gold)',
};

export function PersonAvatar({
  slug,
  name,
  size = 36,
  className = '',
}: {
  slug?: string | null | undefined;
  name: string;
  /** Se conserva por compatibilidad; ya no cambia el color. */
  sector?: string | undefined;
  size?: number | undefined;
  className?: string | undefined;
}) {
  const [loadError, setLoadError] = useState(false);
  const file = findPersonPhoto(slug, name);
  const theme = MEDALLA;

  const style: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: `1.5px solid ${theme.border}`,
    background: theme.bg,
    color: theme.color,
    userSelect: 'none',
  };

  if (!file || loadError) {
    return (
      <span
        className={`person-avatar person-avatar-initials ${className}`}
        style={{
          ...style,
          fontFamily: 'var(--serif)',
          fontWeight: 700,
          fontSize: Math.max(10, Math.round(size * 0.38)),
          letterSpacing: '0.04em',
        }}
        title={name}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <span
      className={`person-avatar ${className}`}
      style={style}
      title={name}
      aria-label={`Foto de ${name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/people/${file}`}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setLoadError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </span>
  );
}
