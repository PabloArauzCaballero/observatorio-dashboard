'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { Celda, Dataset } from '@/lib/export/datos';

/** Las cifras que una figura dibuja, con el nombre con que se bajan. */
export interface DatosDeFigura extends Pick<Dataset, 'columnas' | 'filas' | 'unidad' | 'nota'> {
  /** Qué figura es, cuando el panel tiene varias: «Paralelo», «Volatilidad». */
  etiqueta?: string | undefined;
}

export interface Almacen {
  poner: (clave: string, datos: DatosDeFigura | undefined) => void;
  todos: () => DatosDeFigura[];
}

const Contexto = createContext<Almacen | null>(null);

/**
 * Lo que un `Panel` recoge de las figuras que contiene.
 *
 * Los gráficos del tablero ya reciben sus cifras como propiedades; en vez de que
 * cada panel las repita en un `data` aparte (y un día dejen de coincidir con lo
 * dibujado), la figura las declara al panel que la envuelve. Envolver un panel
 * antiguo en `Panel` basta para que se pueda bajar. Vive en una referencia, no en
 * estado: registrar no provoca un nuevo pintado.
 */
export function useAlmacenDePanel(): Almacen {
  const mapa = useRef(new Map<string, DatosDeFigura>());
  return useMemo<Almacen>(
    () => ({
      poner: (clave, datos) => {
        if (datos) mapa.current.set(clave, datos);
        else mapa.current.delete(clave);
      },
      todos: () => [...mapa.current.values()],
    }),
    [],
  );
}

export function ProveedorDePanel({ almacen, children }: { almacen: Almacen; children: ReactNode }) {
  return <Contexto.Provider value={almacen}>{children}</Contexto.Provider>;
}

/**
 * Una figura declara sus cifras al panel que la contiene. Fuera de un `Panel` no
 * hace nada. `armar` solo corre al volver a dibujar con otras cifras; devolver
 * `undefined` es «esta figura no tiene datos que bajar».
 */
export function useDatosDeFigura(
  armar: () => DatosDeFigura | undefined,
  dependencias: ReadonlyArray<unknown>,
): void {
  const almacen = useContext(Contexto);
  const clave = useId();
  const reciente = useRef(armar);
  reciente.current = armar;
  useEffect(() => {
    if (!almacen) return;
    almacen.poner(clave, reciente.current());
    return () => almacen.poner(clave, undefined);
    // Las dependencias las elige quien llama: son las cifras de las que sale el conjunto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacen, clave, ...dependencias]);
}

/** Un número de una celda, sin inventar nada: lo que no es número ni texto queda vacío. */
export function celda(valor: unknown): Celda {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'string') return valor;
  return null;
}
