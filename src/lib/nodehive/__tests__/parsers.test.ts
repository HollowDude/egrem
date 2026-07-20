import { describe, it, expect } from 'vitest';
import { parseButton, parseMediaDocument } from '../parsers';
import type { JsonApiResource } from '../client';

function mockButtonResource(overrides: Record<string, unknown> = {}): JsonApiResource {
  return {
    type: 'paragraph--button',
    id: 'btn-1',
    attributes: {
      field_title: 'Click me',
      field_style: 'primary',
      field_link: { uri: '/catalogo', title: 'Ver catálogo' },
      ...overrides,
    },
  };
}

describe('parseButton', () => {
  it('parses a button with all fields', () => {
    const res = mockButtonResource();
    const btn = parseButton(res);
    expect(btn.id).toBe('btn-1');
    expect(btn.title).toBe('Click me');
    expect(btn.style).toBe('primary');
    expect(btn.link).toEqual({ uri: '/catalogo', title: 'Ver catálogo' });
  });

  it('parses a secondary button', () => {
    const res = mockButtonResource({ field_style: 'secondary' });
    expect(parseButton(res).style).toBe('secondary');
  });

  it('handles missing link gracefully', () => {
    const res = mockButtonResource({ field_link: null });
    expect(parseButton(res).link).toBeNull();
  });

  it('handles missing title', () => {
    const res = mockButtonResource({ field_title: null });
    expect(parseButton(res).title).toBe('');
  });
});

function mockDocumentMedia(overrides: Record<string, unknown> = {}): {
  mediaRes: JsonApiResource;
  included: JsonApiResource[];
} {
  const mediaRes: JsonApiResource = {
    type: 'media--document',
    id: 'doc-1',
    attributes: { name: 'Boletín 2024', ...overrides },
    relationships: {
      field_media_document: {
        data: { type: 'file--file', id: 'file-1' },
      },
    },
  };
  const included: JsonApiResource[] = [
    mediaRes,
    {
      type: 'file--file',
      id: 'file-1',
      attributes: {
        filename: 'boletin-2024.pdf',
        uri: { url: '/files/boletin-2024.pdf' },
      },
    },
  ];
  return { mediaRes, included };
}

describe('parseMediaDocument', () => {
  it('parses a document with all fields', () => {
    const { mediaRes, included } = mockDocumentMedia();
    const result = parseMediaDocument(mediaRes, included);
    expect(result).not.toBeNull();
    expect(result!.url).toBe('/files/boletin-2024.pdf');
    expect(result!.filename).toBe('boletin-2024.pdf');
    expect(result!.title).toBe('Boletín 2024');
  });

  it('returns null when file reference is missing', () => {
    const mediaRes: JsonApiResource = {
      type: 'media--document',
      id: 'doc-empty',
      attributes: { name: 'Empty' },
      relationships: {},
    };
    expect(parseMediaDocument(mediaRes, [mediaRes])).toBeNull();
  });

  it('returns null when file not in included', () => {
    const mediaRes: JsonApiResource = {
      type: 'media--document',
      id: 'doc-2',
      attributes: { name: 'Missing' },
      relationships: {
        field_media_document: {
          data: { type: 'file--file', id: 'file-missing' },
        },
      },
    };
    expect(parseMediaDocument(mediaRes, [mediaRes])).toBeNull();
  });
});
