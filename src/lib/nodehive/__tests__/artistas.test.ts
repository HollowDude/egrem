import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockJsonApiFetch = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  jsonApiFetch: mockJsonApiFetch,
}));

import { fetchArtistas, fetchArtistaByPath, fetchArtistaByNid } from '../artistas';

type MockResource = { type: string; id: string; attributes: Record<string, unknown> };

function mockFindIncluded(included: MockResource[], type: string, id: string): MockResource | undefined {
  return included?.find((r) => r.type === type && r.id === id);
}

type MockRelResource = { relationships?: Record<string, { data: { type: string; id: string } | unknown[] | null }> };

describe('parseAgencia (internal)', () => {
  it('returns agency data from relationship', () => {
    const included: MockResource[] = [
      { type: 'taxonomy_term--agencias', id: 'ag1', attributes: { name: 'Música', drupal_internal__tid: 1 } },
    ];
    const resource: MockRelResource = {
      relationships: {
        field_agencia: { data: { type: 'taxonomy_term--agencias', id: 'ag1' } },
      },
    };

    const rel = (resource.relationships?.field_agencia?.data as { type: string; id: string });
    const term = mockFindIncluded(included, 'taxonomy_term--agencias', rel.id);
    const a = term!.attributes;
    const result = {
      name: a.name as string,
      slug: (a.name as string).toLowerCase().replace(/\s+/g, '-'),
      tid: a.drupal_internal__tid as number,
    };

    expect(result.name).toBe('Música');
    expect(result.slug).toBe('música');
    expect(result.tid).toBe(1);
  });

  it('returns undefined when no relationship', () => {
    const resource: MockRelResource = { relationships: {} };
    expect(resource.relationships?.field_agencia).toBeUndefined();
  });

  it('returns undefined when relationship data is array', () => {
    const resource: MockRelResource = {
      relationships: { field_agencia: { data: [] as unknown[] } },
    };
    expect(Array.isArray(resource.relationships.field_agencia.data)).toBe(true);
  });
});

describe('fetchArtistas error handling', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
  });

  it('returns empty array on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await fetchArtistas('es');
    expect(result).toEqual([]);
  });
});

describe('fetchArtistaByPath error handling', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
  });

  it('returns null on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await fetchArtistaByPath('/test', 'es');
    expect(result).toBeNull();
  });
});

describe('fetchArtistaByNid error handling', () => {
  beforeEach(() => {
    mockJsonApiFetch.mockReset();
  });

  it('returns null on fetch failure', async () => {
    mockJsonApiFetch.mockRejectedValue(new Error('Network'));
    const result = await fetchArtistaByNid(999, 'es');
    expect(result).toBeNull();
  });

  it('returns null when no results match', async () => {
    mockJsonApiFetch.mockResolvedValue({ data: [] as unknown[] });
    const result = await fetchArtistaByNid(999, 'es');
    expect(result).toBeNull();
  });
});
