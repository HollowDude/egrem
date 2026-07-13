import { defineMiddleware } from 'astro:middleware';
import { isValidLang, DEFAULT_LANG, LANG_COOKIE, LANG_COOKIE_MAX_AGE } from '@/i18n';
import type { Lang } from '@/i18n';
import { getSession } from '@/lib/auth/session';

const NODEHIVE_BASE_URL = import.meta.env.NODEHIVE_BASE_URL as string | undefined;

const DRUPAL_ORIGIN: string | null = (() => {
  if (!NODEHIVE_BASE_URL) return null;
  try {
    return new URL(NODEHIVE_BASE_URL).origin;
  } catch {
    return null;
  }
})();

const FRAME_ANCESTORS = DRUPAL_ORIGIN ?? "'none'";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  const match = pathname.match(/^\/(es|en)(\/|$)/);
  if (match) {
    const prefixLang = match[1] as Lang;
    const rest = '/' + pathname.slice(match[0].length);

    context.locals.lang = prefixLang;
    context.cookies.set(LANG_COOKIE, prefixLang, {
      path: '/',
      maxAge: LANG_COOKIE_MAX_AGE,
      httpOnly: false,
      sameSite: 'lax',
    });

    return context.rewrite(rest + url.search);
  }

  const cookieLang = context.cookies.get(LANG_COOKIE)?.value ?? '';
  const lang: Lang = isValidLang(cookieLang) ? cookieLang : DEFAULT_LANG;
  context.locals.lang = lang;

  context.locals.user = await getSession(context.cookies);

  const response = await next();

  response.headers.set('X-Frame-Options', 'ALLOWALL');
  response.headers.set('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS};`);
  response.headers.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');

  return response;
});
