import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { Cart } from '@/lib/nodehive/carrito';
import { setCantidad, quitar } from '@/lib/tienda/cartMutations';
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

  const onInc = async (id: string, current: number) => {
    try {
      aplicar(await setCantidad(id, current + 1));
    } catch (e) {
      console.error(e);
    }
  };
  const onDec = async (id: string, current: number) => {
    try {
      aplicar(await setCantidad(id, Math.max(1, current - 1)));
    } catch (e) {
      console.error(e);
    }
  };
  const onRemove = async (id: string) => {
    const current = cart;
    if (!current) return;
    // Eliminación optimista: refleja el cambio en la interfaz de inmediato,
    // aunque Drupal tarde en devolver el carrito actualizado (o el refetch venga stale).
    const remaining = (current.lines ?? []).filter((l) => (l.orderItemId ?? l.id) !== id);
    const optimistic: Cart = {
      ...current,
      lines: remaining,
      count: remaining.reduce((a, l) => a + l.cantidad, 0),
      subtotal: remaining.reduce((a, l) => a + (l.precioUnitario ?? 0) * l.cantidad, 0),
    };
    aplicar(optimistic);
    try {
      const server = await quitar(id);
      const stillThere = (server?.lines ?? []).some((l) => (l.orderItemId ?? l.id) === id);
      if (!stillThere) aplicar(server);
    } catch (e) {
      console.error(e); // Drupal ya eliminó; el estado optimista es el correcto
    }
  };

  const lines = cart?.lines ?? [];

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
          ) : lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="icon text-5xl text-egrem-gray/40 mb-3">shopping_cart</span>
              <p className="font-display text-body text-text-secondary m-0">{tr('tienda.cart.empty')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-egrem-gray-light">
              {lines.map((line) => {
                const id = line.orderItemId ?? line.id;
                const unit = line.precioUnitario ?? 0;
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
                      <p className="font-display font-bold text-[15px] uppercase text-egrem-black leading-tight m-0 truncate">
                        {line.title}
                      </p>
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
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => onDec(id, line.cantidad)}
                          aria-label="-"
                          className="w-7 h-7 flex items-center justify-center rounded-md border border-form-border hover:border-egrem-red hover:text-egrem-red transition-colors"
                        >
                          <span className="icon" style={{ fontSize: 16 }}>remove</span>
                        </button>
                        <span className="font-display font-bold text-egrem-black w-6 text-center">
                          {line.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => onInc(id, line.cantidad)}
                          aria-label="+"
                          className="w-7 h-7 flex items-center justify-center rounded-md border border-form-border hover:border-egrem-red hover:text-egrem-red transition-colors"
                        >
                          <span className="icon" style={{ fontSize: 16 }}>add</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <button
                        type="button"
                        onClick={() => onRemove(id)}
                        className="font-display text-small uppercase text-egrem-gray hover:text-egrem-red transition-colors"
                      >
                        {tr('tienda.cart.quitar')}
                      </button>
                      <span className="font-display font-bold text-egrem-black">
                        {fmt(unit * line.cantidad, lang)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
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
          <a
            href="/carrito"
            onClick={onClose}
            className="block w-full text-center border border-egrem-red text-egrem-red font-display font-bold uppercase py-3 rounded-2xl hover:bg-egrem-red hover:text-white transition-colors no-underline"
          >
            {tr('tienda.cart.ver_carrito')}
          </a>
          <a
            href="/checkout/merch"
            onClick={onClose}
            className="block w-full text-center bg-egrem-red text-white font-display font-bold uppercase py-3 rounded-2xl hover:bg-egrem-red-dark transition-colors no-underline"
          >
            {tr('tienda.cart.proceder_pago')}
          </a>
        </div>
      </aside>
    </>
  );
}
