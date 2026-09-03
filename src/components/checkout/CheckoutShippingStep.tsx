import { useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { CheckoutOrderDetail } from '@/lib/nodehive/checkout';
import { buscarTiendaParaOrden } from '@/lib/checkout/resolverTiendas';
import type { TiendaInfo } from '@/types/tienda';

interface Props {
  order: CheckoutOrderDetail;
  orderIds: number[];
  lang?: Lang;
  snapshot: Record<string, unknown> | null;
  tiendas: TiendaInfo[];
  onSaved: (order: CheckoutOrderDetail) => void;
  onBack: () => void;
}

export default function CheckoutShippingStep({ order, lang = 'es', snapshot, tiendas, onSaved, onBack }: Props) {
  const tr = useTranslations(lang);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tiendasPedido = (() => {
    const snapOrders = (snapshot as { orders?: Array<{ storeId?: string; store_id?: string; storeLabel?: string; store_label?: string }> } | null)?.orders;
    if (snapOrders?.length) {
      return snapOrders.map((o) => ({
        storeId: String(o.storeId ?? o.store_id ?? ''),
        storeLabel: String(o.storeLabel ?? o.store_label ?? ''),
      }));
    }
    return [{ storeId: String(order.storeId), storeLabel: '' }];
  })();

  const tiendasResueltas = tiendasPedido
    .map((p) => buscarTiendaParaOrden(tiendas, p.storeId, p.storeLabel))
    .filter((t): t is TiendaInfo => t !== null);
  const aMostrar = tiendasResueltas.length > 0 ? [...new Map(tiendasResueltas.map((t) => [t.id, t])).values()] : tiendas.slice(0, 1);

  async function handleContinue() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/checkout/${order.orderId}/shipping`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipping_method: 'pickup' }),
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
        <span className="icon text-[20px]" style={{ color: 'var(--color-brand-primary)' }}>local_shipping</span>
        <h3 className="font-display font-bold text-h4 uppercase m-0">{tr('checkout.pago.paso_envio')}</h3>
      </div>
      <div className="checkout-panel-body space-y-4">
        {error && <p className="text-small" style={{ color: 'var(--color-form-error)' }}>{error}</p>}
        {aMostrar.map((t) => (
          <div key={t.id} className="checkout-option checkout-option--selected checkout-option--static">
            <span className="icon text-[20px]" style={{ color: 'var(--color-brand-primary)', marginTop: '2px' } as React.CSSProperties}>storefront</span>
            <div className="flex-1">
              <p className="font-display font-bold text-sm m-0">{tr('checkout.pago.recogida_tienda')} — {t.label}</p>
              <p className="text-small m-0" style={{ color: 'var(--color-text-secondary)' }}>{t.direccion ?? `${t.municipio}, ${t.provincia}`}</p>
              <p className="text-small font-bold m-0" style={{ color: '#16a34a' }}>Gratis</p>
            </div>
          </div>
        ))}
        <p className="text-caption">{tr('checkout.pago.domicilio_proximamente')}</p>
        <div className="flex justify-between pt-2 gap-3">
          <button type="button" onClick={onBack} className="px-6 py-3 rounded-xl border font-display font-bold text-sm uppercase tracking-wider" style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-text-secondary)' } as React.CSSProperties}>{tr('checkout.pago.regresar')}</button>
          <button type="button" onClick={handleContinue} disabled={saving} className="btn-primary" style={{ width: 'auto', opacity: saving ? 0.6 : 1 } as React.CSSProperties}>{saving ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : tr('checkout.pago.continuar')}</button>
        </div>
      </div>
    </div>
  );
}
