import type { AstroCookies } from 'astro';
import type { SessionUser } from '@/types/auth';
import { EncryptJWT, jwtDecrypt, type JWTPayload } from 'jose';

const COOKIE_NAME = 'egrem_session';
const SESSION_MAX_AGE = Number(import.meta.env.SESSION_MAX_AGE ?? 86400);

const _secret = import.meta.env.SESSION_SECRET as string | undefined;
if (!_secret || _secret.length < 32) {
  throw new Error(
    '[Session] SESSION_SECRET must be at least 32 characters.\n' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}
const ENC_KEY = new TextEncoder().encode(_secret).slice(0, 32);

export async function setSession(cookies: AstroCookies, user: SessionUser): Promise<void> {
  const payload: JWTPayload = {
    uid: user.uid,
    name: user.name,
    mail: user.mail,
    roles: user.roles,
    csrfToken: user.csrfToken,
    logoutToken: user.logoutToken,
    accessToken: user.accessToken,
  };

  const token = await new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .encrypt(ENC_KEY);

  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload?.exp as number | undefined;
    if (typeof exp !== 'number') return false;
    return Date.now() >= exp * 1000;
  } catch {
    return false;
  }
}

export async function getSession(cookies: AstroCookies): Promise<SessionUser | null> {
  const raw = cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const { payload } = await jwtDecrypt(raw, ENC_KEY);
    const accessToken = payload['accessToken'] as string | undefined;
    if (!accessToken || isJwtExpired(accessToken)) return null;

    return {
      uid: payload['uid'] as string,
      name: payload['name'] as string,
      mail: payload['mail'] as string,
      roles: payload['roles'] as string[],
      csrfToken: payload['csrfToken'] as string,
      logoutToken: payload['logoutToken'] as string,
      accessToken,
    };
  } catch {
    return null;
  }
}

export function destroySession(cookies: AstroCookies): void {
  cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}
