import { useEffect, useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { CheckoutOrderDetail } from '@/lib/nodehive/checkout';
import { formatPrecio } from '@/lib/moneda';
import CheckoutBillingStep from './CheckoutBillingStep';
import CheckoutShippingStep from './CheckoutShippingStep';
import CheckoutPaymentMethodStep from './CheckoutPaymentMethodStep';
import CheckoutPaymentStep from './CheckoutPaymentStep';

interface Props {
  initialOrder: CheckoutOrderDetail;
  orderIds: number[];
  cartGroup: string | null;
  lang?: Lang;
}

type WizardStep = 'billing' | 'shipping' | 'payment_method' | 'payment' | 'success';

function mapCheckoutStepToWizard(s: string | null | undefined): WizardStep {
  if (s === 'egrem_shipping') return 'shipping';
  if (s === 'egrem_payment_method') return 'payment_method';
  if (s === 'egrem_payment') return 'payment';
  if (s === 'complete') return 'success';
  return 'billing';
}

export default function CheckoutWizard({ initialOrder, orderIds, cartGroup, lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const [order, setOrder] = useState<CheckoutOrderDetail>(initialOrder);
  const [step, setStep] = useState<WizardStep>(mapCheckoutStepToWizard(initialOrder.checkoutStep));
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);

  const [fallbackItems, setFallbackItems] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('egrem_checkout_snapshot');
      if (raw) setSnapshot(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (snapshot) return;
    if (orderIds.length <= 1) return;
    let cancelled = false;
    async function loadFallback() {
      try {
        const results = await Promise.all(
          orderIds.map(async (id) => {
            const res = await fetch(`/api/checkout?order_id=${id}`);
            if (!res.ok) return null;
            const data = await res.json().catch(() => ({}));
            const ord = (data as { order?: Record<string, unknown> }).order;
            return ord?.items as unknown as Record<string, unknown>[] | undefined;
          }),
        );
        const all = results.filter(Boolean).flat() as Record<string, unknown>[];
        if (!cancelled && all.length > 0) setFallbackItems(all);
      } catch {}
    }
    loadFallback();
    return () => { cancelled = true; };
  }, [snapshot, orderIds]);

  const snapshotOrders = (snapshot as { orders?: Array<{ items: Array<Record<string, unknown>> }> } | null)?.orders;
  const snapshotItems = snapshotOrders ? snapshotOrders.flatMap((o) => o.items) : null;
  const displayItems = (snapshotItems as unknown as Record<string, unknown>[] | null) ?? fallbackItems ?? (order.items as unknown as Record<string, unknown>[]);

  const subtotal = (() => {
    if (snapshot && typeof (snapshot as Record<string, unknown>).subtotal === 'number') return (snapshot as { subtotal: number }).subtotal;
    if (fallbackItems) return fallbackItems.reduce((a, it) => a + (Number((it as Record<string, unknown>).unit_price ?? (it as Record<string, unknown>).unitPrice ?? 0) * Number((it as Record<string, unknown>).quantity ?? 1)), 0);
    return order.items.reduce((a, it) => a + (it.unitPrice ?? 0) * it.quantity, 0);
  })();

  async function goTo(target: WizardStep) {
    const map: Record<WizardStep, string> = {
      billing: 'egrem_billing',
      shipping: 'egrem_shipping',
      payment_method: 'egrem_payment_method',
      payment: 'egrem_payment',
      success: 'complete',
    };
    if (target === 'success') {
      setStep('success');
      return;
    }
    try {
      const res = await fetch(`/api/checkout/${order.orderId}/step`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkout_step: map[target] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data as { order?: CheckoutOrderDetail }).order) {
        setOrder((data as { order: CheckoutOrderDetail }).order);
        setStep(target);
      }
    } catch {}
    setStep(target);
  }

  function handleSaved(updated: CheckoutOrderDetail) {
    setOrder(updated);
    const next = mapCheckoutStepToWizard(updated.checkoutStep);
    if (next !== step) setStep(next);
    else {
      if (step === 'billing') setStep('shipping');
      else if (step === 'shipping') setStep('payment_method');
      else if (step === 'payment_method') setStep('payment');
    }
  }

  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: 'billing', label: tr('checkout.pago.paso_facturacion') },
    { key: 'shipping', label: tr('checkout.pago.paso_envio') },
    { key: 'payment_method', label: tr('checkout.pago.paso_pago_metodo') },
    { key: 'payment', label: tr('checkout.pago.paso_pago') },
  ];

  const stepOrder: WizardStep[] = ['billing', 'shipping', 'payment_method', 'payment'];
  const currentIdx = stepOrder.indexOf(step as WizardStep);
  const isSuccess = step === 'success';

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      <div className="flex-1 w-full">
        <div className="checkout-stepper">
          {steps.map((s, idx) => {
            const isActive = step === s.key;
            const isDone = !isSuccess && currentIdx > idx;
            const isLast = idx === steps.length - 1;
            return (
              <div key={s.key} className="flex items-end flex-1">
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={`checkout-step-dot ${isActive ? 'checkout-step-dot--active' : ''} ${isDone ? 'checkout-step-dot--done' : ''}`}>
                    {isDone ? <span className="icon text-[18px]">check</span> : idx + 1}
                  </div>
                  <span className={`checkout-step-label ${isActive ? 'checkout-step-label--active' : ''} ${isDone ? 'checkout-step-label--done' : ''}`}>{s.label}</span>
                </div>
                {!isLast && <div className={`checkout-step-line ${isDone ? 'checkout-step-line--done' : ''}`} />}
              </div>
            );
          })}
        </div>

        <div className="checkout-panel">
          {step === 'billing' && <CheckoutBillingStep order={order} lang={lang} onSaved={handleSaved} />}
          {step === 'shipping' && <CheckoutShippingStep order={order} orderIds={orderIds} lang={lang} snapshot={snapshot} onSaved={handleSaved} onBack={() => goTo('billing')} />}
          {step === 'payment_method' && <CheckoutPaymentMethodStep order={order} lang={lang} onSaved={handleSaved} onBack={() => goTo('shipping')} />}
          {step === 'payment' && !isSuccess && <CheckoutPaymentStep order={order} orderIds={orderIds} cartGroup={cartGroup} lang={lang} snapshot={snapshot} onBack={(t) => goTo(t)} onPlaced={() => setStep('success')} />}
          {isSuccess && (
            <div className="checkout-panel-body text-center py-10">
              <span className="icon text-[64px] mb-4" style={{ color: '#16a34a' }}>check_circle</span>
              <h2 className="text-h2 uppercase mb-2" style={{ color: '#16a34a' }}>{tr('checkout.pago.pedido_confirmado')}</h2>
              <p className="text-small mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                {orderIds.length > 1 ? `Pedidos #${orderIds.join(', #')}` : `Pedido #${order.orderId}`} · {formatPrecio(subtotal, lang)}
              </p>
              <p className="text-small mb-6" style={{ color: 'var(--color-text-secondary)' }}>{tr('checkout.pago.confirmacion_desc')}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="/mi-cuenta/pedidos" className="btn-primary no-underline" style={{ width: 'auto' } as React.CSSProperties}>{tr('checkout.pago.ver_pedidos')}</a>
                <a href="/tienda" className="px-6 py-3 rounded-xl border font-display font-bold text-sm uppercase tracking-wider no-underline text-center" style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-text-secondary)' } as React.CSSProperties}>{tr('checkout.pago.volver_tienda')}</a>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="w-full lg:w-[320px] lg:sticky lg:top-24">
        <div className="border rounded-2xl p-6 bg-white" style={{ borderColor: 'var(--color-form-border)' }}>
          <h3 className="font-display font-bold text-h4 uppercase mb-4">{tr('checkout.pago.resumen_pedido')}</h3>
          <div className="space-y-3 mb-4">
            {displayItems.map((it: unknown, i: number) => {
              const rec = it as Record<string, unknown>;
              const title = String(rec.title ?? (rec.sku as string) ?? '');
              const qty = Number(rec.quantity ?? 1);
              const price = rec.unit_price != null ? Number(rec.unit_price) : (rec.unitPrice as number | null);
              return (
                <div key={i} className="flex justify-between gap-2 text-small">
                  <span style={{ color: 'var(--color-text-secondary)' }} className="flex-1">{title} × {qty}</span>
                  <span className="font-bold">{price != null ? formatPrecio(price * qty, lang) : ''}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--color-form-border)' }}>
            <div className="flex justify-between text-small"><span style={{ color: 'var(--color-text-secondary)' }}>{tr('checkout.pago.subtotal')}</span><span className="font-bold">{formatPrecio(subtotal, lang)}</span></div>
            <div className="flex justify-between text-small"><span style={{ color: 'var(--color-text-secondary)' }}>Envío</span><span style={{ color: '#16a34a' }}>{tr('checkout.pago.envio_gratis')}</span></div>
            <div className="flex justify-between font-display font-bold text-h4 pt-2 border-t" style={{ borderColor: 'var(--color-form-border)' }}><span>{tr('checkout.pago.total')}</span><span style={{ color: 'var(--color-brand-primary)' }}>{formatPrecio(subtotal, lang)}</span></div>
          </div>
        </div>
      </aside>
    </div>
  );
}
