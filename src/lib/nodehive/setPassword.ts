import type { SessionUser } from '@/types/auth';

function getBaseUrl(): string {
  const url = import.meta.env.NODEHIVE_BASE_URL;
  if (!url) throw new Error('NODEHIVE_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

export interface SetPasswordData {
  uid: string;
  timestamp: string;
  hash: string;
  newPassword: string;
}

export interface SetPasswordResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
  data?: SessionUser;
}

export async function setPasswordFromOneTimeLogin(
  data: SetPasswordData,
): Promise<SetPasswordResult> {
  const baseUrl = getBaseUrl();

  try {
    const resetRes = await fetch(`${baseUrl}/api/nodehive/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        uid: data.uid,
        timestamp: data.timestamp,
        hash: data.hash,
        password: data.newPassword,
      }),
    });

    if (resetRes.status !== 200) {
      const resetData = (await resetRes.json().catch(() => ({}))) as Record<string, unknown>;
      const msg =
        (resetData?.error as string) ??
        (resetData?.message as string) ??
        'No se pudo establecer la contraseña.';
      return { ok: false, statusCode: resetRes.status, error: msg };
    }

    let userName = '';
    let userMail = '';
    try {
      const userRes = await fetch(
        `${baseUrl}/jsonapi/user/user?filter[drupal_internal__uid]=${encodeURIComponent(data.uid)}&page[limit]=1`,
        { headers: { Accept: 'application/vnd.api+json' } },
      );
      if (userRes.ok) {
        const userData = (await userRes.json()) as Record<string, unknown>;
        const userItem = (userData?.data as Array<Record<string, unknown>> | undefined)?.[0];
        userName =
          ((userItem?.attributes as Record<string, unknown> | undefined)?.name as string) ?? '';
        userMail =
          ((userItem?.attributes as Record<string, unknown> | undefined)?.mail as string) ?? '';
      }
    } catch {
      // non-blocking: auto-login may fail
    }

    const sessionResult = await doLoginAfterPasswordSet(baseUrl, userName, data.newPassword);
    if (sessionResult) {
      sessionResult.mail = userMail || sessionResult.mail;
    }

    return { ok: true, data: sessionResult };
  } catch (err) {
    console.error('[SetPassword] Exception:', err);
    return { ok: false, statusCode: 503, error: 'No se pudo conectar con el servidor.' };
  }
}

async function doLoginAfterPasswordSet(
  baseUrl: string,
  username: string,
  password: string,
): Promise<SessionUser | undefined> {
  try {
    const loginRes = await fetch(`${baseUrl}/user/login?_format=json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: username, pass: password }),
    });
    if (loginRes.ok) {
      const json = (await loginRes.json()) as Record<string, unknown>;
      const currentUser = json.current_user as Record<string, unknown> | undefined;
      if (currentUser) {
        return {
          uid: String(currentUser.uid ?? ''),
          name: (currentUser.name as string) ?? '',
          mail: (currentUser.mail as string) ?? '',
          roles: (currentUser.roles as string[]) ?? [],
          csrfToken: (json.csrf_token as string) ?? '',
          logoutToken: (json.logout_token as string) ?? '',
          accessToken: (json.access_token as string) ?? '',
        };
      }
    }
  } catch (err) {
    console.warn('[SetPassword] Auto-login failed:', err);
  }
  return undefined;
}
