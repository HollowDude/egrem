const AUTH_PATHS = [
  '/login',
  '/registro',
  '/recuperar-contrasena',
  '/reset-password',
];

function stripQuery(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const queryIdx = clean.indexOf('?');
  return queryIdx === -1 ? clean : clean.slice(0, queryIdx);
}

export function isAuthPath(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const path = stripQuery(raw);
  return AUTH_PATHS.some((authPath) => path === authPath || path.startsWith(`${authPath}/`));
}

export function sanitizeRedirect(raw: string | null | undefined): string {
  if (!raw) return '/';
  if (isAuthPath(raw)) return '/';
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) {
    return raw;
  }
  return '/';
}