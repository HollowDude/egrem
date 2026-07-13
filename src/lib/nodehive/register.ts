function getBaseUrl(): string {
  const url = import.meta.env.NODEHIVE_BASE_URL;
  if (!url) throw new Error('NODEHIVE_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

export interface RegisterData {
  name: string;
  mail: string;
}

export interface RegisterResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

export async function registerUser(data: RegisterData): Promise<RegisterResult> {
  try {
    const body: Record<string, unknown> = {
      name: data.name,
      mail: data.mail,
    };

    const res = await fetch(`${getBaseUrl()}/user/register?_format=json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    let json: Record<string, unknown> = {};
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      const text = await res.text().catch(() => '');
      console.error('[Register] Non-JSON response:', text.slice(0, 500));
      const msg =
        res.status === 406
          ? 'El registro por API no está habilitado en Drupal. Activa el resource "rest_user_registration" en REST UI.'
          : 'No se pudo crear la cuenta. Revisa que el endpoint REST de registro esté configurado en Drupal.';
      return { ok: false, statusCode: res.status, error: msg };
    }

    if (res.status < 200 || res.status >= 300) {
      const detail =
        (json?.errors as Array<{ detail: string }> | undefined)?.[0]?.detail ??
        (json?.message as string) ??
        'No se pudo crear la cuenta.';
      return { ok: false, statusCode: res.status, error: detail };
    }

    return { ok: true };
  } catch (err) {
    console.error('[Register] Exception:', err);
    return { ok: false, statusCode: 503, error: 'No se pudo conectar con el servidor.' };
  }
}
