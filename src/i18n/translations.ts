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
import { artistas } from './artistas';
import { musica } from './musica';
import { videos } from './videos';
import { about } from './about';
import { contacto } from './contacto';
import { evento } from './evento';
import { tienda } from './tienda';

export const t: Record<Lang, Record<string, string>> = {
  es: {
    ...nav.es,
    ...footer.es,
    ...home.es,
    ...accessibility.es,
    ...auth.es,
    ...actualidad.es,
    ...artistas.es,
    ...musica.es,
    ...videos.es,
    ...about.es,
    ...contacto.es,
    ...evento.es,
    ...tienda.es,
  },
  en: {
    ...nav.en,
    ...footer.en,
    ...home.en,
    ...accessibility.en,
    ...auth.en,
    ...actualidad.en,
    ...artistas.en,
    ...musica.en,
    ...videos.en,
    ...about.en,
    ...contacto.en,
    ...evento.en,
    ...tienda.en,
  },
};

export function useTranslations(lang: Lang) {
  return (key: string, vars?: Record<string, string | number>): string => {
    let value = t[lang][key] ?? t['es'][key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replaceAll(`{${k}}`, String(v));
      }
    }
    return value;
  };
}
