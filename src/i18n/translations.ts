/**
 * Traducciones — diccionario plano organizado por namespaces.
 *
 * Cada namespace es un archivo separado en src/i18n/.
 * Para añadir una key nueva: agrégala al namespace correspondiente
 * (nav.ts, footer.ts, home.ts) en ambos idiomas.
 *
 * Consumir con:
 *   import { useTranslations } from '@/i18n/translations';
 *   const tr = useTranslations(lang);
 *   tr('nav.store')   // "Tienda"
 */

import type { Lang } from './index';
import { nav } from './nav';
import { footer } from './footer';
import { home } from './home';
import { accessibility } from './accessibility';
import { auth } from './auth';
import { actualidad } from './actualidad';

export const t: Record<Lang, Record<string, string>> = {
  es: { ...nav.es, ...footer.es, ...home.es, ...accessibility.es, ...auth.es, ...actualidad.es },
  en: { ...nav.en, ...footer.en, ...home.en, ...accessibility.en, ...auth.en, ...actualidad.en },
};

export function useTranslations(lang: Lang) {
  return (key: string): string => t[lang][key] ?? t['es'][key] ?? key;
}
