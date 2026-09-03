import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import { formatPrecio } from '@/lib/moneda';
import { buscarTiendaParaOrden } from '@/lib/checkout/resolverTiendas';
import type { TiendaInfo } from '@/types/tienda';
import Alert from '@/components/ui/Alert';

interface PedidoDetalle {
  uuid: string;
  orderId: number;
  state: string;
  checkoutStep: string | null;
  cartGroupUuid: string | null;
  placed: string | null;
  total: number;
  storeLabel?: string;
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    imagen?: string | null;
    talla?: string | null;
    color?: string | null;
    colorHex?: string | null;
    edicion?: string | null;
    formato?: string | null;
    sku?: string | null;
  }>;
  billingProfile: {
    firstName: string;
    lastName: string;
    phone: string;
    ciPassport: string;
    address: { addressLine1: string; locality: string; administrativeArea: string; postalCode?: string } | null;
  } | null;
  direccion?: { addressLine1: string; locality: string; administrativeArea: string; postalCode?: string };
  puedeCancelar: boolean;
  puedeBorrar: boolean;
  storeGroups?: Array<{ storeLabel?: string; items: Array<{ title: string; quantity: number; unitPrice: number; imagen?: string | null; talla?: string | null; color?: string | null; colorHex?: string | null; edicion?: string | null; formato?: string | null; sku?: string | null }> }>;
  todosItems?: Array<{ title: string; quantity: number; unitPrice: number; imagen?: string | null; talla?: string | null; color?: string | null; colorHex?: string | null; edicion?: string | null; formato?: string | null; sku?: string | null }>;
  hermanos?: Array<unknown>;
}

interface Props {
  lang?: Lang;
  uuid: string;
  tiendas?: TiendaInfo[];
}

const CSS = {
  formBorder: 'var(--color-form-border)',
  textSecondary: 'var(--color-text-secondary)',
  egremGold: 'var(--color-egrem-gold)',
  brandPrimary: 'var(--color-brand-primary)',
};

const PASOS = [
  { key: 'egrem_billing', label: 'Facturación' },
  { key: 'egrem_shipping', label: 'Envío' },
  { key: 'egrem_payment_method', label: 'Método de Pago' },
  { key: 'egrem_payment', label: 'Pago' },
];
const PASO_LABEL: Record<string, string> = {
  egrem_billing: 'Falta facturación',
  egrem_shipping: 'Falta envío',
  egrem_payment_method: 'Falta método de pago',
  egrem_payment: 'Falta confirmar pago',
};
type EstadoInfo = { label: string; variant: string };
function estadoInfo(state: string, checkoutStep: string | null): EstadoInfo {
  const s = state.toLowerCase();
  if (s === 'completed' || s === 'complete') return { label: 'Completado', variant: 'bg-green-50 text-green-700 border-green-200' };
  if (s === 'canceled' || s === 'cancelled') return { label: 'Cancelado', variant: 'bg-red-50 text-red-700 border-red-200' };
  if (s === 'draft') {
    const paso = checkoutStep ? PASO_LABEL[checkoutStep] : null;
    return { label: paso ? `En proceso — ${paso}` : 'En proceso', variant: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  return { label: state, variant: 'bg-white text-text-secondary border-black/10' };
}
function badgeVariant(state: string): string {
  const s = state.toLowerCase();
  if (s === 'completed' || s === 'complete') return 'bg-green-50 text-green-700 border-green-200';
  if (s === 'canceled' || s === 'cancelled' || s === 'cancelado') return 'bg-red-50 text-red-700 border-red-200';
  if (s === 'draft' || s === 'cart') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-white text-text-secondary border-black/10';
}

function formatFecha(dateStr: string | null, lang: Lang): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function OrderDetail({ lang = 'es', uuid, tiendas = [] }: Props) {
  const tr = useTranslations(lang as Lang);
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/user/pedidos/${uuid}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error');
      }
      const data = (await res.json()) as PedidoDetalle;
      setPedido(data);
    } catch (e) {
      setError(String((e as Error)?.message ?? tr('auth.dashboard.error')));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [uuid]);

  async function handleCancel() {
    if (!window.confirm(tr('auth.dashboard.order_cancel') + '?')) return;
    setActing(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch(`/api/user/pedidos/${uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Error');
      setActionSuccess('Pedido cancelado.');
      load();
    } catch (e) {
      setActionError(String((e as Error)?.message ?? 'No se pudo cancelar.'));
    } finally {
      setActing(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(tr('auth.dashboard.address_delete_confirm'))) return;
    setActing(true);
    setActionError('');
    try {
      const res = await fetch(`/api/user/pedidos/${uuid}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error');
      }
      window.location.href = '/mi-cuenta/pedidos';
    } catch (e) {
      setActionError(String((e as Error)?.message ?? 'No se pudo eliminar.'));
    } finally {
      setActing(false);
    }
  }

  async function continuarCheckout() {
    setActionError('');
    try {
      const res = await fetch('/api/checkout/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
      });
      if (res.ok) {
        window.location.href = '/checkout/pago';
        return;
      }
      const data = await res.json().catch(() => ({}));
      setActionError((data as { error?: string }).error ?? 'No se pudo continuar el pedido.');
    } catch {
      setActionError('No se pudo continuar el pedido.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="inline-block w-6 h-6 border-2 border-[var(--color-brand-primary)]/30 border-t-[var(--color-brand-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div>
        <Alert type="error" message={error || 'No se encontró el pedido.'} />
        <a href="/mi-cuenta/pedidos" className="inline-flex mt-4 no-underline" style={{ color: CSS.brandPrimary }}>
          Volver a pedidos
        </a>
      </div>
    );
  }

  const estado = estadoInfo(pedido.state, pedido.checkoutStep);
  const idxActual = pedido.checkoutStep ? PASOS.findIndex((p) => p.key === pedido.checkoutStep) : -1;
  const grupos = pedido.storeGroups?.length
    ? pedido.storeGroups
    : [{ storeLabel: pedido.storeLabel, items: pedido.items }];

  return (
    <div>
      <header className="mb-8">
        <a href="/mi-cuenta/pedidos" className="inline-flex items-center gap-1 text-small no-underline mb-4" style={{ color: CSS.brandPrimary }}>
          <span className="icon text-[16px]">arrow_back</span> Pedidos
        </a>
        <h3 className="text-h2 uppercase m-0 border-b-2 border-egrem-gold pb-2 flex items-baseline gap-2" style={{ borderColor: CSS.egremGold }}>
          <span style={{ color: 'var(--color-egrem-gold)' }}>#</span>{pedido.orderId} <span className="text-h4" style={{ color: CSS.textSecondary, textTransform: 'none' }}>{tr('auth.dashboard.order_detail_title').replace('{id}', String(pedido.orderId)).replace(`#${pedido.orderId}`, '').replace(`Pedido ${pedido.orderId}`, '').trim() || `Pedido #${pedido.orderId}`}</span>
        </h3>
        <div className="flex items-center gap-3 mt-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${estado.variant}`}>
            {estado.label}
          </span>
          <span className="text-small" style={{ color: CSS.textSecondary }}>
            {formatFecha(pedido.placed, lang as Lang)}
            {pedido.storeLabel ? ` · ${pedido.storeLabel}` : ''}
          </span>
        </div>
      </header>

      <Alert type="error" message={actionError} />
      <Alert type="success" message={actionSuccess} />

      {pedido.state === 'draft' && (
        <>
          <div className="checkout-stepper mb-6">
            {PASOS.map((paso, idx) => {
              const isActive = pedido.checkoutStep === paso.key;
              const isDone = idxActual > idx;
              const isLast = idx === PASOS.length - 1;
              return (
                <div key={paso.key} className="flex items-end flex-1">
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className={`checkout-step-dot ${isActive ? 'checkout-step-dot--active' : ''} ${isDone ? 'checkout-step-dot--done' : ''}`}>
                      {isDone ? <span className="icon text-[18px]">check</span> : idx + 1}
                    </div>
                    <span className={`checkout-step-label ${isActive ? 'checkout-step-label--active' : ''} ${isDone ? 'checkout-step-label--done' : ''}`}>{paso.label}</span>
                  </div>
                  {!isLast && <div className={`checkout-step-line ${isDone ? 'checkout-step-line--done' : ''}`} />}
                </div>
              );
            })}
          </div>
          <div className="mb-6 p-4 rounded-xl flex items-center justify-between gap-4" style={{ background: 'rgba(204,0,0,0.04)', border: '1px solid var(--color-form-border)' }}>
            <p className="text-small m-0" style={{ color: CSS.textSecondary }}>{tr('auth.dashboard.order_continue_note')}</p>
            <button type="button" onClick={continuarCheckout} className="btn-primary !w-auto px-6 py-3 flex-shrink-0">
              {tr('auth.dashboard.order_continue_checkout')}
            </button>
          </div>
        </>
      )}

      <div className="bg-white border rounded-xl p-6 shadow-sm mb-6" style={{ borderColor: CSS.formBorder }}>
        <h4 className="text-h3 m-0 pb-2 mb-4 flex items-center gap-2 border-b" style={{ borderColor: CSS.formBorder }}>
          <span className="icon text-[20px]" style={{ color: CSS.egremGold }}>
            inventory_2
          </span>
          Productos
        </h4>
        {grupos.map((group, gIdx) => {
          const tienda = buscarTiendaParaOrden(tiendas, undefined, group.storeLabel);
          const ubicacion = tienda?.direccion || [tienda?.municipio, tienda?.provincia].filter(Boolean).join(', ');
          return (
          <div key={gIdx} className={gIdx > 0 ? 'mt-6 pt-6 border-t' : ''} style={gIdx > 0 ? { borderColor: CSS.formBorder } : undefined}>
            <div className="flex items-start gap-2 mb-3">
              <span className="icon text-[18px] shrink-0" style={{ color: CSS.egremGold, marginTop: '2px' }}>storefront</span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm uppercase tracking-wider m-0" style={{ color: 'var(--color-egrem-black)' }}>
                  {tr('auth.dashboard.order_pickup_title')}{group.storeLabel ? ` — ${group.storeLabel}` : ''}
                </p>
                {ubicacion ? (
                  <p className="text-small m-0" style={{ color: CSS.textSecondary }}>{ubicacion}</p>
                ) : (
                  group.storeLabel && (
                    <p className="text-small m-0" style={{ color: CSS.textSecondary }}>{group.storeLabel}</p>
                  )
                )}
                <p className="text-small m-0" style={{ color: CSS.textSecondary }}>{tr('auth.dashboard.order_pickup_note')}</p>
              </div>
            </div>
            <div className="space-y-4">
              {group.items.map((item, idx) => (
                <div key={idx} className="flex gap-4 py-3 border-b last:border-0" style={{ borderColor: CSS.formBorder }}>
                  <div className="w-16 h-16 bg-egrem-gray-light rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                    {item.imagen ? (
                      <img src={item.imagen} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="icon text-egrem-gray/40 text-2xl">inventory_2</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-sm truncate" style={{ color: 'var(--color-egrem-black)' }}>
                      {item.title}
                    </p>
                    <p className="text-small" style={{ color: CSS.textSecondary }}>
                      {[item.talla && `Talla: ${item.talla}`, item.color && `Color: ${item.color}`, item.edicion && `Edición: ${item.edicion}`, item.formato && `Formato: ${item.formato}`, item.sku && `SKU: ${item.sku}`].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-small" style={{ color: CSS.textSecondary }}>
                      Cantidad: {item.quantity} · {formatPrecio(item.unitPrice, lang as Lang)}
                    </p>
                    {item.colorHex && (
                      <span className="inline-block w-4 h-4 rounded-full border mt-1" style={{ background: item.colorHex, borderColor: 'var(--color-form-border)' }} title={item.color ?? ''} />
                    )}
                  </div>
                  <p className="font-display font-bold text-sm" style={{ color: 'var(--color-egrem-black)' }}>
                    {formatPrecio(item.unitPrice * item.quantity, lang as Lang)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          );
        })}
        <div className="flex justify-end pt-4 mt-4 border-t" style={{ borderColor: CSS.formBorder }}>
          <span className="font-display font-bold text-h3" style={{ color: 'var(--color-egrem-black)' }}>
            {formatPrecio(pedido.total, lang as Lang)}
          </span>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 shadow-sm mb-6" style={{ borderColor: CSS.formBorder }}>
        <h4 className="text-h4 m-0 mb-4 flex items-center gap-2">
          <span className="icon text-[20px]" style={{ color: CSS.egremGold }}>person</span>
          {tr('auth.dashboard.order_billing_info')}
        </h4>
        {pedido.billingProfile ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-small" style={{ color: CSS.textSecondary }}>
            <div>
              <p className="text-caption uppercase tracking-wider mb-1">{tr('auth.dashboard.first_name')} / {tr('auth.dashboard.last_name')}</p>
              <p style={{ color: 'var(--color-egrem-black)', fontWeight: 700 }}>{pedido.billingProfile.firstName} {pedido.billingProfile.lastName}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-wider mb-1">{tr('auth.dashboard.address_phone')}</p>
              <p>{pedido.billingProfile.phone || '—'}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-wider mb-1">{tr('auth.dashboard.address_ci_passport')}</p>
              <p>{pedido.billingProfile.ciPassport || '—'}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-wider mb-1">{tr('auth.dashboard.order_billing_address')}</p>
              {pedido.billingProfile.address ? (
                <p>{pedido.billingProfile.address.addressLine1}, {pedido.billingProfile.address.locality}, {pedido.billingProfile.address.administrativeArea} {pedido.billingProfile.address.postalCode ? `· ${pedido.billingProfile.address.postalCode}` : ''}</p>
              ) : <p>—</p>}
            </div>
          </div>
        ) : pedido.direccion ? (
          <div className="text-small space-y-1" style={{ color: CSS.textSecondary }}>
            <p style={{ color: 'var(--color-egrem-black)', fontWeight: 700 }}>{pedido.direccion.addressLine1}</p>
            <p>{pedido.direccion.locality}, {pedido.direccion.administrativeArea}{pedido.direccion.postalCode ? ` · ${pedido.direccion.postalCode}` : ''}</p>
          </div>
        ) : (
          <p className="text-small" style={{ color: CSS.textSecondary }}>{tr('auth.dashboard.order_no_address')}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {pedido.puedeCancelar && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={acting}
            className="px-6 py-3 rounded-xl border font-display font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
            style={{ borderColor: CSS.formBorder, color: CSS.textSecondary }}
          >
            {tr('auth.dashboard.order_cancel')}
          </button>
        )}
        {pedido.puedeBorrar && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={acting}
            className="px-6 py-3 rounded-xl bg-egrem-red text-white font-display font-bold text-sm uppercase tracking-wider disabled:opacity-50"
            style={{ background: 'var(--color-brand-primary)' }}
          >
            {tr('auth.dashboard.order_delete')}
          </button>
        )}
      </div>
    </div>
  );
}
