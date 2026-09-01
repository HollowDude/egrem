import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import Alert from '@/components/ui/Alert';
import { PROVINCE_CODES } from '@/lib/cuba';
import PhoneInputField from '@/components/ui/PhoneInputField';
import { isValidPhoneNumber } from 'libphonenumber-js';

interface Direccion {
  uuid: string;
  countryCode: string;
  administrativeArea: string;
  locality: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
  firstName: string;
  lastName: string;
  phone: string;
  ciPassport: string;
}

interface Props {
  lang?: Lang;
  direccion?: Direccion | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CSS = {
  formBorder: 'var(--color-form-border)',
  textSecondary: 'var(--color-text-secondary)',
  brandPrimary: 'var(--color-brand-primary)',
  egremBlack: 'var(--color-egrem-black)',
  egremGold: 'var(--color-egrem-gold)',
};

export default function AddressForm({ lang = 'es', direccion = null, onSuccess, onCancel }: Props) {
  const tr = useTranslations(lang as Lang);
  const isEdit = !!direccion;

  const [firstName, setFirstName] = useState(direccion?.firstName ?? '');
  const [lastName, setLastName] = useState(direccion?.lastName ?? '');
  const [addressLine1, setAddressLine1] = useState(direccion?.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(direccion?.addressLine2 ?? '');
  // administrativeArea en Drupal es el código de provincia (ej. "03"), no el nombre
  const initialProvinceCode = (() => {
    const raw = direccion?.administrativeArea ?? '';
    if (!raw) return '';
    // Si ya es un código (01-16), usarlo directo; si es el nombre, buscar el código
    if (PROVINCE_CODES[raw]) return raw;
    const found = Object.entries(PROVINCE_CODES).find(([, name]) => name === raw);
    return found ? found[0] : raw;
  })();
  const [province, setProvince] = useState(initialProvinceCode);
  const [municipio, setMunicipio] = useState(direccion?.locality ?? '');
  const [postalCode, setPostalCode] = useState(direccion?.postalCode ?? '');
  const [phone, setPhone] = useState(direccion?.phone ?? '');
  const [ciPassport, setCiPassport] = useState(direccion?.ciPassport ?? '');
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const provinceEntries = Object.entries(PROVINCE_CODES);

  useEffect(() => {
    if (!province) {
      setMunicipios([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingMunicipios(true);
      try {
        const res = await fetch('/api/direcciones/municipios');
        if (!res.ok) return;
        const data = await res.json();
        // Forma real de cuba.json (sede): { provincias: [{ nombre, municipios: [...] }], municipios_especiales: [...] }
        // Soportamos también formatos legacy por compatibilidad
        let list: string[] = [];
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const provincias = ((data as Record<string, unknown>).provincias as Array<{ id: string; nombre: string; municipios: string[] }>) ?? [];
          const especiales = ((data as Record<string, unknown>).municipios_especiales as Array<{ id: string; nombre: string; municipios: string[] }>) ?? [];
          const allProvinces = [...provincias, ...especiales];
          // province es el código (ej. "03"), buscar por id o por nombre por compatibilidad
          const found =
            allProvinces.find((p) => p.id === province) ?? allProvinces.find((p) => p.nombre === province);
          if (found) {
            list = found.municipios;
          } else if (Array.isArray((data as Record<string, unknown>)[province])) {
            list = (data as Record<string, unknown>)[province] as string[];
          } else if ((data as Record<string, unknown>).provinces && Array.isArray(((data as Record<string, unknown>).provinces as Record<string, unknown>)[province])) {
            list = ((data as Record<string, unknown>).provinces as Record<string, string[]>)[province];
          } else if (Array.isArray((data as Record<string, unknown>).provinces)) {
            const legacy = ((data as Record<string, unknown>).provinces as Array<{ name: string; municipios: string[] }>).find(
              (p) => p.name === province,
            );
            if (legacy) list = legacy.municipios;
          }
        }
        if (!cancelled) setMunicipios(list);
      } catch {
        if (!cancelled) setMunicipios([]);
      } finally {
        if (!cancelled) setLoadingMunicipios(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [province]);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('El nombre y apellidos son obligatorios.');
      return;
    }
    if (!phone.trim()) {
      setError('El teléfono es obligatorio.');
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setError(tr('auth.register.error.phone_invalid'));
      return;
    }
    if (!ciPassport.trim()) {
      setError('El CI/Pasaporte es obligatorio.');
      return;
    }
    if (!addressLine1.trim() || !province.trim() || !municipio.trim()) {
      setError(tr('auth.dashboard.address_empty'));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        countryCode: 'CU',
        administrativeArea: province.trim(),
        locality: municipio.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        postalCode: postalCode.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        ciPassport: ciPassport.trim(),
      };

      const url = isEdit ? `/api/user/direcciones/${direccion!.uuid}` : '/api/user/direcciones';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || 'No se pudo guardar la dirección.');
        return;
      }

      onSuccess?.();
    } catch {
      setError('No se pudo guardar la dirección.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border rounded-xl p-6 shadow-sm" style={{ borderColor: CSS.formBorder }}>
      <h4 className="text-h3 m-0 pb-2 mb-6 flex items-center gap-2 border-b" style={{ borderColor: CSS.formBorder }}>
        <span className="icon text-[20px]" style={{ color: CSS.egremGold }}>
          location_on
        </span>
        {isEdit ? tr('auth.dashboard.address_edit') : tr('auth.dashboard.address_add')}
      </h4>

      <Alert type="error" message={error} />

       <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
              {tr('auth.dashboard.first_name')}
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
              style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
            />
          </div>
          <div className="space-y-2">
            <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
              {tr('auth.dashboard.last_name')}
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
              style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
            />
          </div>
        </div>

        <PhoneInputField
          id="address-phone"
          value={phone}
          onChange={(v) => setPhone(v?.toString() ?? '')}
          label={tr('auth.dashboard.address_phone')}
          placeholder="+53 5 1234567"
        />

        <div className="space-y-2">
          <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
            {tr('auth.dashboard.address_ci_passport')}
          </label>
          <input
            type="text"
            value={ciPassport}
            onChange={(e) => setCiPassport(e.target.value)}
            className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
            style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
          />
        </div>

        <div className="space-y-2">
          <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
            {tr('auth.dashboard.address_line1')}
          </label>
          <input
            type="text"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
            style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
          />
        </div>

        <div className="space-y-2">
          <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
            {tr('auth.dashboard.address_line2')}
          </label>
          <input
            type="text"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
            style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
              {tr('auth.dashboard.address_province')}
            </label>
            <select
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                setMunicipio('');
              }}
              className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
              style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
            >
              <option value="">{tr('auth.dashboard.address_province')}</option>
              {provinceEntries.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
              {tr('auth.dashboard.address_municipality')}
            </label>
            <select
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              disabled={!province || loadingMunicipios}
              className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm disabled:opacity-50"
              style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
            >
              <option value="">
                {loadingMunicipios ? 'Cargando...' : tr('auth.dashboard.address_municipality')}
              </option>
              {municipios.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
            {tr('auth.dashboard.address_postal_code')}
          </label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
            style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
          />
        </div>

        <div className="pt-4 flex justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 rounded-xl border font-display font-bold text-sm uppercase tracking-wider transition-colors"
              style={{ borderColor: CSS.formBorder, color: CSS.textSecondary }}
            >
              Cancelar
            </button>
          )}
          <button type="submit" disabled={loading} className="btn-primary" style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              tr('auth.dashboard.address_save')
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
