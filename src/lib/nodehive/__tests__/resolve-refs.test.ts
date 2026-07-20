import { describe, it, expect } from 'vitest';
import { resolveActualidadRefs } from '../actualidad';
import type { JsonApiResource, JsonApiResourceIdentifier } from '../client';

function makeNode(
  overrides: Partial<JsonApiResource> & { id: string; type: string },
): JsonApiResource {
  return {
    id: overrides.id,
    type: overrides.type,
    attributes: {
      drupal_internal__nid: 1,
      title: 'Test',
      created: '2024-01-01T00:00:00Z',
      changed: '2024-01-01T00:00:00Z',
      status: true,
      path: { alias: null },
      ...overrides.attributes,
    },
    relationships: overrides.relationships,
  };
}

describe('resolveActualidadRefs', () => {
  it('returns empty array for empty refs', () => {
    const result = resolveActualidadRefs([], []);
    expect(result).toEqual([]);
  });

  it('returns empty array for undefined included', () => {
    const refs: JsonApiResourceIdentifier[] = [{ type: 'node--noticia', id: '1' }];
    const result = resolveActualidadRefs(refs, undefined);
    expect(result).toEqual([]);
  });

  it('resolves a single valid reference', () => {
    const included = [
      makeNode({
        id: 'uuid-1',
        type: 'node--noticia',
        attributes: {
          drupal_internal__nid: 42,
          title: 'My Noticia',
          created: '2024-06-15T10:00:00Z',
          status: true,
          body: { value: '<p>Body</p>', summary: 'Summary text' },
          field_autor: 'Author Name',
          path: { alias: '/actualidad/noticias/my-noticia' },
        },
      }),
    ];
    const refs: JsonApiResourceIdentifier[] = [{ type: 'node--noticia', id: 'uuid-1' }];

    const result = resolveActualidadRefs(refs, included);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('My Noticia');
    expect(result[0].nid).toBe(42);
    expect(result[0].bundle).toBe('noticia');
  });

  it('resolves media--document via field_boletin as attachment', () => {
    const included = [
      {
        type: 'node--boletin_archivo' as const,
        id: 'uuid-1',
        attributes: {
          drupal_internal__nid: 10,
          title: 'Boletín Enero',
          created: '2024-01-15T00:00:00Z',
          changed: '2024-01-15T00:00:00Z',
          status: true,
          path: { alias: null },
          field_fecha_original: '2024-01-15',
        },
        relationships: {
          field_boletin: {
            data: { type: 'media--document', id: 'doc-1' },
          },
        },
      },
      {
        type: 'media--document' as const,
        id: 'doc-1',
        attributes: { name: 'Boletín PDF' },
        relationships: {
          field_media_document: {
            data: { type: 'file--file', id: 'file-1' },
          },
        },
      },
      {
        type: 'file--file' as const,
        id: 'file-1',
        attributes: {
          filename: 'boletin-enero.pdf',
          uri: { url: 'http://drupal.local/files/boletin-enero.pdf' },
        },
      },
    ];
    const refs: JsonApiResourceIdentifier[] = [{ type: 'node--boletin_archivo', id: 'uuid-1' }];

    const result = resolveActualidadRefs(refs, included as unknown as JsonApiResource[]);
    expect(result).toHaveLength(1);
    expect(result[0].bundle).toBe('boletin_archivo');
    expect(result[0].image).toBeNull();
    expect(result[0].attachment).not.toBeNull();
    expect(result[0].attachment!.url).toBe('http://drupal.local/files/boletin-enero.pdf');
    expect(result[0].attachment!.filename).toBe('boletin-enero.pdf');
    expect(result[0].attachment!.title).toBe('Boletín PDF');
  });

  it('resolves file--file directly via field_boletin as attachment', () => {
    const included = [
      {
        type: 'node--boletin_archivo' as const,
        id: 'uuid-2',
        attributes: {
          drupal_internal__nid: 11,
          title: 'Boletín Febrero',
          created: '2024-02-01T00:00:00Z',
          changed: '2024-02-01T00:00:00Z',
          status: true,
          path: { alias: null },
          field_fecha_original: '2024-02-01',
        },
        relationships: {
          field_boletin: {
            data: { type: 'file--file', id: 'file-2' },
          },
        },
      },
      {
        type: 'file--file' as const,
        id: 'file-2',
        attributes: {
          filename: 'boletin-febrero.pdf',
          uri: { url: 'http://drupal.local/files/boletin-febrero.pdf' },
        },
      },
    ];
    const refs: JsonApiResourceIdentifier[] = [{ type: 'node--boletin_archivo', id: 'uuid-2' }];

    const result = resolveActualidadRefs(refs, included as unknown as JsonApiResource[]);
    expect(result).toHaveLength(1);
    expect(result[0].bundle).toBe('boletin_archivo');
    expect(result[0].image).toBeNull();
    expect(result[0].attachment).not.toBeNull();
    expect(result[0].attachment!.url).toBe('http://drupal.local/files/boletin-febrero.pdf');
    expect(result[0].attachment!.filename).toBe('boletin-febrero.pdf');
  });

  it('resolves media--image as image, null attachment', () => {
    const included = [
      {
        type: 'node--noticia' as const,
        id: 'uuid-1',
        attributes: {
          drupal_internal__nid: 20,
          title: 'Noticia con foto',
          created: '2024-06-15T10:00:00Z',
          changed: '2024-06-15T10:00:00Z',
          status: true,
          path: { alias: '/actualidad/noticias/foto' },
          body: { value: '<p>Body</p>', summary: 'Summary' },
        },
        relationships: {
          field_imagen_o_multimedia: {
            data: { type: 'media--image', id: 'img-1' },
          },
        },
      },
      {
        type: 'media--image' as const,
        id: 'img-1',
        attributes: { name: 'Photo' },
        relationships: {
          field_media_image: {
            data: { type: 'file--file', id: 'file-img' },
          },
        },
      },
      {
        type: 'file--file' as const,
        id: 'file-img',
        attributes: {
          filename: 'photo.jpg',
          uri: { url: 'http://drupal.local/images/photo.jpg' },
        },
      },
    ];
    const refs: JsonApiResourceIdentifier[] = [{ type: 'node--noticia', id: 'uuid-1' }];

    const result = resolveActualidadRefs(refs, included as unknown as JsonApiResource[]);
    expect(result).toHaveLength(1);
    expect(result[0].image).not.toBeNull();
    expect(result[0].image!.url).toBe('http://drupal.local/images/photo.jpg');
    expect(result[0].attachment).toBeNull();
  });

  it('skips references not in included', () => {
    const included = [
      makeNode({
        id: 'uuid-1',
        type: 'node--noticia',
        attributes: { drupal_internal__nid: 1, status: true, title: 'A' },
      }),
    ];
    const refs: JsonApiResourceIdentifier[] = [
      { type: 'node--noticia', id: 'uuid-1' },
      { type: 'node--noticia', id: 'uuid-2' },
    ];

    const result = resolveActualidadRefs(refs, included);
    expect(result).toHaveLength(1);
  });

  it('skips unpublished items', () => {
    const included = [
      makeNode({
        id: 'uuid-1',
        type: 'node--noticia',
        attributes: { drupal_internal__nid: 1, status: false, title: 'Unpub' },
      }),
    ];
    const refs: JsonApiResourceIdentifier[] = [{ type: 'node--noticia', id: 'uuid-1' }];

    const result = resolveActualidadRefs(refs, included);
    expect(result).toHaveLength(0);
  });

  it('resolves multiple bundles (noticia, article, blog)', () => {
    const included = [
      makeNode({
        id: 'n1',
        type: 'node--noticia',
        attributes: { drupal_internal__nid: 1, status: true, title: 'Nota' },
      }),
      makeNode({
        id: 'a1',
        type: 'node--article',
        attributes: { drupal_internal__nid: 2, status: true, title: 'Artículo' },
      }),
      makeNode({
        id: 'b1',
        type: 'node--blog',
        attributes: { drupal_internal__nid: 3, status: true, title: 'Blog post' },
      }),
    ];
    const refs: JsonApiResourceIdentifier[] = [
      { type: 'node--noticia', id: 'n1' },
      { type: 'node--article', id: 'a1' },
      { type: 'node--blog', id: 'b1' },
    ];

    const result = resolveActualidadRefs(refs, included);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.bundle)).toEqual(['noticia', 'article', 'blog']);
  });
});
