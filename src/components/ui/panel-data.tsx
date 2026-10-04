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

/** Una imagen que la figura sabe componer por su cuenta (un mapa con teselas, por ejemplo). */
export type ProveedorDeImagen = () => Promise<Blob | null>;

export interface Almacen {
  poner: (clave: string, datos: DatosDeFigura | undefined) => void;
  todos: () => DatosDeFigura[];
  ponerImagen: (clave: string, proveedor: ProveedorDeImagen | undefined) => void;
  imagen: () => ProveedorDeImagen | undefined;
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
  const datos = useRef(new Map<string, DatosDeFigura>());
  const imagenes = useRef(new Map<string, ProveedorDeImagen>());
  return useMemo<Almacen>(
    () => ({
      poner: (clave, figura) => {
        if (figura) datos.current.set(clave, figura);
        else datos.current.delete(clave);
      },
      todos: () => [...datos.current.values()],
      ponerImagen: (clave, proveedor) => {
        if (proveedor) imagenes.current.set(clave, proveedor);
        else imagenes.current.delete(clave);
      },
      imagen: () => [...imagenes.current.values()][0],
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

/**
 * Una figura que compone su propia imagen la ofrece al menú del panel.
 *
 * Es para lo que el afiche no puede dibujar: un SVG suelto no carga recursos
 * externos, así que un mapa con teselas saldría sin mapa. Con un proveedor, el
 * menú ofrece «Imagen PNG» con lo que la figura devuelva y no ofrece el SVG.
 */
export function useImagenDeFigura(proveedor: ProveedorDeImagen | undefined): void {
  const almacen = useContext(Contexto);
  const clave = useId();
  const reciente = useRef(proveedor);
  reciente.current = proveedor;
  const hay = proveedor !== undefined;
  useEffect(() => {
    if (!almacen || !hay) return;
    almacen.ponerImagen(clave, () => reciente.current?.() ?? Promise.resolve(null));
    return () => almacen.ponerImagen(clave, undefined);
  }, [almacen, clave, hay]);
}

/** Un número de una celda, sin inventar nada: lo que no es número ni texto queda vacío. */
export function celda(valor: unknown): Celda {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'string') return valor;
  return null;
}
