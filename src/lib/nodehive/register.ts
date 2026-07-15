import type { Lang } from '@/i18n';

function getBaseUrl(): string {
  const url = import.meta.env.NODEHIVE_BASE_URL;
  if (!url) throw new Error('NODEHIVE_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

export interface RegisterData {
  name: string;
  mail: string;
  lang?: Lang;
}

export interface RegisterResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

export async function registerUser(data: RegisterData): Promise<RegisterResult> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/user/register-lang?_format=json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: data.name,
        mail: data.mail,
        langcode: data.lang ?? 'es',
      }),
    });

    let json: Record<string, unknown> = {};
    try {
      json = await res.json();
    } catch {
      return {
        ok: false,
        statusCode: res.status,
        error: 'No se pudo crear la cuenta. Verifica la configuración del backend.',
      };
    }

    if (res.status < 200 || res.status >= 300) {
      const detail =
        (json?.errors as Array<{ detail: string }> | undefined)?.[0]?.detail ??
        (json?.message as string) ??
        'No se pudo crear la cuenta.';
      return { ok: false, statusCode: res.status === 422 ? 409 : res.status, error: detail };
    }

    return { ok: true };
  } catch (err) {
    console.error('[Register] Exception:', err);
    return { ok: false, statusCode: 503, error: 'No se pudo conectar con el servidor.' };
  }
}
