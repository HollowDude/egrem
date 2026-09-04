import { useEffect, useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { CheckoutOrderDetail, PlaceResult, ShippingMethod } from '@/lib/nodehive/checkout';
import type { TiendaInfo } from '@/types/tienda';
import { formatPrecio } from '@/lib/moneda';
import CheckoutBillingStep from './CheckoutBillingStep';
import CheckoutShippingAddressStep from './CheckoutShippingAddressStep';
import CheckoutShippingStep from './CheckoutShippingStep';
import CheckoutPaymentMethodStep from './CheckoutPaymentMethodStep';
import CheckoutPaymentStep from './CheckoutPaymentStep';
import CheckoutSuccess from './CheckoutSuccess';
import Alert from '@/components/ui/Alert';

interface Props {
  initialOrder: CheckoutOrderDetail;
  orderIds: number[];
  cartGroup: string | null;
  lang?: Lang;
  tiendas?: TiendaInfo[];
}

type WizardStep = 'billing' | 'shipping' | 'payment_method' | 'payment' | 'success';

function mapCheckoutStepToWizard(s: string | null | undefined): WizardStep {
  if (s === 'egrem_shipping_address' || s === 'egrem_shipping') return 'shipping';
  if (s === 'egrem_payment_method') return 'payment_method';
  if (s === 'egrem_payment') return 'payment';
  if (s === 'complete') return 'success';
  return 'billing';
}

export default function CheckoutWizard({ initialOrder, orderIds, cartGroup, lang = 'es', tiendas = [] }: Props) {
  const tr = useTranslations(lang);
  const [order, setOrder] = useState<CheckoutOrderDetail>(initialOrder);
  const [step, setStep] = useState<WizardStep>(mapCheckoutStepToWizard(initialOrder.checkoutStep));
  // Sub-fase dentro del cajón "Envío": primero método; dirección solo si es domicilio.
  const [shippingPhase, setShippingPhase] = useState<'method' | 'address'>('method');
  const [pendingShippingMethod, setPendingShippingMethod] = useState<ShippingMethod | null>(null);
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [placeResult, setPlaceResult] = useState<PlaceResult | null>(null);

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

  const [navError, setNavError] = useState('');

  async function goTo(target: WizardStep) {
    let backendStep: string;
    if (target === 'shipping') {
      // Al cajón de envío siempre se entra por el método; la dirección viene después si es domicilio.
      setShippingPhase('method');
      setPendingShippingMethod(null);
      backendStep = order.shippingProfile ? 'egrem_shipping' : 'egrem_shipping_address';
    } else {
      const map: Record<WizardStep, string> = {
        billing: 'egrem_billing',
        shipping: 'egrem_shipping_address', // antes: 'egrem_shipping'
        payment_method: 'egrem_payment_method',
        payment: 'egrem_payment',
        success: 'complete',
      };
      backendStep = map[target];
    }
    if (target === 'success') { setStep('success'); return; }
    setNavError('');
    try {
      const res = await fetch(`/api/checkout/${order.orderId}/step`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkout_step: backendStep }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data as { order?: CheckoutOrderDetail }).order) {
        setOrder((data as { order: CheckoutOrderDetail }).order);
        setStep(target);
      } else {
        setNavError('No se pudo cambiar de paso. Intenta de nuevo.');
      }
    } catch {
      setNavError('No se pudo cambiar de paso. Intenta de nuevo.');
    }
  }

  function handleSaved(updated: CheckoutOrderDetail) {
    setOrder(updated);
    const next = mapCheckoutStepToWizard(updated.checkoutStep);
    if (next !== step) {
      // Al entrar al cajón de envío se empieza por el método
      if (next === 'shipping') {
        setShippingPhase('method');
        setPendingShippingMethod(null);
      }
      setStep(next);
    } else {
      if (step === 'billing') {
        setShippingPhase('method');
        setPendingShippingMethod(null);
        setStep('shipping');
      }
      // En 'shipping' no se avanza a ciegas: método y dirección comparten cajón
      // y el re-render sigue a la fase local (method ↔ address).
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
        {!isSuccess && (
          <div className="checkout-stepper-mobile">
            <div className="flex justify-between text-caption font-bold uppercase" style={{ color: 'var(--color-text-secondary)' }}>
              <span>Paso {currentIdx + 1} de {steps.length}</span>
              <span style={{ color: 'var(--color-brand-primary)' }}>{steps[currentIdx]?.label}</span>
            </div>
            <div className="checkout-stepper-mobile-track">
              <div className="checkout-stepper-mobile-fill" style={{ width: `${((currentIdx + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        )}
        {!isSuccess && (
          <div className="checkout-stepper">
            {steps.map((s, idx) => {
              const isActive = step === s.key;
              const isDone = !isSuccess && currentIdx > idx;
              const isReachable = !isSuccess && idx <= currentIdx && !isActive;
              const isLast = idx === steps.length - 1;
              return (
                <div key={s.key} className="flex items-end flex-1">
                  <button
                    type="button"
                    disabled={!isReachable}
                    onClick={() => isReachable && goTo(s.key)}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 bg-transparent border-0 p-0"
                    style={{ cursor: isReachable ? 'pointer' : 'default', width: 'auto' }}
                    aria-label={s.label}
                  >
                    <div className={`checkout-step-dot ${isActive ? 'checkout-step-dot--active' : ''} ${isDone ? 'checkout-step-dot--done' : ''}`}>
                      {isDone ? <span className="icon text-[18px]">check</span> : idx + 1}
                    </div>
                    <span className={`checkout-step-label ${isActive ? 'checkout-step-label--active' : ''} ${isDone ? 'checkout-step-label--done' : ''}`}>{s.label}</span>
                  </button>
                  {!isLast && <div className={`checkout-step-line ${isDone ? 'checkout-step-line--done' : ''}`} />}
                </div>
              );
            })}
          </div>
        )}
        <Alert type="error" message={navError} />

        <div className="checkout-panel">
          {step === 'billing' && <CheckoutBillingStep order={order} lang={lang} onSaved={handleSaved} />}
          {step === 'shipping' && shippingPhase === 'method' && (
            <CheckoutShippingStep
              order={order}
              orderIds={orderIds}
              lang={lang}
              snapshot={snapshot}
              tiendas={tiendas}
              onSaved={handleSaved}
              onBack={() => goTo('billing')}
              onSelectDomicilio={(m) => {
                setPendingShippingMethod(m);
                setShippingPhase('address');
              }}
            />
          )}
          {step === 'shipping' && shippingPhase === 'address' && (
            <CheckoutShippingAddressStep
              order={order}
              lang={lang}
              pendingMethod={pendingShippingMethod}
              onSaved={handleSaved}
              onBack={() => setShippingPhase('method')}
            />
          )}
          {step === 'payment_method' && <CheckoutPaymentMethodStep order={order} lang={lang} onSaved={handleSaved} onBack={() => goTo('shipping')} />}
          {step === 'payment' && !isSuccess && (
            <CheckoutPaymentStep
              order={order}
              orderIds={orderIds}
              cartGroup={cartGroup}
              lang={lang}
              snapshot={snapshot}
              tiendas={tiendas}
              onBack={(t) => goTo(t)}
              onPlaced={(r) => {
                setPlaceResult(r);
                setStep('success');
              }}
            />
          )}
          {isSuccess && (
            <CheckoutSuccess result={placeResult ?? { placed: orderIds, errors: [], orders: orderIds.map((id) => ({ orderId: id, state: 'completed' })) }} summary={snapshot} lang={lang} tiendas={tiendas} />
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
              const talla = rec.talla as string | null;
              const color = rec.color as string | null;
              const edicion = rec.edicion as string | null;
              const formato = rec.formato as string | null;
              const imagen = rec.imagen as string | null;
              const vars = [talla && `Talla: ${talla}`, color && `Color: ${color}`, edicion && `Edición: ${edicion}`, formato && `Formato: ${formato}`].filter(Boolean).join(' · ');
              return (
                <div key={i} className="flex gap-2 text-small">
                  {imagen ? <img src={imagen} alt={title} className="w-10 h-10 rounded-lg object-cover shrink-0 border" style={{ borderColor: 'var(--color-form-border)' }} /> : <span className="w-10 h-10 rounded-lg bg-egrem-gray-light border flex items-center justify-center shrink-0" style={{ borderColor: 'var(--color-form-border)' }}><span className="icon text-[16px]" style={{ color: 'var(--color-egrem-gray)', opacity: 0.5 }}>inventory_2</span></span>}
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-sm truncate m-0" style={{ color: 'var(--color-egrem-black)' }}>{title}</p>
                    {vars && <p className="text-caption m-0" style={{ color: 'var(--color-text-secondary)' }}>{vars}</p>}
                    <p className="text-caption m-0" style={{ color: 'var(--color-text-secondary)' }}>Cantidad: {qty} · {price != null ? formatPrecio(price, lang) : ''}</p>
                  </div>
                  <span className="font-bold shrink-0">{price != null ? formatPrecio(price * qty, lang) : ''}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--color-form-border)' }}>
            <div className="flex justify-between text-small"><span style={{ color: 'var(--color-text-secondary)' }}>{tr('checkout.pago.subtotal')}</span><span className="font-bold">{formatPrecio(subtotal, lang)}</span></div>
            <div className="flex justify-between text-small"><span style={{ color: 'var(--color-text-secondary)' }}>Envío</span><span style={{ color: '#16a34a' }}>{order.shippingMethod && order.shippingMethod !== 'pickup' ? tr('checkout.pago.envio_metodo_domicilio').replace('{metodo}', tr(order.shippingMethod === 'express' ? 'checkout.pago.envio_expres' : 'checkout.pago.envio_estandar')) : tr('checkout.pago.envio_gratis')}</span></div>
            <div className="flex justify-between font-display font-bold text-h4 pt-2 border-t" style={{ borderColor: 'var(--color-form-border)' }}><span>{tr('checkout.pago.total')}</span><span style={{ color: 'var(--color-brand-primary)' }}>{formatPrecio(subtotal, lang)}</span></div>
          </div>
        </div>
      </aside>
    </div>
  );
}
