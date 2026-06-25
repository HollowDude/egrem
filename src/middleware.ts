import { defineMiddleware } from 'astro:middleware';
import { isValidLang, DEFAULT_LANG, LANG_COOKIE } from '@/i18n';
import type { Lang } from '@/i18n';

export const onRequest = defineMiddleware(async (context, next) => {
  const cookieLang = context.cookies.get(LANG_COOKIE)?.value ?? '';
  const lang: Lang = isValidLang(cookieLang) ? cookieLang : DEFAULT_LANG;

  context.locals.lang = lang;

  return next();
});
