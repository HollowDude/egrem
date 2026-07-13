import type { SessionUser } from '@/types/drupal';

function getBaseUrl(): string {
  const url = import.meta.env.NODEHIVE_BASE_URL;
  if (!url) throw new Error('NODEHIVE_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

export async function loginWithDrupal(
  username: string,
  password: string,
): Promise<{ user: SessionUser; setCookie: string }> {
  const url = `${getBaseUrl()}/user/login?_format=json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ name: username, pass: password }),
  });

  if (!res.ok) {
    if (res.status === 400 || res.status === 403) {
      throw new Error('INVALID_CREDENTIALS');
    }
    throw new Error(`DRUPAL_LOGIN_FAILED: ${res.status}`);
  }

  const json: Record<string, unknown> = await res.json();

  const currentUser = json.current_user as Record<string, unknown> | undefined;

  let mail = '';
  const accessToken: string = (json.access_token as string) ?? '';
  const uid = String(currentUser?.uid ?? '');
  if (accessToken && uid) {
    try {
      const mailRes = await fetch(`${getBaseUrl()}/user/${uid}?_format=json`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      if (mailRes.ok) {
        const userData = (await mailRes.json()) as Record<string, unknown>;
        const mailField = userData?.mail as Array<{ value: string }> | undefined;
        mail = mailField?.[0]?.value ?? '';
      }
    } catch {}
  }

  const user: SessionUser = {
    uid,
    name: (currentUser?.name as string) ?? username,
    mail,
    roles: (currentUser?.roles as string[]) ?? ['authenticated'],
    csrfToken: (json.csrf_token as string) ?? '',
    logoutToken: (json.logout_token as string) ?? '',
    accessToken,
  };

  return { user, setCookie: res.headers.get('set-cookie') ?? '' };
}

export async function logoutFromDrupal(logoutToken: string): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/user/logout?_format=json&token=${logoutToken}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {}
}
