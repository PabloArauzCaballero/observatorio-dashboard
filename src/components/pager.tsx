import { Icon } from './icons';

/**
 * Which page of a long list is on screen, and the way to another.
 *
 * It states the range and the total rather than only the page number: "21–40 de
 * 86" tells a reader both where they are and how much is left, which "página 2
 * de 5" does on its own only after they have worked out the page size.
 *
 * It draws nothing when the whole selection fits on one page — a pager that
 * can only ever say "página 1 de 1" is a control that does nothing, and the
 * reader has to read it to find that out.
 *
 * Shared, so the macro series and the world board page the same way: a reader
 * who learns the control on one tab should not have to learn it again on the
 * next.
 */
export function Pager({
  page,
  pages,
  first,
  last,
  total,
  pageSize,
  onGo,
  where,
  noun = 'indicadores',
}: {
  page: number;
  pages: number;
  first: number;
  last: number;
  total: number;
  pageSize: number;
  /** Receives the offset, counted in items, of the page to show. */
  onGo: (offset: number) => void;
  /** Which of the two pagers this is, so a screen reader can tell them apart. */
  where: string;
  noun?: string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label={`Páginas de ${noun} (${where})`}>
      <button
        type="button"
        className="pager-step"
        onClick={() => onGo(Math.max(0, (page - 2) * pageSize))}
        disabled={page <= 1}
      >
        <Icon name="plegar" size={14} /> Anteriores
      </button>
      <span className="pager-where">
        <b>
          {first}–{last}
        </b>{' '}
        de <b>{total}</b> · página <b>{page}</b> de <b>{pages}</b>
      </span>
      <button
        type="button"
        className="pager-step"
        onClick={() => onGo(page * pageSize)}
        disabled={page >= pages}
      >
        Siguientes <Icon name="desplegar" size={14} />
      </button>
    </nav>
  );
}
