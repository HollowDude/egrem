import { useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { CheckoutOrderDetail, PaymentMethodValue } from '@/lib/nodehive/checkout';

interface Props {
  order: CheckoutOrderDetail;
  lang?: Lang;
  onSaved: (order: CheckoutOrderDetail) => void;
  onBack: () => void;
}

const OPTIONS: Array<{ value: PaymentMethodValue; label: string; icon: string; desc: string }> = [
  { value: 'efectivo', label: 'Efectivo', icon: 'payments', desc: 'Pagas al recoger tu pedido en tienda.' },
  { value: 'transfermovil', label: 'Transfermóvil', icon: 'qr_code_2', desc: 'Pago con QR, confirmación al instante.' },
];
// TODO: reactivar transferencia/enzona cuando se habiliten
// { value: 'transferencia', label: 'Transferencia', icon: 'account_balance' },
// { value: 'enzona', label: 'EnZona', icon: 'qr_code_2' },

export default function CheckoutPaymentMethodStep({ order, lang = 'es', onSaved, onBack }: Props) {
  const tr = useTranslations(lang);
  const [selected, setSelected] = useState<PaymentMethodValue | null>((order.paymentMethod as PaymentMethodValue) ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    if (!selected) { setError('Selecciona un método de pago.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/checkout/${order.orderId}/payment-method`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: selected }),
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
        <span className="icon text-[20px]" style={{ color: 'var(--color-brand-primary)' }}>payments</span>
        <h3 className="font-display font-bold text-h4 uppercase m-0">{tr('checkout.pago.paso_pago_metodo')}</h3>
      </div>
      <div className="checkout-panel-body space-y-4">
        {error && <p className="text-small" style={{ color: 'var(--color-form-error)' }}>{error}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {OPTIONS.map((opt) => (
            <div key={opt.value} onClick={() => setSelected(opt.value)} className={`checkout-option flex-col items-center text-center ${selected === opt.value ? 'checkout-option--selected' : ''}`}>
              <span className="icon text-[28px]" style={{ color: selected === opt.value ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)' }}>{opt.icon}</span>
              <span className="font-display font-bold text-[11px] uppercase tracking-wider">{opt.label}</span>
              <span className="text-caption text-center" style={{ color: 'var(--color-text-secondary)' }}>{opt.desc}</span>
              <div className="checkout-radio"><div className="checkout-radio-dot" /></div>
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-2 gap-3">
          <button type="button" onClick={onBack} className="px-6 py-3 rounded-xl border font-display font-bold text-sm uppercase tracking-wider" style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-text-secondary)' } as React.CSSProperties}>{tr('checkout.pago.regresar')}</button>
          <button type="button" onClick={handleContinue} disabled={saving || !selected} className="btn-primary" style={{ width: 'auto', opacity: saving || !selected ? 0.6 : 1 } as React.CSSProperties}>{saving ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : tr('checkout.pago.continuar')}</button>
        </div>
      </div>
    </div>
  );
}
