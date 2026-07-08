import type { DrupalLoginResponse, DrupalUserSession } from '@/types/drupal';

function getBaseUrl(): string {
  const url = import.meta.env.NODEHIVE_BASE_URL;
  if (!url) throw new Error('NODEHIVE_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

export async function loginWithDrupal(
  username: string,
  password: string,
): Promise<{ user: DrupalUserSession; raw: DrupalLoginResponse }> {
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
    // Only rely on HTTP status code, not error message text (which may be localized)
    if (res.status === 400 || res.status === 403) {
      throw new Error('INVALID_CREDENTIALS');
    }
    throw new Error(`DRUPAL_LOGIN_FAILED: ${res.status}`);
  }

  const raw: DrupalLoginResponse = await res.json();

  const setCookie = res.headers.get('set-cookie') || '';
  const sessionMatch = setCookie.match(/(SESS\w+)=([^;]+)/);
  const sessionName = sessionMatch ? sessionMatch[1] : '';
  const sessionId = sessionMatch ? sessionMatch[2] : '';

  const user: DrupalUserSession = {
    uid: raw.current_user.uid,
    name: raw.current_user.name,
    mail: raw.current_user.mail,
    roles: raw.current_user.roles ?? ['authenticated'],
    session_name: sessionName,
    session_id: sessionId,
  };

  return { user, raw };
}
