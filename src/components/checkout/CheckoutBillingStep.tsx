import { useEffect, useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { CheckoutOrderDetail } from '@/lib/nodehive/checkout';
import Alert from '@/components/ui/Alert';
import CheckoutBillingForm from './CheckoutBillingForm';

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
  isDefault: boolean;
}

interface Props {
  order: CheckoutOrderDetail;
  lang?: Lang;
  onSaved: (order: CheckoutOrderDetail) => void;
}

export default function CheckoutBillingStep({ order, lang = 'es', onSaved }: Props) {
  const tr = useTranslations(lang);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoadingList(true);
      try {
        const res = await fetch('/api/user/direcciones');
        if (res.ok) {
          const data = (await res.json()) as Direccion[];
          const list = Array.isArray(data) ? data : [];
          setDirecciones(list);
          // Auto-seleccionar la predeterminada si existe y aún no hay selección
          const def = list.find((d) => d.isDefault);
          if (def && !selected && !showForm) setSelected(def.uuid);
          // Si el pedido ya tiene billing, preseleccionar ese
          if (order.billingProfile?.profileId) {
            const match = list.find((d) => d.uuid === order.billingProfile?.profileUuid || d.uuid === order.billingProfile?.profileId);
            if (match) setSelected(match.uuid);
          }
        }
      } catch {}
      setLoadingList(false);
    }
    load();
  }, [order.billingProfile?.profileId]);

  async function handleContinue() {
    setError('');
    if (showForm) return;
    let profileId = selected;
    if (!profileId) {
      // Usar la predeterminada si existe
      const def = direcciones.find((d) => d.isDefault);
      if (def) profileId = def.uuid;
      else {
        // Intentar con body vacío para que Drupal use default si existe
        try {
          const res = await fetch(`/api/checkout/${order.orderId}/billing`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error((data as { error?: string }).error || 'Error');
          onSaved((data as { order: CheckoutOrderDetail }).order);
          return;
        } catch (e) {
          setError(tr('checkout.pago.selecciona_direccion'));
          return;
        }
      }
    }
    if (!profileId) {
      setError(tr('checkout.pago.selecciona_direccion'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/checkout/${order.orderId}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Error');
      onSaved((data as { order: CheckoutOrderDetail }).order);
    } catch (e) {
      setError(String((e as Error).message ?? 'No se pudo guardar.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleInlineSave(payload: Record<string, unknown>) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/checkout/${order.orderId}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Error');
      onSaved((data as { order: CheckoutOrderDetail }).order);
    } catch (e) {
      setError(String((e as Error).message ?? 'No se pudo guardar.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="checkout-panel-header">
        <span className="icon text-[20px]" style={{ color: 'var(--color-brand-primary)' }}>home</span>
        <h3 className="font-display font-bold text-h4 uppercase m-0">{tr('checkout.pago.paso_facturacion')}</h3>
      </div>
      <div className="checkout-panel-body space-y-4">
        <Alert type="error" message={error} />
        {loadingList ? (
          <div className="flex justify-center py-6"><span className="inline-block w-6 h-6 border-2 border-[var(--color-brand-primary)]/30 border-t-[var(--color-brand-primary)] rounded-full animate-spin" /></div>
        ) : (
          <>
            {direcciones.length === 0 && !showForm && <p className="text-small" style={{ color: 'var(--color-text-secondary)' }}>{tr('checkout.pago.sin_direcciones')}</p>}
            <div className="space-y-3">
              {direcciones.map((d) => (
                <div key={d.uuid} onClick={() => { setSelected(d.uuid); setShowForm(false); }} className={`checkout-option ${selected === d.uuid ? 'checkout-option--selected' : ''}`}>
                  <div className="checkout-radio"><div className="checkout-radio-dot" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold text-sm m-0">{d.firstName} {d.lastName}</p>
                      {d.isDefault && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border" style={{ background: 'var(--color-brand-primary)', color: '#fff', borderColor: 'var(--color-brand-primary)' }}><span className="icon text-[12px]">star</span> {tr('auth.dashboard.address_default')}</span>}
                    </div>
                    {d.phone && <p className="text-small m-0" style={{ color: 'var(--color-text-secondary)' }}>{d.phone}</p>}
                    <p className="text-small m-0" style={{ color: 'var(--color-text-secondary)' }}>{d.addressLine1} {d.addressLine2 ? `· ${d.addressLine2}` : ''}</p>
                    <p className="text-small m-0" style={{ color: 'var(--color-text-secondary)' }}>{d.locality}, {d.administrativeArea}</p>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => { setShowForm((v) => !v); setSelected(null); }} className="text-small font-bold uppercase tracking-wider" style={{ color: 'var(--color-brand-primary)' }}>{showForm ? 'Cancelar' : tr('checkout.pago.nueva_direccion')}</button>
            {showForm && <CheckoutBillingForm lang={lang} onSave={handleInlineSave} saving={saving} />}
            {!showForm && (
              <div className="flex justify-end pt-2">
                <button type="button" onClick={handleContinue} disabled={saving || !selected} className="btn-primary" style={{ width: 'auto', opacity: saving || !selected ? 0.6 : 1 } as React.CSSProperties}>{saving ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : tr('checkout.pago.continuar')}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
