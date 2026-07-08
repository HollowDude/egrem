import { defineMiddleware } from 'astro:middleware';
import { isValidLang, DEFAULT_LANG, LANG_COOKIE, LANG_COOKIE_MAX_AGE } from '@/i18n';
import type { Lang } from '@/i18n';
import { verifySessionCookie } from '@/lib/auth/session';

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

  // Detect /es/ or /en/ prefix → strip prefix, set lang, rewrite internally
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

  // Sin prefijo: usar cookie como antes
  const cookieLang = context.cookies.get(LANG_COOKIE)?.value ?? '';
  const lang: Lang = isValidLang(cookieLang) ? cookieLang : DEFAULT_LANG;
  context.locals.lang = lang;

  // Verify and deserialize user from signed session cookie
  const sessionCookie = context.cookies.get('egrem_session')?.value;
  context.locals.user = sessionCookie ? verifySessionCookie(sessionCookie) : null;

  const response = await next();

  // Allow Drupal admin to embed any page in an iframe for Live Preview
  response.headers.set('X-Frame-Options', 'ALLOWALL');
  response.headers.set('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS};`);
  response.headers.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');

  return response;
});
