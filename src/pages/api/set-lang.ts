import type { APIRoute } from 'astro';
import { isValidLang, LANG_COOKIE, LANG_COOKIE_MAX_AGE } from '@/i18n';

function isValidReturnTo(url: string): boolean {
  if (!url.startsWith('/')) return false;
  if (url.startsWith('//')) return false;
  return true;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const body = await request.formData();
  const lang = body.get('lang')?.toString() ?? '';
  const returnTo = body.get('returnTo')?.toString() ?? '/';

  if (!isValidLang(lang)) {
    return new Response('Invalid lang', { status: 400 });
  }

  cookies.set(LANG_COOKIE, lang, {
    path: '/',
    maxAge: LANG_COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: 'lax',
  });

  return redirect(isValidReturnTo(returnTo) ? returnTo : '/', 302);
};

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const lang = url.searchParams.get('lang') ?? '';
  const returnTo = url.searchParams.get('returnTo') ?? '/';

  if (!isValidLang(lang)) {
    return new Response('Invalid lang', { status: 400 });
  }

  cookies.set(LANG_COOKIE, lang, {
    path: '/',
    maxAge: LANG_COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: 'lax',
  });

  return redirect(isValidReturnTo(returnTo) ? returnTo : '/', 302);
};
