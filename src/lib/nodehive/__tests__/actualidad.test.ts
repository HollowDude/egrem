import { describe, it, expect } from 'vitest';
import { getRelatedItems } from '../related';
import type { NhActualidadItem } from '../entities';

function makeItem(overrides: Partial<NhActualidadItem>): NhActualidadItem {
  return {
    id: 'uuid-1',
    nid: 1,
    title: 'Test',
    bundle: 'noticia',
    date: '2024-10-12T00:00:00Z',
    created: '2024-10-12T00:00:00Z',
    body: '<p>Body</p>',
    summary: 'Summary',
    author: 'Author',
    patrimonio: false,
    image: null,
    path: '/actualidad/noticias/test',
    tags: [],
    ...overrides,
  };
}

describe('getRelatedItems', () => {
  it('returns items sharing tags, sorted by date', () => {
    const current = makeItem({ id: '1', tags: [{ slug: 'musica', label: 'Música' }] });
    const matching = makeItem({
      id: '2',
      title: 'Matching',
      tags: [{ slug: 'musica', label: 'Música' }],
      date: '2024-10-13T00:00:00Z',
    });
    const noMatch = makeItem({
      id: '3',
      title: 'No match',
      tags: [{ slug: 'otro', label: 'Otro' }],
    });

    const result = getRelatedItems(current, [current, matching, noMatch]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('falls back to same bundle when no tag overlap', () => {
    const current = makeItem({ id: '1', bundle: 'article', tags: [{ slug: 'x', label: 'X' }] });
    const sameBundle = makeItem({
      id: '2',
      bundle: 'article',
      tags: [{ slug: 'y', label: 'Y' }],
      date: '2024-10-13T00:00:00Z',
    });
    const diffBundle = makeItem({ id: '3', bundle: 'noticia', tags: [{ slug: 'z', label: 'Z' }] });

    const result = getRelatedItems(current, [current, sameBundle, diffBundle]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('returns empty array when no candidates', () => {
    const current = makeItem({ id: '1' });
    const result = getRelatedItems(current, [current]);
    expect(result).toHaveLength(0);
  });

  it('respects limit parameter', () => {
    const current = makeItem({ id: '1', bundle: 'article' });
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({
        id: `${i + 2}`,
        bundle: 'article',
        title: `Item ${i + 2}`,
        date: `2024-10-${10 + i}T00:00:00Z`,
      }),
    );

    expect(getRelatedItems(current, [current, ...items], 3)).toHaveLength(3);
    expect(getRelatedItems(current, [current, ...items], 1)).toHaveLength(1);
  });
});
