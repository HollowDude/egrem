import { defineMiddleware } from 'astro:middleware';
import { isValidLang, DEFAULT_LANG, LANG_COOKIE, LANG_COOKIE_MAX_AGE } from '@/i18n';
import type { Lang } from '@/i18n';

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

  return next();
});
