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

const SECTOR_GRADIENTS: Record<string, { bg: string; color: string; border: string }> = {
  BUSINESS: {
    bg: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
    color: '#fbbf24',
    border: '#d97706',
  },
  POLITICS: {
    bg: 'linear-gradient(135deg, #7f1d1d 0%, #1e1b4b 100%)',
    color: '#fca5a5',
    border: '#dc2626',
  },
  MEDIA: {
    bg: 'linear-gradient(135deg, #4c1d95 0%, #831843 100%)',
    color: '#f472b6',
    border: '#c026d3',
  },
  SPORTS: {
    bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
    color: '#6ee7b7',
    border: '#10b981',
  },
  SCIENCE: {
    bg: 'linear-gradient(135deg, #0f172a 0%, #0369a1 100%)',
    color: '#7dd3fc',
    border: '#0284c7',
  },
  CULTURE: {
    bg: 'linear-gradient(135deg, #713f12 0%, #854d0e 100%)',
    color: '#fde047',
    border: '#ca8a04',
  },
  CIVIC: {
    bg: 'linear-gradient(135deg, #881337 0%, #4c0519 100%)',
    color: '#fda4af',
    border: '#e11d48',
  },
};

const DEFAULT_GRADIENT = {
  bg: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
  color: '#e2e8f0',
  border: '#64748b',
};

export function PersonAvatar({
  slug,
  name,
  sector = 'BUSINESS',
  size = 36,
  className = '',
}: {
  slug: string | null | undefined;
  name: string;
  sector?: string;
  size?: number;
  className?: string;
}) {
  const [loadError, setLoadError] = useState(false);
  const file = findPersonPhoto(slug);
  const theme = SECTOR_GRADIENTS[sector.toUpperCase()] ?? DEFAULT_GRADIENT;

  const style: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: Math.round(size * 0.28), // Squircle suave y elegante
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 5px rgba(0,0,0,0.18)',
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
          fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
          fontWeight: 750,
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
