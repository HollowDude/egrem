import { useEffect, useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { PlaceResult } from '@/lib/nodehive/checkout';
import { formatPrecio } from '@/lib/moneda';
import { fetchTiendas } from '@/lib/nodehive/tiendas';
import type { TiendaInfo } from '@/types/tienda';

interface Props {
  result: PlaceResult;
  summary: Record<string, unknown> | null;
  lang?: Lang;
}

export default function CheckoutSuccess({ result, summary, lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const [tiendas, setTiendas] = useState<Map<string, TiendaInfo>>(new Map());

  useEffect(() => {
    fetchTiendas(lang).then((list) => {
      const m = new Map<string, TiendaInfo>();
      for (const t of list) m.set(String(t.id), t);
      setTiendas(m);
    });
  }, [lang]);

  useEffect(() => {
    try { sessionStorage.removeItem('egrem_checkout_snapshot'); } catch {}
  }, []);

  // Mapear snapshot por orderId para obtener items por tienda
  const snapshotOrders = (summary as { orders?: Array<Record<string, unknown>> } | null)?.orders as Array<Record<string, unknown>> | undefined;
  const itemsByOrder = new Map<number, Array<{ title: string; quantity: number; unitPrice: number | null; imagen?: string | null; talla?: string | null; color?: string | null; edicion?: string | null; formato?: string | null; sku?: string | null }>>();
  const storeIdByOrder = new Map<number, string>();
  const storeLabelByOrder = new Map<number, string>();
  if (snapshotOrders) {
    for (const o of snapshotOrders) {
      const oid = Number((o as Record<string, unknown>).orderId ?? 0);
      if (!oid) continue;
      const items = ((o as Record<string, unknown>).items as Array<Record<string, unknown>>).map((it) => ({
        title: String(it.title ?? ''),
        quantity: Number(it.quantity ?? 1),
        unitPrice: it.unit_price != null ? Number(it.unit_price) : (it.unitPrice as number | null),
        imagen: (it.imagen as string | null) ?? null,
        talla: (it.talla as string | null) ?? null,
        color: (it.color as string | null) ?? null,
        edicion: (it.edicion as string | null) ?? null,
        formato: (it.formato as string | null) ?? null,
        sku: (it.sku as string | null) ?? null,
      }));
      itemsByOrder.set(oid, items);
      const sid = String((o as Record<string, unknown>).storeId ?? (o as Record<string, unknown>).store_id ?? '');
      if (sid) storeIdByOrder.set(oid, sid);
      if ((o as Record<string, unknown>).storeLabel) storeLabelByOrder.set(oid, String((o as Record<string, unknown>).storeLabel));
    }
  }

  const hasErrors = result.errors && result.errors.length > 0;
  const placedOrders: Array<{ orderId: number; state: string; storeLabel?: string; total?: number; storeId?: string | number }> = result.orders.length > 0 ? (result.orders as Array<{ orderId: number; state: string; storeLabel?: string; total?: number; storeId?: string | number }>) : result.placed.map((id) => ({ orderId: id, state: 'completed' }));

  const isEfectivo = (() => {
    // Detectar si es efectivo por el summary o por result (si no hay info, asumir efectivo)
    const fromSummary = (summary as { paymentMethod?: string } | null)?.paymentMethod as string | undefined;
    return fromSummary ? fromSummary === 'efectivo' : true;
  })();

  return (
    <div className="checkout-panel-body text-center py-6 space-y-6">
      <div>
        <span className="icon text-[64px] mb-2" style={{ color: '#16a34a' }}>check_circle</span>
        <h2 className="text-h2 uppercase mb-2" style={{ color: '#16a34a' }}>{tr('checkout.pago.pedido_confirmado')}</h2>
        {isEfectivo ? (
          <>
            <p className="text-small font-bold" style={{ color: 'var(--color-egrem-black)' }}>Dirígete a la tienda para recoger y pagar tu pedido.</p>
            <p className="text-small mt-1" style={{ color: 'var(--color-text-secondary)' }}>Presenta el número de pedido en la tienda indicada. Pago en efectivo al recoger.</p>
          </>
        ) : (
          <>
            <p className="text-small" style={{ color: 'var(--color-text-secondary)' }}>{tr('checkout.pago.confirmacion_desc')}</p>
            <p className="text-small font-bold mt-2" style={{ color: 'var(--color-text-secondary)' }}>Guarda estos números de pedido — los necesitarás si vas a recoger en tienda.</p>
          </>
        )}
      </div>

      {hasErrors && (
        <div className="border rounded-xl p-4 bg-red-50 text-left" style={{ borderColor: 'rgba(204,0,0,0.2)' }}>
          <p className="font-display font-bold text-sm mb-2" style={{ color: 'var(--color-brand-primary)' }}>Algunas órdenes no se pudieron colocar:</p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-small" style={{ color: 'var(--color-form-error)' }}>{e.orderId ? `Pedido #${e.orderId}: ` : ''}{e.message}</p>
          ))}
          <button type="button" onClick={async () => {
            const res = await fetch('/api/checkout/place', { method: 'POST' });
            if (res.ok) window.location.reload();
          }} className="mt-3 btn-primary" style={{ width: 'auto' } as React.CSSProperties}>Reintentar</button>
        </div>
      )}

      <div className="space-y-4 text-left">
        {placedOrders.map((o) => {
          const sid = String((o as { storeId?: string | number }).storeId ?? storeIdByOrder.get(o.orderId) ?? '');
          const tienda = tiendas.get(sid) ?? null;
          const label = o.storeLabel ?? storeLabelByOrder.get(o.orderId) ?? tienda?.label ?? '';
          const items = itemsByOrder.get(o.orderId) ?? [];
          return (
            <div key={o.orderId} className="border rounded-xl p-4 bg-white" style={{ borderColor: 'var(--color-form-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-bold text-h4 uppercase m-0">Pedido #{o.orderId}</h3>
                <span className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
              </div>
              {tienda ? (
                <p className="text-small mb-3 flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="icon text-[16px]">storefront</span>
                  {tienda.direccion ?? `${tienda.municipio}, ${tienda.provincia}`} — <span style={{ color: '#16a34a', fontWeight: 700 }}>Recoger y pagar en tienda</span>
                </p>
              ) : (
                label && <p className="text-small mb-3" style={{ color: 'var(--color-text-secondary)' }}>{label} — Recoger y pagar en tienda</p>
              )}
              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="w-12 h-12 shrink-0 bg-egrem-gray-light border rounded-lg overflow-hidden flex items-center justify-center" style={{ borderColor: 'var(--color-form-border)' }}>
                        {it.imagen ? <img src={it.imagen} alt={it.title} className="w-full h-full object-cover" /> : <span className="icon text-xl" style={{ color: 'var(--color-egrem-gray)', opacity: 0.4 }}>inventory_2</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-sm truncate" style={{ color: 'var(--color-egrem-black)' }}>{it.title}</p>
                        <p className="text-small" style={{ color: 'var(--color-text-secondary)' }}>{[it.talla && `Talla: ${it.talla}`, it.color && `Color: ${it.color}`, it.edicion && `Edición: ${it.edicion}`, it.formato && `Formato: ${it.formato}`].filter(Boolean).join(' · ') || `SKU: ${it.sku ?? ''}`}</p>
                        <p className="text-small" style={{ color: 'var(--color-text-secondary)' }}>Cantidad: {it.quantity} · {it.unitPrice != null ? formatPrecio(it.unitPrice, lang) : ''}</p>
                      </div>
                      <span className="font-display font-bold text-sm" style={{ color: 'var(--color-egrem-black)' }}>{it.unitPrice != null ? formatPrecio(it.unitPrice * it.quantity, lang) : ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-small" style={{ color: 'var(--color-text-secondary)' }}>Artículos del pedido #{o.orderId}</p>
              )}
              {o.total != null && <p className="text-small font-bold text-right mt-3">{formatPrecio(o.total, lang)}</p>}
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4" style={{ borderColor: 'var(--color-form-border)' }}>
        <p className="text-small font-bold" style={{ color: 'var(--color-text-secondary)' }}>Total pagado: {(() => {
          const total = placedOrders.reduce((s, o) => s + (o.total ?? 0), 0);
          // Fallback a summary si result no trae totales
          if (total === 0 && summary && typeof (summary as { subtotal?: number }).subtotal === 'number') return formatPrecio((summary as { subtotal: number }).subtotal, lang);
          return formatPrecio(total, lang);
        })()}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <a href="/mi-cuenta/pedidos" className="btn-primary no-underline" style={{ width: 'auto' } as React.CSSProperties}>{tr('checkout.pago.ver_pedidos')}</a>
        <a href="/tienda" className="px-6 py-3 rounded-xl border font-display font-bold text-sm uppercase tracking-wider no-underline text-center" style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-text-secondary)' } as React.CSSProperties}>{tr('checkout.pago.volver_tienda')}</a>
      </div>
    </div>
  );
}
