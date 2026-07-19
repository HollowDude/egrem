export interface JsonApiResource<A = Record<string, unknown>> {
  type: string;
  id: string;
  attributes: A;
  relationships?: Record<string, JsonApiRelationship>;
}

export interface JsonApiRelationship {
  data: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] | null;
}

export interface JsonApiResourceIdentifier {
  type: string;
  id: string;
  meta?: Record<string, unknown>;
}

export interface JsonApiResponse<A = Record<string, unknown>> {
  data: JsonApiResource<A> | JsonApiResource<A>[];
  included?: JsonApiResource[];
}

function getBaseUrl(): string {
  const url = import.meta.env.NODEHIVE_BASE_URL;
  if (!url) throw new Error('NODEHIVE_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

function getApiKey(): string {
  const key = import.meta.env.NODEHIVE_API_KEY;
  if (!key) throw new Error('NODEHIVE_API_KEY is not set');
  return key;
}

export async function jsonApiFetch<A = Record<string, unknown>>(
  path: string,
  lang = 'es',
): Promise<JsonApiResponse<A>> {
  const url = `${getBaseUrl()}/${lang}/jsonapi/${path}`.replace(/\[/g, '%5B').replace(/\]/g, '%5D');
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.api+json',
      'X-Auth-Token': getApiKey(),
    },
  });
  if (!res.ok) {
    throw new Error(`NodeHive fetch failed: ${res.status} ${res.statusText} — ${url}`);
  }
  return res.json();
}

export function getBaseUrlValue(): string {
  return getBaseUrl();
}
