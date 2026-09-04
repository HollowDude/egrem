// NOTA: componente listo para cuando se habilite envío a domicilio (standard/express).
// Se debe renderizar entre CheckoutBillingStep y CheckoutShippingStep cuando el usuario
// elija un método distinto a "pickup". Mientras domicilio esté deshabilitado, este paso
// se salta siempre gracias al atajo de Drupal (PATCH /shipping {pickup} funciona
// estando aún en egrem_shipping_address).
import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import { PROVINCE_CODES } from '@/lib/cuba';
import PhoneInputField from '@/components/ui/PhoneInputField';
import { isValidPhoneNumber } from 'libphonenumber-js';

interface Props {
  lang?: Lang;
  onSave: (payload: Record<string, unknown>) => void;
  saving: boolean;
}

export default function CheckoutShippingAddressForm({ lang = 'es', onSave, saving }: Props) {
  const tr = useTranslations(lang);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [ciPassport, setCiPassport] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [province, setProvince] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!province) { setMunicipios([]); return; }
    let cancelled = false;
    async function load() {
      setLoadingMunicipios(true);
      try {
        const res = await fetch('/api/direcciones/municipios');
        if (!res.ok) return;
        const data = await res.json();
        let list: string[] = [];
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const provincias = ((data as Record<string, unknown>).provincias as Array<{ id: string; nombre: string; municipios: string[] }>) ?? [];
          const especiales = ((data as Record<string, unknown>).municipios_especiales as Array<{ id: string; nombre: string; municipios: string[] }>) ?? [];
          const all = [...provincias, ...especiales];
          const found = all.find((p) => p.id === province) ?? all.find((p) => p.nombre === province);
          if (found) list = found.municipios;
        }
        if (!cancelled) setMunicipios(list);
      } catch { if (!cancelled) setMunicipios([]); }
      finally { if (!cancelled) setLoadingMunicipios(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [province]);

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) { setError('El nombre y apellidos son obligatorios.'); return; }
    if (!phone.trim()) { setError('El teléfono es obligatorio.'); return; }
    if (!isValidPhoneNumber(phone)) { setError(tr('auth.register.error.phone_invalid')); return; }
    if (!ciPassport.trim()) { setError('El CI/Pasaporte es obligatorio.'); return; }
    if (!addressLine1.trim() || !province.trim() || !municipio.trim()) { setError(tr('auth.dashboard.address_empty')); return; }
    onSave({
      firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), ciPassport: ciPassport.trim(),
      countryCode: 'CU', administrativeArea: province.trim(), locality: municipio.trim(),
      addressLine1: addressLine1.trim(), addressLine2: addressLine2.trim(), postalCode: postalCode.trim(),
      isDefault, is_default: isDefault,
    });
  }

  const inputCls = 'w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm';
  return (
    <form onSubmit={handleSubmit} className="space-y-4 border rounded-xl p-4" style={{ borderColor: 'var(--color-form-border)' }}>
      {error && <p className="text-small" style={{ color: 'var(--color-form-error)' }}>{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{tr('auth.dashboard.first_name')}</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-egrem-black)' }} />
        </div>
        <div className="space-y-2">
          <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{tr('auth.dashboard.last_name')}</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-egrem-black)' }} />
        </div>
      </div>
      <PhoneInputField id="shipping-address-phone" value={phone} onChange={(v) => setPhone(v?.toString() ?? '')} label={tr('auth.dashboard.address_phone')} placeholder="+53 5 1234567" />
      <div className="space-y-2">
        <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{tr('auth.dashboard.address_ci_passport')}</label>
        <input value={ciPassport} onChange={(e) => setCiPassport(e.target.value)} className={inputCls} style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-egrem-black)' }} />
      </div>
      <div className="space-y-2">
        <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{tr('auth.dashboard.address_line1')}</label>
        <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputCls} style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-egrem-black)' }} />
      </div>
      <div className="space-y-2">
        <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{tr('auth.dashboard.address_line2')}</label>
        <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputCls} style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-egrem-black)' }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{tr('auth.dashboard.address_province')}</label>
          <select value={province} onChange={(e) => { setProvince(e.target.value); setMunicipio(''); }} className={inputCls} style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-egrem-black)' }}>
            <option value="">{tr('auth.dashboard.address_province')}</option>
            {Object.entries(PROVINCE_CODES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{tr('auth.dashboard.address_municipality')}</label>
          <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} disabled={!province || loadingMunicipios} className={`${inputCls} disabled:opacity-50`} style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-egrem-black)' }}>
            <option value="">{loadingMunicipios ? 'Cargando...' : tr('auth.dashboard.address_municipality')}</option>
            {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{tr('auth.dashboard.address_postal_code')}</label>
        <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputCls} style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-egrem-black)' }} />
      </div>
      <label className="flex items-center gap-3 py-2 cursor-pointer select-none">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 rounded border-2 accent-[var(--color-brand-primary)]" style={{ accentColor: 'var(--color-brand-primary)' }} />
        <span className="font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{tr('auth.dashboard.address_default')}</span>
        <span className="icon text-[16px]" style={{ color: isDefault ? 'var(--color-egrem-gold)' : 'var(--color-form-border)' }}>star</span>
      </label>
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary" style={{ width: 'auto', opacity: saving ? 0.6 : 1 } as React.CSSProperties}>{saving ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : tr('checkout.pago.continuar')}</button>
      </div>
    </form>
  );
}
