import { useMemo, useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { NhEventoTipoEntrada } from '@/lib/nodehive';

interface Props {
  tiposEntrada: NhEventoTipoEntrada[];
  lang?: Lang;
  entradaSku?: string;
}

function formatPrice(value: number, lang: Lang): string {
  const formatted = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-CU', {
    maximumFractionDigits: 2,
  }).format(value);
  return `$${formatted}`;
}

export default function TicketConfigurator({ tiposEntrada, lang = 'es', entradaSku }: Props) {
  const tr = useTranslations(lang);

  const opciones = useMemo(
    () => tiposEntrada.map((t, i) => ({ ...t, _idx: i })),
    [tiposEntrada],
  );

  const [selected, setSelected] = useState<Set<number>>(
    () =>
      new Set(
        opciones.filter((o) => o.sku === entradaSku && o.disponibles !== 0).map((o) => o._idx),
      ),
  );
  const [qty, setQty] = useState(1);

  const toggle = (idx: number, disponibles: number | null) => {
    if (disponibles === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectedItems = opciones.filter((o) => selected.has(o._idx));

  const hasNullPrice = selectedItems.some((o) => o.precio === null);
  const subtotal = selectedItems.reduce((acc, o) => acc + (o.precio ?? 0), 0);
  const total = subtotal * qty;

  const totalLabel = hasNullPrice ? tr('tienda.product.consultar') : formatPrice(total, lang);

  const sinOpciones = opciones.length === 0;
  const todoAgotado = opciones.length > 0 && opciones.every((o) => o.disponibles === 0);

  const entradaUnica = selected.size === 1 ? (opciones.find((o) => selected.has(o._idx)) ?? null) : null;

  if (sinOpciones || todoAgotado) {
    return (
      <p className="font-display text-small text-text-secondary m-0">
        {tr('tienda.product.sin_entradas')}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        {entradaUnica ? (
          <>
            <h2 className="font-display font-bold text-[18px] text-egrem-black uppercase m-0">
              {entradaUnica.nombre}
            </h2>
            {entradaUnica.descripcion && (
              <p className="font-display text-small text-text-secondary m-0 mt-1">
                {entradaUnica.descripcion}
              </p>
            )}
          </>
        ) : (
          <h2 className="font-display font-bold text-[18px] text-egrem-black flex items-center gap-2 uppercase m-0">
            <span className="text-egrem-gold" style={{ fontFamily: 'Material Symbols Outlined' }}>
              calendar_today
            </span>
            {tr('tienda.product.selecciona_tipo')}
          </h2>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3" id="day-picker">
        {opciones.map((o) => {
          const agotado = o.disponibles === 0;
          const active = selected.has(o._idx);
          return (
            <button
              type="button"
              key={o._idx}
              disabled={agotado}
              onClick={() => toggle(o._idx, o.disponibles)}
              className={[
                'relative text-left rounded-xl border p-3 transition-all duration-200 cursor-pointer',
                agotado
                  ? 'border-form-border opacity-60 cursor-not-allowed'
                  : active
                    ? 'border-egrem-red bg-egrem-red/5'
                    : 'border-form-border hover:border-egrem-red',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-2 right-2 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                  active ? 'border-egrem-red bg-egrem-red' : 'border-egrem-gray',
                ].join(' ')}
              >
                {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>

              <p className="font-display text-[11px] uppercase tracking-wider text-text-secondary m-0 pr-5 line-clamp-1">
                {o.descripcion || tr('tienda.product.entrada')}
              </p>
              <p className="font-display font-bold text-[15px] text-egrem-black m-0 mt-0.5 line-clamp-2 leading-tight">
                {o.nombre}
              </p>
              <p className="font-display font-bold text-[16px] text-egrem-red m-0 mt-2">
                {o.precio !== null ? formatPrice(o.precio, lang) : tr('tienda.product.consultar')}
              </p>

              {agotado && (
                <span className="absolute inset-x-0 bottom-0 bg-surface-container-highest text-on-surface-variant text-center font-display font-bold text-[10px] uppercase tracking-wider py-1 rounded-b-xl">
                  {tr('tienda.product.agotado')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-form-border pt-4">
        <span className="font-display text-small text-text-secondary uppercase tracking-wider">
          {tr('tienda.product.personas')}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-9 h-9 rounded-lg border border-form-border text-egrem-black font-display text-lg leading-none flex items-center justify-center hover:border-egrem-red hover:text-egrem-red transition-colors disabled:opacity-40"
            disabled={qty <= 1}
            aria-label="-"
          >
            −
          </button>
          <span className="font-display font-bold text-[18px] text-egrem-black w-6 text-center">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(10, q + 1))}
            className="w-9 h-9 rounded-lg border border-form-border text-egrem-black font-display text-lg leading-none flex items-center justify-center hover:border-egrem-red hover:text-egrem-red transition-colors disabled:opacity-40"
            disabled={qty >= 10}
            aria-label="+"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-form-border pt-4">
        <span className="font-display text-small text-text-secondary uppercase tracking-wider">
          {tr('tienda.product.total')}
        </span>
        <span className="font-display font-bold text-[24px] text-egrem-red">{totalLabel}</span>
      </div>

      <button
        type="button"
        disabled={selected.size === 0}
        className="w-full inline-flex items-center justify-center gap-2 bg-egrem-red text-white font-display font-bold text-[14px] uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all duration-200 cursor-pointer border-none shadow-sm hover:bg-egrem-red-dark hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <span className="icon" style={{ fontSize: 18 }}>shopping_cart_checkout</span>
        {tr('tienda.product.proceder_pago')}
      </button>

      {selected.size === 0 && (
        <p className="font-display text-caption text-text-secondary text-center m-0 -mt-2">
          {tr('tienda.product.sin_seleccion')}
        </p>
      )}
      <p className="font-display text-caption text-text-secondary text-center m-0">
        {tr('tienda.product.disponible_proximamente')}
      </p>
    </div>
  );
}
