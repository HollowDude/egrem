import { describe, it, expect } from 'vitest';
import { parseButton } from '../parsers';
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
