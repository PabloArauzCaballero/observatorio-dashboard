import type { PostShape } from './company-social-board';
import type { Choice } from './choice';

const FORMAT_LABEL: Record<string, string> = {
  POST: 'Post de Instagram',
  REEL: 'Reel',
  VIDEO: 'Video',
  PHOTO: 'Foto',
  TEXT: 'Texto o enlace',
  'SIN DATO': 'Sin dato',
};

/** Reparto de formatos; la mediana sólo usa posts con interacciones declaradas. */
export function formatMix(shapes: readonly PostShape[], slugs: ReadonlySet<string>, platforms: Choice) {
  const groups = new Map<string, { posts: number; values: number[] }>();
  for (const shape of shapes) {
    if (!slugs.has(shape.slug) || (platforms.size && !platforms.has(shape.platform))) continue;
    const format = shape.format ?? 'SIN DATO';
    const group = groups.get(format) ?? { posts: 0, values: [] };
    group.posts += 1;
    if (shape.interactions !== null) group.values.push(shape.interactions);
    groups.set(format, group);
  }
  const total = [...groups.values()].reduce((sum, group) => sum + group.posts, 0);
  return [...groups.entries()]
    .map(([format, group]) => {
      const sorted = [...group.values].sort((left, right) => left - right);
      return {
        name: FORMAT_LABEL[format] ?? format,
        value: total ? (100 * group.posts) / total : 0,
        posts: group.posts,
        measured: sorted.length,
        median: sorted.length ? ((sorted[Math.floor(sorted.length / 2)] ?? 0) + (sorted[Math.floor((sorted.length - 1) / 2)] ?? 0)) / 2 : null,
      };
    })
    .sort((left, right) => right.value - left.value);
}
