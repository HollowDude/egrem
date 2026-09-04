/**
 * Zonas para direcciones de facturación (país libre).
 *
 * `country-state-city` trabaja en memoria, pero sus códigos de provincia
 * NO siempre coinciden con lo que Drupal (commerceguys/addressing)
 * espera en `administrative_area`:
 * - US: coincide (ej. CA) — verificado contra Drupal 2026-09-03.
 * - MX: coincide con los códigos nuevos (ej. CMX, no DIF) — verificado.
 * - ES: NO coincide. La librería usa comunidades autónomas (MD = Madrid)
 *   y Drupal usa provincias (M = Madrid). Para ES se listan las 52
 *   provincias de Drupal y las ciudades se resuelven vía la comunidad CSC.
 */
import { Country, State, City } from 'country-state-city';

export interface ZoneOption {
  isoCode: string;
  name: string;
}

/** 52 provincias de Drupal (vendor/commerceguys/addressing ES.json). */
export const ES_PROVINCES: ZoneOption[] = [
  { isoCode: 'C', name: 'A Coruña' },
  { isoCode: 'VI', name: 'Álava' },
  { isoCode: 'AB', name: 'Albacete' },
  { isoCode: 'A', name: 'Alicante' },
  { isoCode: 'AL', name: 'Almería' },
  { isoCode: 'O', name: 'Asturias' },
  { isoCode: 'AV', name: 'Ávila' },
  { isoCode: 'BA', name: 'Badajoz' },
  { isoCode: 'PM', name: 'Balears' },
  { isoCode: 'B', name: 'Barcelona' },
  { isoCode: 'BU', name: 'Burgos' },
  { isoCode: 'CC', name: 'Cáceres' },
  { isoCode: 'CA', name: 'Cádiz' },
  { isoCode: 'S', name: 'Cantabria' },
  { isoCode: 'CS', name: 'Castellón' },
  { isoCode: 'CE', name: 'Ceuta' },
  { isoCode: 'CR', name: 'Ciudad Real' },
  { isoCode: 'CO', name: 'Córdoba' },
  { isoCode: 'CU', name: 'Cuenca' },
  { isoCode: 'GI', name: 'Girona' },
  { isoCode: 'GR', name: 'Granada' },
  { isoCode: 'GU', name: 'Guadalajara' },
  { isoCode: 'SS', name: 'Guipúzcoa' },
  { isoCode: 'H', name: 'Huelva' },
  { isoCode: 'HU', name: 'Huesca' },
  { isoCode: 'J', name: 'Jaén' },
  { isoCode: 'LO', name: 'La Rioja' },
  { isoCode: 'GC', name: 'Las Palmas' },
  { isoCode: 'LE', name: 'León' },
  { isoCode: 'L', name: 'Lleida' },
  { isoCode: 'LU', name: 'Lugo' },
  { isoCode: 'M', name: 'Madrid' },
  { isoCode: 'MA', name: 'Málaga' },
  { isoCode: 'ML', name: 'Melilla' },
  { isoCode: 'MU', name: 'Murcia' },
  { isoCode: 'NA', name: 'Navarra' },
  { isoCode: 'OR', name: 'Ourense' },
  { isoCode: 'P', name: 'Palencia' },
  { isoCode: 'PO', name: 'Pontevedra' },
  { isoCode: 'SA', name: 'Salamanca' },
  { isoCode: 'TF', name: 'Santa Cruz de Tenerife' },
  { isoCode: 'SG', name: 'Segovia' },
  { isoCode: 'SE', name: 'Sevilla' },
  { isoCode: 'SO', name: 'Soria' },
  { isoCode: 'T', name: 'Tarragona' },
  { isoCode: 'TE', name: 'Teruel' },
  { isoCode: 'TO', name: 'Toledo' },
  { isoCode: 'V', name: 'Valencia' },
  { isoCode: 'VA', name: 'Valladolid' },
  { isoCode: 'BI', name: 'Vizcaya' },
  { isoCode: 'ZA', name: 'Zamora' },
  { isoCode: 'Z', name: 'Zaragoza' },
];

/** Provincia Drupal → comunidad CSC (para buscar ciudades). */
const ES_DRUPAL_TO_CSC: Record<string, string> = {  C: 'GA', VI: 'PV', AB: 'CM', A: 'VC', AL: 'AN', O: 'AS', AV: 'AV',
  BA: 'EX', PM: 'PM', B: 'CT', BU: 'BU', CC: 'EX', CA: 'AN', S: 'CB',
  CS: 'VC', CE: 'CE', CR: 'CM', CO: 'AN', CU: 'CM', GI: 'CT', GR: 'AN',
  GU: 'CM', SS: 'PV', H: 'AN', HU: 'AR', J: 'AN', LO: 'RI', GC: 'CN',
  LE: 'LE', L: 'CT', LU: 'GA', M: 'MD', MA: 'AN', ML: 'ML', MU: 'MC',
  NA: 'NC', OR: 'GA', P: 'P', PO: 'GA', SA: 'SA', TF: 'CN', SG: 'SG',
  SE: 'AN', SO: 'SO', T: 'CT', TE: 'AR', TO: 'CM', V: 'VC', VA: 'VA',
  BI: 'PV', ZA: 'ZA', Z: 'AR',
};

export function getAllCountries(): ZoneOption[] {
  return Country.getAllCountries().map((c) => ({ isoCode: c.isoCode, name: c.name }));
}

/**
 * Países para los que Drupal (commerceguys/addressing) define subdivisiones.
 * Si el país NO está aquí, Drupal rechaza `administrative_area` con
 * "field must be blank" (verificado: AW, SG, VA...).
 * Fuente: vendor/commerceguys/addressing/resources/subdivision/*.json
 */
const DRUPAL_SUBDIVISION_COUNTRIES = new Set([
  'AD', 'AE', 'AM', 'AR', 'AU', 'BB', 'BR', 'BS', 'CA', 'CL', 'CN', 'CO', 'CR',
  'CU', 'CV', 'EE', 'EG', 'ES', 'FM', 'HK', 'HN', 'ID', 'IE', 'IN', 'IR', 'IT',
  'JM', 'JP', 'KI', 'KN', 'KP', 'KR', 'KY', 'KZ', 'MX', 'MY', 'MZ', 'NG', 'NI',
  'NR', 'PA', 'PE', 'PG', 'PH', 'PY', 'RU', 'SC', 'SO', 'SR', 'SV', 'TH', 'TR',
  'TV', 'TW', 'UA', 'UM', 'US', 'UY', 'VE', 'VN', 'ZW',
]);

/** true si Drupal acepta (y puede exigir) provincia para ese país. */
export function countryUsesAdminArea(countryCode: string): boolean {
  if (!countryCode) return false;
  return DRUPAL_SUBDIVISION_COUNTRIES.has(countryCode);
}

/**
 * Normaliza la provincia al valor que Drupal espera: '' cuando el país
 * no tiene subdivisiones en Drupal (evita el 422 "must be blank").
 */
export function normalizeAdminArea(countryCode: string, adminArea: string): string {
  if (!countryUsesAdminArea(countryCode)) return '';
  return adminArea;
}

/** Provincias/estados listables para un país (código Drupal en `isoCode`). */
export function getStatesOfCountry(countryCode: string): ZoneOption[] {
  if (!countryCode) return [];
  if (countryCode === 'ES') return ES_PROVINCES;
  // Sin subdivisiones en Drupal no hay nada listable: la provincia debe ir vacía.
  if (!countryUsesAdminArea(countryCode)) return [];
  return State.getStatesOfCountry(countryCode).map((s) => ({ isoCode: s.isoCode, name: s.name }));
}

/** Ciudades listables para un país + provincia (código Drupal en `adminArea`). */
export function getCitiesOfState(countryCode: string, adminArea: string): ZoneOption[] {
  if (!countryCode || !adminArea) return [];
  if (!countryUsesAdminArea(countryCode)) return [];
  const cscState = countryCode === 'ES' ? (ES_DRUPAL_TO_CSC[adminArea] ?? '') : adminArea;
  if (!cscState) return [];
  return City.getCitiesOfState(countryCode, cscState).map((c) => ({ isoCode: c.name, name: c.name }));
}

/**
 * Convierte el código de provincia seleccionado al valor que Drupal espera
 * en `administrative_area`. Hoy es identidad (los selects ya muestran
 * códigos Drupal), pero centraliza el ajuste si otro país diverge en el futuro.
 */
export function toDrupalAdminArea(countryCode: string, adminArea: string): string {
  void countryCode;
  return adminArea;
}
