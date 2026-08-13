import { describe, it, expect } from 'vitest';
import { getRelatedItems, resolveRelated } from '../related';
import { parseActualidadNode } from '../actualidad';
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

function nodeResource(overrides: Record<string, unknown>) {
  const {
    id = 'n-1',
    nid = 1,
    title = 'Node',
    type = 'node--noticia',
    relationships = {},
  } = overrides as {
    id: string;
    nid: number;
    title: string;
    type: string;
    relationships: Record<string, unknown>;
  };
  return {
    type,
    id,
    attributes: {
      drupal_internal__nid: nid,
      title,
      created: '2024-10-12T12:00:00+00:00',
      changed: '2024-10-12T12:00:00+00:00',
      status: true,
      body: { value: '<p>x</p>', summary: '' },
      path: { alias: null },
    },
    relationships,
  };
}

function relatedRel(refs: { id: string; type: string }[]) {
  return {
    field_articulos_relacionados: { data: refs.map((r) => ({ type: r.type, id: r.id })) },
  };
}

describe('parseActualidadNode relatedContent', () => {
  it('resolves field_articulos_relacionados into relatedContent (noticia)', () => {
    const included = [
      nodeResource({
        id: 'a1',
        nid: 101,
        title: 'Artículo relacionado',
        type: 'node--article',
        relationships: {},
      }),
      nodeResource({
        id: 'b1',
        nid: 102,
        title: 'Blog relacionado',
        type: 'node--blog',
        relationships: {},
      }),
    ];
    const resource = nodeResource({
      id: 'n1',
      nid: 1,
      title: 'Noticia padre',
      type: 'node--noticia',
      relationships: relatedRel([
        { id: 'a1', type: 'node--article' },
        { id: 'b1', type: 'node--blog' },
      ]),
    });

    const item = parseActualidadNode(resource, included);

    expect(item?.relatedContent).toHaveLength(2);
    expect(item?.relatedContent?.[0]).toMatchObject({
      id: 'a1',
      nid: 101,
      title: 'Artículo relacionado',
      bundle: 'article',
    });
    expect(item?.relatedContent?.[1]).toMatchObject({ id: 'b1', bundle: 'blog' });
  });

  it('skips refs not present in included', () => {
    const resource = nodeResource({
      id: 'n1',
      nid: 1,
      title: 'Noticia padre',
      type: 'node--noticia',
      relationships: relatedRel([{ id: 'missing', type: 'node--article' }]),
    });

    const item = parseActualidadNode(resource, []);
    expect(item?.relatedContent).toBeUndefined();
  });

  it('leaves relatedContent undefined when the field is empty', () => {
    const resource = nodeResource({
      id: 'n1',
      nid: 1,
      title: 'Noticia padre',
      type: 'node--noticia',
      relationships: {},
    });

    const item = parseActualidadNode(resource, []);
    expect(item?.relatedContent).toBeUndefined();
    expect((item?.relatedContent ?? []).length).toBe(0);
  });

  it('does not parse relatedContent for blog bundle', () => {
    const resource = nodeResource({
      id: 'n1',
      nid: 1,
      title: 'Blog',
      type: 'node--blog',
      relationships: relatedRel([{ id: 'a1', type: 'node--article' }]),
    });

    const item = parseActualidadNode(resource, [
      nodeResource({ id: 'a1', nid: 101, title: 'Artículo', type: 'node--article' }),
    ]);
    expect(item?.relatedContent).toBeUndefined();
  });
});

describe('resolveRelated', () => {
  it('uses curated relatedContent when present', () => {
    const curated = makeItem({ id: '9', title: 'Curado' });
    const current = makeItem({ id: '1', relatedContent: [curated] });

    expect(resolveRelated(current, [current])).toEqual([curated]);
  });

  it('falls back to getRelatedItems when relatedContent is empty', () => {
    const current = makeItem({ id: '1', tags: [{ slug: 'musica', label: 'Música' }] });
    const matching = makeItem({
      id: '2',
      title: 'Matching',
      tags: [{ slug: 'musica', label: 'Música' }],
      date: '2024-10-13T00:00:00Z',
    });

    const result = resolveRelated(current, [current, matching]);
    expect(result).toEqual([matching]);
  });
});

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
