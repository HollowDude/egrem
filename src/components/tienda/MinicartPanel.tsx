import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { Cart, CartLineItem, CartGroupOrder } from '@/lib/nodehive/carrito';
import {
  vaciarPedido,
  incrementarLinea,
  setCantidad,
  quitar,
} from '@/lib/tienda/cartMutations';
import { formatPrecio } from '@/lib/moneda';

interface Props {
  open: boolean;
  onClose: () => void;
  lang?: Lang;
}

const fmt = (v: number | null, lang: Lang) =>
  v !== null ? formatPrecio(v, lang) : '';

export default function MinicartPanel({ open, onClose, lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Cargar al abrir.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch('/api/cart')
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Cart | null) => {
        if (!cancelled) setCart(c);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Escape para cerrar + bloquear scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const aplicar = (next: Cart) => {
    setCart(next);
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { count: next.count } }));
  };

  const refrescar = () => {
    fetch('/api/cart')
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Cart | null) => {
        if (c) aplicar(c);
      })
      .catch(() => {});
  };

  const onRemove = async (id: string) => {
    const current = cart;
    if (!current) return;
    // Eliminación optimista (stopgap §1.4: vaciar pedido de una tienda completa).
    const remaining = (current.orders ?? []).filter((o) => String(o.orderId) !== id);
    const optimista: Cart = {
      ...current,
      orders: remaining,
      count: remaining.reduce((a, o) => a + o.items.reduce((b, l) => b + l.quantity, 0), 0),
      subtotal: remaining.reduce((a, o) => a + o.total, 0),
    };
    aplicar(optimista);
    try {
      const server = await vaciarPedido(Number(id));
      aplicar(server);
    } catch (e) {
      console.error(e);
      refrescar();
    }
  };

  // Clave estable de línea para el estado de "pendiente" y el key del <li>.
  const lineKey = (line: CartLineItem, order: CartGroupOrder) =>
    line.itemId ?? `${order.orderId}:${line.sku}`;
  // El decremento fino por línea solo es posible cuando la línea tiene un
  // `item_id` estable (modo mock, o real una vez el backend lo exponga — §1.4).
  const puedeModificarLinea = (line: CartLineItem) => !!line.itemId;
  // El incremento requiere un `store_id` válido; las líneas sin tienda (p.ej.
  // tienda "Main" oculta) no pueden añadirse y el botón + queda deshabilitado.
  const tieneTienda = (line: CartLineItem, order: CartGroupOrder) =>
    !!(line.storeId || order.storeId);

  const cambiar = async (line: CartLineItem, order: CartGroupOrder, delta: number) => {
    if (pendingId) return;
    const nueva = line.quantity + delta;
    const key = lineKey(line, order);
    setPendingId(key);
    try {
      if (delta > 0) {
        // Sumar: vía add-to-cart (funciona en real y mock; el backend valida stock).
        // Si la línea no tiene tienda, no disparar (evita 400 del servidor).
        if (!tieneTienda(line, order)) {
          refrescar();
          return;
        }
        await incrementarLinea(line.sku, line.storeId ?? order.storeId ?? '', delta);
        refrescar();
      } else if (line.itemId) {
        if (nueva < 1) {
          // Llegó a 0 → borrar la línea del pedido (desaparece de Drupal y del slider).
          const next = await quitar(line.itemId);
          aplicar(next);
        } else {
          // Restar: PATCH a la línea (respeta stock por construcción: el máx es
          // el stock de la tienda menos lo ya en el carrito).
          const next = await setCantidad(line.itemId, nueva);
          aplicar(next);
        }
      } else {
        // Sin item_id en modo real: no existe primitiva de decremento; recargamos
        // para no dejar el estado inconsistente (el botón − queda deshabilitado).
        refrescar();
      }
    } catch {
      // Cualquier error (p.ej. stock_insufficient del servidor) → estado autoritativo.
      refrescar();
    } finally {
      setPendingId(null);
    }
  };

  const orders = cart?.orders ?? [];

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-[420px] bg-white z-[61] shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={tr('tienda.cart.title')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-egrem-gray-light">
          <h2 className="font-display font-bold text-h3 uppercase text-egrem-black m-0">
            {tr('tienda.cart.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-egrem-gray-light transition-colors"
          >
            <span className="icon text-[22px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6">
          {loading && !cart ? (
            <p className="font-display text-text-secondary text-center py-10">…</p>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="icon text-5xl text-egrem-gray/40 mb-3">shopping_cart</span>
              <p className="font-display text-body text-text-secondary m-0">{tr('tienda.cart.empty')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.filter((o) => o.items.length > 0).map((order) => (
                <div key={order.orderId}>
                  {/* Separador minimalista por tienda */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-egrem-gray-light">
                    <span className="font-display font-bold text-[13px] uppercase tracking-wider text-egrem-black">
                      {order.storeLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(String(order.orderId))}
                      className="font-display text-small uppercase text-egrem-gray hover:text-egrem-red transition-colors"
                    >
                      {tr('tienda.cart.vaciar_pedido_tienda')}
                    </button>
                  </div>
                  <ul className="divide-y divide-egrem-gray-light">
                     {order.items.map((line) => {
                       const id = lineKey(line, order);
                       const unit = line.unitPrice ?? 0;
                       const puedeModificar = puedeModificarLinea(line);
                       const enPendiente = pendingId === id;
                       return (
                         <li key={id} className="flex gap-3 py-4">
                           <div className="w-16 h-16 shrink-0 bg-egrem-gray-light border border-form-border rounded-lg overflow-hidden flex items-center justify-center">
                             {line.imagen ? (
                               <img src={line.imagen} alt={line.title} className="w-full h-full object-cover" />
                             ) : (
                               <span className="icon text-2xl text-egrem-gray/40">inventory_2</span>
                             )}
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-start justify-between gap-2">
                               <p className="font-display font-bold text-[15px] uppercase text-egrem-black leading-tight m-0 truncate">
                                 {line.title}
                               </p>
                               <span className="shrink-0 font-display font-bold text-egrem-black">
                                 {fmt(unit * line.quantity, lang)}
                               </span>
                             </div>
                             <p className="font-display text-small text-text-secondary m-0">
                               {[
                                 line.talla && `Talla: ${line.talla}`,
                                 line.color && `Color: ${line.color}`,
                                 line.edicion && `Edición: ${line.edicion}`,
                                 line.formato && `Formato: ${line.formato}`,
                               ]
                                 .filter(Boolean)
                                 .join(' · ')}
                             </p>
                             <div className="mt-2 flex items-center gap-2">
                               <div className="inline-flex items-stretch border-2 border-form-border rounded-xl h-9 overflow-hidden divide-x divide-form-border bg-white">
                                 <button
                                   type="button"
                                    onClick={() => cambiar(line, order, -1)}
                                    disabled={enPendiente || !puedeModificar}
                                   aria-label={tr('tienda.cart.quitar_uno')}
                                   title={puedeModificar ? undefined : tr('tienda.cart.quitar_no_disponible')}
                                   className="w-9 h-full flex items-center justify-center text-egrem-black hover:bg-egrem-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egrem-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                 >
                                   <span className="icon text-[18px]" aria-hidden="true">
                                     remove
                                   </span>
                                 </button>
                                 <span className="w-9 h-full flex items-center justify-center font-display font-bold text-[15px] tabular-nums text-egrem-black">
                                   {line.quantity}
                                 </span>
                                  <button
                                    type="button"
                                    onClick={() => cambiar(line, order, 1)}
                                    disabled={enPendiente || !tieneTienda(line, order) || (line.stock != null && line.quantity >= line.stock)}
                                    aria-label={tr('tienda.cart.agregar_uno')}
                                    title={tieneTienda(line, order) ? undefined : tr('tienda.cart.quitar_no_disponible')}
                                    className="w-9 h-full flex items-center justify-center text-egrem-black hover:bg-egrem-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egrem-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                  >
                                   <span className="icon text-[18px]" aria-hidden="true">
                                     add
                                   </span>
                                 </button>
                               </div>
                               {line.stock != null && line.quantity >= line.stock && (
                                 <span className="font-display text-[11px] uppercase tracking-wide text-egrem-gray">
                                   {tr('tienda.cart.max_stock_corto')}
                                 </span>
                               )}
                             </div>
                           </div>
                         </li>
                       );
                     })}
                  </ul>
                  <p className="font-display text-small text-text-secondary text-right mt-1">
                    {tr('tienda.cart.subtotal_tienda')}: {fmt(order.total, lang)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-egrem-gray-light p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-body text-text-secondary">{tr('tienda.cart.subtotal')}</span>
            <span className="font-display text-h3 font-black text-egrem-red">
              {fmt(cart?.subtotal ?? 0, lang)}
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              const btn = document.activeElement as HTMLElement | null;
              try {
                const res = await fetch('/api/checkout/start', { method: 'POST' });
                const data = await res.json().catch(() => ({}));
                if (res.ok && (data as { ok?: boolean }).ok) {
                  try {
                    if (cart) sessionStorage.setItem('egrem_checkout_snapshot', JSON.stringify(cart));
                  } catch {}
                  onClose();
                  window.location.href = '/checkout/pago';
                  return;
                }
              } catch {}
              onClose();
              window.location.href = '/checkout/merch';
              if (btn) (btn as HTMLButtonElement).blur?.();
            }}
            className="block w-full text-center bg-egrem-red text-white font-display font-bold uppercase py-3 rounded-2xl hover:bg-egrem-red-dark transition-colors no-underline disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {tr('tienda.cart.proceder_pago')}
          </button>
        </div>
      </aside>
    </>
  );
}
