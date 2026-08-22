import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockJsonApiFetch = vi.hoisted(() => vi.fn());
const mockGetBaseUrlValue = vi.hoisted(() => vi.fn(() => 'http://drupal.local'));

vi.mock('../client', () => ({
  jsonApiFetch: mockJsonApiFetch,
  getBaseUrlValue: mockGetBaseUrlValue,
}));

import { getComments, postComment } from '../comments';

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

describe('getComments', () => {
  it('marks published only when field_aprobado is true', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: [
        {
          type: 'comment--comment',
          id: 'approved-1',
          attributes: {
            comment_body: { value: 'Aprobado' },
            created: new Date().toISOString(),
            field_aprobado: true,
          },
          relationships: {
            pid: { data: null },
            uid: {
              data: { type: 'user--user', id: 'user-a', meta: { drupal_internal__target_id: 6 } },
            },
          },
        },
        {
          type: 'comment--comment',
          id: 'pending-1',
          attributes: {
            comment_body: { value: 'Pendiente' },
            created: new Date().toISOString(),
            field_aprobado: false,
          },
          relationships: {
            pid: { data: null },
            uid: {
              data: { type: 'user--user', id: 'user-a', meta: { drupal_internal__target_id: 6 } },
            },
          },
        },
      ],
      included: [],
    });

    const comments = await getComments('node-uuid');

    expect(comments).toHaveLength(2);
    expect(comments[0].status).toBe('published');
    expect(comments[1].status).toBe('pending');
    expect(comments[0].ownerUid).toBe(6);
  });

  it('keeps pending comments with their owner uid for server-side filtering', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: [
        {
          type: 'comment--comment',
          id: 'pending-1',
          attributes: {
            comment_body: { value: 'Sin aprobar' },
            created: new Date().toISOString(),
            field_aprobado: false,
          },
          relationships: {
            pid: { data: null },
            uid: {
              data: { type: 'user--user', id: 'user-b', meta: { drupal_internal__target_id: 12 } },
            },
          },
        },
      ],
      included: [],
    });

    const comments = await getComments('node-uuid');

    expect(comments).toHaveLength(1);
    expect(comments[0].status).toBe('pending');
    expect(comments[0].ownerUid).toBe(12);
  });

  it('parses the pid relationship as parentId', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({
      data: [
        {
          type: 'comment--comment',
          id: 'root-1',
          attributes: {
            comment_body: { value: 'Hello' },
            created: new Date().toISOString(),
            status: true,
          },
          relationships: { pid: { data: null } },
        },
        {
          type: 'comment--comment',
          id: 'reply-1',
          attributes: {
            comment_body: { value: 'Reply' },
            created: new Date().toISOString(),
            status: true,
          },
          relationships: { pid: { data: { type: 'comment--comment', id: 'root-1' } } },
        },
      ],
      included: [],
    });

    const comments = await getComments('node-uuid');

    expect(comments[0].parentId).toBeNull();
    expect(comments[1].parentId).toBe('root-1');
  });

  it('requests the pid include in the URL', async () => {
    mockJsonApiFetch.mockResolvedValueOnce({ data: [], included: [] });
    await getComments('node-uuid');
    expect(mockJsonApiFetch).toHaveBeenCalledWith(expect.stringContaining('include=uid,pid'), 'es');
  });

  it('returns an empty array when the request fails', async () => {
    mockJsonApiFetch.mockRejectedValueOnce(new Error('network'));
    await expect(getComments('node-uuid')).resolves.toEqual([]);
  });
});

describe('postComment', () => {
  it('posts via JSON:API without parentId when not given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'c-1', attributes: { status: false } } }));

    const result = await postComment(5, 'node-uuid-1', 'node--blog', 'token-1', 'csrf-1', 'Hola');

    expect(result.ok).toBe(true);
    expect(result.id).toBe('c-1');
    expect(result.status).toBe('pending');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/jsonapi/comment/comment');
    const body = JSON.parse(init?.body as string);
    expect(body.data.relationships.entity_id.data).toEqual({
      type: 'node--blog',
      id: 'node-uuid-1',
    });
    expect(body.data.relationships.pid).toBeUndefined();
  });

  it('posts via JSON:API with the parent relationship and marks published when field_aprobado is true', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 'c-2', attributes: { field_aprobado: true } } }),
      );

    const result = await postComment(
      5,
      'node-uuid-1',
      'node--blog',
      'token-1',
      'csrf-1',
      'Respuesta',
      'root-1',
    );

    expect(result.ok).toBe(true);
    expect(result.id).toBe('c-2');
    expect(result.status).toBe('published');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/jsonapi/comment/comment');
    const body = JSON.parse(init?.body as string);
    expect(body.data.relationships.entity_id.data).toEqual({
      type: 'node--blog',
      id: 'node-uuid-1',
    });
    expect(body.data.relationships.pid.data).toEqual({
      type: 'comment--comment',
      id: 'root-1',
    });
  });

  it('marks pending when Drupal returns field_aprobado false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ data: { id: 'c-3', attributes: { field_aprobado: false } } }),
    );

    const result = await postComment(5, 'node-uuid-1', 'node--blog', 'token-1', 'csrf-1', 'Hola');

    expect(result.ok).toBe(true);
    expect(result.status).toBe('pending');
  });

  it('falls back to REST with pid target_uuid', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({}, 403))
      .mockResolvedValueOnce(jsonResponse({ uuid: 'uuid-abc', id: 42 }, 200));

    const result = await postComment(
      5,
      'node-uuid-1',
      'node--blog',
      'token-1',
      'csrf-1',
      'Respuesta',
      'root-1',
    );

    expect(result.ok).toBe(true);
    expect(result.id).toBe('uuid-abc');
    expect(result.status).toBe('pending');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain('/es/comment?_format=json');
    const body = JSON.parse(init?.body as string);
    expect(body.pid).toEqual([{ target_uuid: 'root-1' }]);
  });

  it('returns the fallback error when both attempts fail', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({}, 403))
      .mockResolvedValueOnce(jsonResponse({}, 500));

    const result = await postComment(5, 'node-uuid-1', 'node--blog', 'token-1', 'csrf-1', 'Hola');

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns an error on network failure', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('failed to fetch'))
      .mockRejectedValueOnce(new TypeError('failed to fetch'));

    const result = await postComment(5, 'node-uuid-1', 'node--blog', 'token-1', 'csrf-1', 'Hola');

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
