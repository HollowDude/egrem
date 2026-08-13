import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockJsonApiFetch = vi.hoisted(() => vi.fn());
const mockGetBaseUrlValue = vi.hoisted(() => vi.fn(() => 'http://drupal.local'));

vi.mock('../client', () => ({
  jsonApiFetch: mockJsonApiFetch,
  getBaseUrlValue: mockGetBaseUrlValue,
}));

import { isSubscribed, subscribe, unsubscribe } from '../newsletter';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  mockJsonApiFetch.mockReset();
  mockGetBaseUrlValue.mockReturnValue('http://drupal.local');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isSubscribed', () => {
  it('returns true when a matching node exists', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: [
        {
          type: 'node--suscripcion_boletin',
          id: 'abc-123',
          attributes: { title: 'a@b.c', field_correo_electronico: 'a@b.c', field_blog: 42 },
        },
      ],
    });
    await expect(isSubscribed('a@b.c', 42)).resolves.toBe(true);
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('field_correo_electronico'),
      'es',
    );
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('filter[field_blog][value]=42'),
      'es',
    );
  });

  it('is per-blog: a subscription to one blog does not match another', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({ data: [] });
    await expect(isSubscribed('a@b.c', 7)).resolves.toBe(false);
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('filter[field_blog][value]=7'),
      'es',
    );
    expect(mockJsonApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('filter[field_blog][value]=8'),
      'es',
    );
  });

  it('returns false when no node matches', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({ data: [] });
    await expect(isSubscribed('nadie@b.c', 42)).resolves.toBe(false);
  });

  it('returns false when the request fails', async () => {
    mockJsonApiFetch.mockRejectedValueOnce(new Error('network'));
    await expect(isSubscribed('a@b.c', 42)).resolves.toBe(false);
  });
});

describe('subscribe', () => {
  it('creates the node via JSON:API with Bearer token', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'n-1' } }));

    const result = await subscribe('a@b.c', 42, 'token-1', 'csrf-1', 'es');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/jsonapi/node/suscripcion_boletin');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
    const body = JSON.parse(init?.body as string);
    expect(body.data.attributes.field_correo_electronico).toBe('a@b.c');
    expect(body.data.attributes.field_blog).toBe(42);
    expect(body.data.attributes.title).toBe('a@b.c · blog 42');
  });

  it('falls back to REST when JSON:API fails', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({}, 403))
      .mockResolvedValueOnce(jsonResponse({ id: 42 }, 200));

    const result = await subscribe('a@b.c', 42, 'token-1', 'csrf-1', 'es');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain('/es/node?_format=json');
    expect((init?.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
    const body = JSON.parse(init?.body as string);
    expect(body.field_blog).toEqual([{ value: 42 }]);
  });

  it('returns an error when both attempts fail', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({}, 403))
      .mockResolvedValueOnce(jsonResponse({}, 500));

    const result = await subscribe('a@b.c', 42, 'token-1', 'csrf-1', 'es');

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns an error on network failure', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('failed to fetch'))
      .mockRejectedValueOnce(new TypeError('failed to fetch'));

    const result = await subscribe('a@b.c', 42, 'token-1', 'csrf-1', 'es');

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('unsubscribe', () => {
  it('deletes the matching subscription via JSON:API', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: [{ type: 'node--suscripcion_boletin', id: 'uuid-1' }],
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(null, 204));

    const result = await unsubscribe('a@b.c', 42, 'token-1', 'csrf-1', 'es');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/jsonapi/node/suscripcion_boletin/uuid-1');
    expect(init?.method).toBe('DELETE');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
    expect(mockJsonApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('filter[field_blog][value]=42'),
      'es',
    );
  });

  it('returns ok when there is nothing to delete', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({ data: [] });
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const result = await unsubscribe('nadie@b.c', 42, 'token-1', 'csrf-1', 'es');

    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an error when the DELETE fails', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: [{ type: 'node--suscripcion_boletin', id: 'uuid-1' }],
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 403));

    const result = await unsubscribe('a@b.c', 42, 'token-1', 'csrf-1', 'es');

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns an error when the lookup fails', async () => {
    mockJsonApiFetch.mockRejectedValueOnce(new Error('network'));
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const result = await unsubscribe('a@b.c', 42, 'token-1', 'csrf-1', 'es');

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
