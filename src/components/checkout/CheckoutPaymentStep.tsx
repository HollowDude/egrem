import { useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { CheckoutOrderDetail } from '@/lib/nodehive/checkout';
import { formatPrecio } from '@/lib/moneda';
import Alert from '@/components/ui/Alert';

interface Props {
  order: CheckoutOrderDetail;
  orderIds: number[];
  cartGroup: string | null;
  lang?: Lang;
  snapshot: Record<string, unknown> | null;
  onBack: (step: 'billing' | 'shipping' | 'payment_method') => void;
  onPlaced: () => void;
}

export default function CheckoutPaymentStep({ order, lang = 'es', snapshot, onBack, onPlaced }: Props) {
  const tr = useTranslations(lang);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const subtotal = (() => {
    if (snapshot && typeof (snapshot as { subtotal?: number }).subtotal === 'number') return (snapshot as { subtotal: number }).subtotal;
    return order.items.reduce((a, it) => a + (it.unitPrice ?? 0) * it.quantity, 0);
  })();

  function instructionFor(method: string | null, orderId: number) {
    const key = `checkout.pago.instruccion_${method ?? 'efectivo'}` as string;
    const raw = tr(key);
    const val = raw === key ? tr('checkout.pago.instruccion_efectivo') : raw;
    return val.replace('{orderId}', String(orderId));
  }

  async function handlePlace() {
    setError('');
    setPlacing(true);
    try {
      const res = await fetch('/api/checkout/place', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'No se pudo confirmar.');
      try { sessionStorage.removeItem('egrem_checkout_snapshot'); } catch {}
      onPlaced();
    } catch (e) {
      setError(String((e as Error).message ?? 'Error al confirmar.'));
    } finally {
      setPlacing(false);
    }
  }

  const billing = order.billingProfile;
  return (
    <div>
      <div className="checkout-panel-header">
        <span className="icon text-[20px]" style={{ color: 'var(--color-brand-primary)' }}>receipt</span>
        <h3 className="font-display font-bold text-h4 uppercase m-0">{tr('checkout.pago.paso_pago')}</h3>
      </div>
      <div className="checkout-panel-body space-y-6">
        <Alert type="error" message={error} />
        <div className="border rounded-xl p-4" style={{ borderColor: 'var(--color-form-border)' }}>
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-display font-bold text-sm uppercase m-0">{tr('checkout.pago.facturacion_titulo')}</h4>
            <button type="button" onClick={() => onBack('billing')} className="text-caption font-bold uppercase" style={{ color: 'var(--color-brand-primary)' }}>{tr('checkout.pago.cambiar')}</button>
          </div>
          {billing ? (
            <div className="text-small" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="m-0 font-bold" style={{ color: 'var(--color-egrem-black)' }}>{billing.firstName} {billing.lastName} · {billing.phone}</p>
              <p className="m-0">{billing.address?.addressLine1}</p>
              <p className="m-0">{billing.address?.locality}, {billing.address?.administrativeArea}</p>
              <p className="m-0">CI: {billing.ciPassport}</p>
            </div>
          ) : <p className="text-small" style={{ color: 'var(--color-form-error)' }}>Sin dirección</p>}
        </div>
        <div className="border rounded-xl p-4" style={{ borderColor: 'var(--color-form-border)' }}>
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-display font-bold text-sm uppercase m-0">{tr('checkout.pago.envio_titulo')}</h4>
            <button type="button" onClick={() => onBack('shipping')} className="text-caption font-bold uppercase" style={{ color: 'var(--color-brand-primary)' }}>{tr('checkout.pago.cambiar')}</button>
          </div>
          <p className="text-small m-0" style={{ color: 'var(--color-text-secondary)' }}>{tr('checkout.pago.recogida_tienda')} — Gratis</p>
        </div>
        <div className="border rounded-xl p-4" style={{ borderColor: 'var(--color-form-border)' }}>
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-display font-bold text-sm uppercase m-0">{tr('checkout.pago.metodo_pago_titulo')}</h4>
            <button type="button" onClick={() => onBack('payment_method')} className="text-caption font-bold uppercase" style={{ color: 'var(--color-brand-primary)' }}>{tr('checkout.pago.cambiar')}</button>
          </div>
          <p className="text-small font-bold m-0" style={{ color: 'var(--color-egrem-black)' }}>{order.paymentMethod ?? '-'}</p>
          {order.paymentMethod && <p className="text-small mt-2" style={{ color: 'var(--color-text-secondary)' }}>{instructionFor(order.paymentMethod, order.orderId)}</p>}
        </div>
        <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--color-form-border)' }}>
          <div className="flex justify-between text-small"><span style={{ color: 'var(--color-text-secondary)' }}>{tr('checkout.pago.subtotal')}</span><span className="font-bold">{formatPrecio(subtotal, lang)}</span></div>
          <div className="flex justify-between text-small"><span style={{ color: 'var(--color-text-secondary)' }}>Envío</span><span style={{ color: '#16a34a' }}>{tr('checkout.pago.envio_gratis')}</span></div>
          <div className="flex justify-between font-display font-bold text-h4 pt-2 border-t" style={{ borderColor: 'var(--color-form-border)' }}><span>{tr('checkout.pago.total')}</span><span style={{ color: 'var(--color-brand-primary)' }}>{formatPrecio(subtotal, lang)}</span></div>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={handlePlace} disabled={placing} className="btn-primary" style={{ width: 'auto', opacity: placing ? 0.6 : 1 } as React.CSSProperties}>{placing ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : tr('checkout.pago.confirmar_pedido')}</button>
        </div>
      </div>
    </div>
  );
}
