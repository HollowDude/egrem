import type { Lang } from '@/i18n';

function getBaseUrl(): string {
  const url = import.meta.env.NODEHIVE_BASE_URL;
  if (!url) throw new Error('NODEHIVE_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

export interface ForgotPasswordResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

export interface CheckEmailResult {
  exists: boolean;
  statusCode?: number;
  error?: string;
}

export async function checkEmailExists(mail: string): Promise<CheckEmailResult> {
  try {
    const url = `${getBaseUrl()}/api/nodehive/check-email?mail=${encodeURIComponent(mail)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) {
      return {
        exists: Boolean(data?.exists),
        statusCode: res.status,
      };
    }

    return {
      exists: false,
      statusCode: res.status,
      error: (data?.message as string) ?? 'No se pudo verificar el correo.',
    };
  } catch (err) {
    console.error('[CheckEmail] Exception:', err);
    return { exists: false, statusCode: 503, error: 'No se pudo conectar con el servidor.' };
  }
}

export async function requestPasswordReset(
  mail: string,
  lang: Lang,
): Promise<ForgotPasswordResult> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/user/password-lang?_format=json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ mail, langcode: lang }),
    });

    if (res.status === 200 || res.status === 204) {
      return { ok: true };
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      ok: false,
      statusCode: res.status,
      error: (data?.message as string) ?? 'No se pudo enviar el correo de recuperación.',
    };
  } catch (err) {
    console.error('[ForgotPassword] Exception:', err);
    return { ok: false, statusCode: 503, error: 'No se pudo conectar con el servidor.' };
  }
}
