/**
 * ubicacion.ts — Preferencia de zona (provincia/municipio) del usuario.
 *
 * La selección vive en una cookie `egrem_municipios` (no httpOnly: el popup y el
 * filtro client-side la leen sin round-trip). Se guarda como JSON de
 * `MunicipioSeleccionado[]`. El cálculo de qué tiendas están permitidas se hace
 * SIEMPRE contra el catálogo actual (`resolverTiendasPermitidas`), así si el
 * backend crea una tienda nueva en un municipio ya elegido, aparece sola, sin que
 * el usuario vuelva a elegir.
 */

import type { TiendaInfo } from '../../types/tienda';

export const MUNICIPIOS_COOKIE = 'egrem_municipios';
export const MUNICIPIOS_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 días

export interface MunicipioSeleccionado {
  provincia: string;
  municipio: string;
}

export function parseMunicipiosCookie(raw: string | undefined): MunicipioSeleccionado[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item: unknown) => {
        if (!item || typeof item !== 'object') return null;
        const o = item as Record<string, unknown>;
        // Compatibilidad: antes era provincia->ciudad, ahora provincia->municipio
        const provincia = (o.provincia as string) ?? '';
        const municipio = (o.municipio as string) ?? (o.ciudad as string) ?? '';
        if (!provincia || !municipio) return null;
        return { provincia, municipio } as MunicipioSeleccionado;
      })
      .filter((x): x is MunicipioSeleccionado => x !== null);
  } catch {
    return [];
  }
}

/**
 * Ids de tienda cuya provincia+municipio está en la selección.
 * Con selección vacía → conjunto vacío (sin filtro geográfico aplicado, pero el
 * listado no filtra por tienda a menos que el usuario elija zona).
 */
export function resolverTiendasPermitidas(
  seleccion: MunicipioSeleccionado[],
  catalogo: TiendaInfo[],
): Set<string> {
  if (!seleccion.length) return new Set();
  const claves = new Set(seleccion.map((s) => `${s.provincia}|${s.municipio}`));
  return new Set(
    catalogo
      .filter(
        (t) =>
          t.provincia &&
          t.municipio &&
          claves.has(`${t.provincia}|${t.municipio}`),
      )
      .map((t) => t.id),
  );
}
