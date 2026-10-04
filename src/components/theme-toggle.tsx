'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { THEME_KEY } from '@/lib/theme';

type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Cambia entre claro y oscuro y recuerda la elección. Hasta que el lector elige,
 * el tema es el de su sistema; después manda lo que eligió.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // El tema efectivo solo se conoce en el navegador, así que se lee al montar.
  useEffect(() => {
    const forced = document.documentElement.getAttribute('data-theme');
    setTheme(forced === 'light' || forced === 'dark' ? forced : systemTheme());
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  const choose = () => {
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Sin almacenamiento la elección dura lo que dure la pestaña.
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="theme-btn"
      onClick={choose}
      disabled={theme === null}
      aria-label={next === 'dark' ? 'Usar el tema oscuro' : 'Usar el tema claro'}
      title={next === 'dark' ? 'Tema oscuro' : 'Tema claro'}
    >
      <Icon name={next === 'dark' ? 'luna' : 'sol'} size={16} />
    </button>
  );
}
