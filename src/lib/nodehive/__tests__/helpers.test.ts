import { describe, it, expect } from 'vitest';
import { findIncluded, findAllIncluded, resolveRelIds } from '../helpers';
import type { JsonApiResource, JsonApiRelationship } from '../client';

function mockResource(type: string, id: string): JsonApiResource {
  return { type, id, attributes: {} };
}

describe('findIncluded', () => {
  const included = [
    mockResource('node--article', '1'),
    mockResource('node--page', '2'),
    mockResource('media--image', '3'),
  ];

  it('finds a resource by type and id', () => {
    expect(findIncluded(included, 'node--article', '1')).toBeDefined();
  });

  it('returns undefined when not found', () => {
    expect(findIncluded(included, 'node--article', '999')).toBeUndefined();
  });

  it('returns undefined for empty included', () => {
    expect(findIncluded([], 'node--article', '1')).toBeUndefined();
  });

  it('returns undefined for undefined included', () => {
    expect(findIncluded(undefined, 'node--article', '1')).toBeUndefined();
  });
});

describe('findAllIncluded', () => {
  const included = [
    mockResource('paragraph--button', 'a'),
    mockResource('paragraph--text', 'b'),
    mockResource('paragraph--button', 'c'),
  ];

  it('finds all resources by type', () => {
    expect(findAllIncluded(included, 'paragraph--button')).toHaveLength(2);
  });

  it('returns empty array when type not present', () => {
    expect(findAllIncluded(included, 'node--event')).toEqual([]);
  });

  it('returns empty array for undefined included', () => {
    expect(findAllIncluded(undefined, 'paragraph--button')).toEqual([]);
  });
});

describe('resolveRelIds', () => {
  it('returns empty array for undefined relationship', () => {
    expect(resolveRelIds(undefined)).toEqual([]);
  });

  it('returns empty array for null data', () => {
    expect(resolveRelIds({ data: null })).toEqual([]);
  });

  it('wraps single identifier in array', () => {
    const rel: JsonApiRelationship = { data: { type: 'node--article', id: '1' } };
    expect(resolveRelIds(rel)).toEqual([{ type: 'node--article', id: '1' }]);
  });

  it('returns array as-is for multiple identifiers', () => {
    const rel: JsonApiRelationship = {
      data: [
        { type: 'node--article', id: '1' },
        { type: 'node--article', id: '2' },
      ],
    };
    expect(resolveRelIds(rel)).toHaveLength(2);
  });
});
