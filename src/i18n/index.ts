export const SUPPORTED_LANGS = ['es', 'en'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: Lang = 'es';
export const LANG_COOKIE = 'egrem_lang';
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isValidLang(lang: string): lang is Lang {
  return SUPPORTED_LANGS.includes(lang as Lang);
}
