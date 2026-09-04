import { useMemo } from 'react';
import { getAllCountries, getStatesOfCountry, getCitiesOfState, countryUsesAdminArea } from '@/lib/geo/drupalZones';
interface Props {
  countryCode: string;
  administrativeArea: string;
  locality: string;
  onChange: (v: { countryCode: string; administrativeArea: string; locality: string }) => void;
  labelCountry: string;
  labelProvince: string;
  labelCity: string;
}

const inputCls = 'w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm';
const labelCls = 'block font-display font-bold text-[11px] uppercase tracking-wider';
const CSS = { formBorder: 'var(--color-form-border)', textSecondary: 'var(--color-text-secondary)', egremBlack: 'var(--color-egrem-black)' };

export default function CountryStateCityFields({ countryCode, administrativeArea, locality, onChange, labelCountry, labelProvince, labelCity }: Props) {
  const countries = useMemo(() => getAllCountries(), []);
  const states = useMemo(() => (countryCode ? getStatesOfCountry(countryCode) : []), [countryCode]);
  // Drupal exige provincia vacía para países sin subdivisiones: se oculta el campo.
  // Si Drupal sí tiene pero la librería no, se deja texto libre como último recurso.
  const provinceNotApplicable = Boolean(countryCode) && states.length === 0 && !countryUsesAdminArea(countryCode);
  const cities = useMemo(
    () => (countryCode && administrativeArea ? getCitiesOfState(countryCode, administrativeArea) : []),
    [countryCode, administrativeArea],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className={labelCls} style={{ color: CSS.textSecondary }}>{labelCountry}</label>
        <select value={countryCode} onChange={(e) => onChange({ countryCode: e.target.value, administrativeArea: '', locality: '' })} className={inputCls} style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}>
          <option value="">{labelCountry}</option>
          {countries.map((c) => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!provinceNotApplicable && (
        <div className="space-y-2">
          <label className={labelCls} style={{ color: CSS.textSecondary }}>{labelProvince}</label>
          {states.length > 0 ? (
          <select value={administrativeArea} onChange={(e) => onChange({ countryCode, administrativeArea: e.target.value, locality: '' })} disabled={!countryCode} className={`${inputCls} disabled:opacity-50`} style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}>
            <option value="">{labelProvince}</option>
            {states.map((s) => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
          </select>
          ) : (
          <input value={administrativeArea} onChange={(e) => onChange({ countryCode, administrativeArea: e.target.value, locality })} disabled={!countryCode} className={`${inputCls} disabled:opacity-50`} style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }} placeholder={labelProvince} />
          )}
        </div>
        )}
        <div className="space-y-2">
          <label className={labelCls} style={{ color: CSS.textSecondary }}>{labelCity}</label>
          {cities.length > 0 ? (
            <select value={locality} onChange={(e) => onChange({ countryCode, administrativeArea, locality: e.target.value })} disabled={!administrativeArea} className={`${inputCls} disabled:opacity-50`} style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}>
              <option value="">{labelCity}</option>
              {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          ) : (
            <input value={locality} onChange={(e) => onChange({ countryCode, administrativeArea, locality: e.target.value })} disabled={!countryCode} className={`${inputCls} disabled:opacity-50`} style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }} placeholder={labelCity} />
          )}
        </div>
      </div>
    </div>
  );
}
