import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import { formatPrecio } from '@/lib/moneda';
import Alert from '@/components/ui/Alert';

type PedidoTab = 'realizados' | 'en_proceso';

interface PedidoResumen {
  uuid: string;
  orderId: number;
  state: string;
  placed: string | null;
  total: number;
  storeLabel?: string;
}

interface Props {
  lang?: Lang;
}

const CSS = {
  formBorder: 'var(--color-form-border)',
  textSecondary: 'var(--color-text-secondary)',
  egremGold: 'var(--color-egrem-gold)',
  brandPrimary: 'var(--color-brand-primary)',
};

function badgeVariant(state: string): 'green' | 'gold' | 'red' | 'white' {
  const s = state.toLowerCase();
  if (s === 'completed' || s === 'complete' || s === 'fulfilled') return 'green';
  if (s === 'canceled' || s === 'cancelled' || s === 'cancelado') return 'red';
  if (s === 'draft' || s === 'cart' || s === 'en_proceso') return 'gold';
  return 'white';
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

export default function OrdersList({ lang = 'es' }: Props) {
  const tr = useTranslations(lang as Lang);
  const [tab, setTab] = useState<PedidoTab>('realizados');
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  async function load(reset = true, cursor: string | null = null) {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const params = new URLSearchParams({ tab });
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/user/pedidos?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error');
      }
      const data = (await res.json()) as { pedidos: PedidoResumen[]; nextCursor: string | null };
      if (reset) {
        setPedidos(data.pedidos ?? []);
      } else {
        setPedidos((prev) => [...prev, ...(data.pedidos ?? [])]);
      }
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      setError(String((e as Error)?.message ?? tr('auth.dashboard.error')));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load(true, null);
  }, [tab]);

  return (
    <div>
      <header className="mb-8">
        <h3 className="text-h2 uppercase m-0 border-b-2 border-egrem-gold pb-2" style={{ borderColor: CSS.egremGold }}>
          {tr('auth.dashboard.orders')}
        </h3>
        <p className="text-small mt-2" style={{ color: CSS.textSecondary }}>
          {tab === 'realizados' ? tr('auth.dashboard.orders_tab_completed') : tr('auth.dashboard.orders_tab_draft')}
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: CSS.formBorder }}>
        {(['realizados', 'en_proceso'] as PedidoTab[]).map((t) => {
          const active = tab === t;
          const label = t === 'realizados' ? tr('auth.dashboard.orders_tab_completed') : tr('auth.dashboard.orders_tab_draft');
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-3 font-display font-bold text-sm uppercase tracking-wider border-b-2 -mb-px transition-colors ${active ? 'text-egrem-black' : 'text-text-secondary'}`}
              style={{
                borderColor: active ? CSS.egremGold : 'transparent',
                color: active ? 'var(--color-egrem-black)' : CSS.textSecondary,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <Alert type="error" message={error} />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="inline-block w-6 h-6 border-2 border-[var(--color-brand-primary)]/30 border-t-[var(--color-brand-primary)] rounded-full animate-spin" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="empty-state">
          <span className="icon text-[48px] mb-4" style={{ color: 'var(--color-egrem-gray)', opacity: 0.4 }}>
            inventory_2
          </span>
          <p className="text-small mb-4" style={{ color: CSS.textSecondary }}>
            {tr('auth.dashboard.orders_empty')}
          </p>
          <a href="/tienda" className="btn-primary no-underline inline-flex">
            Ver tienda
          </a>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {pedidos.map((p) => (
              <div
                key={p.uuid}
                className="bg-white border rounded-xl p-6 shadow-sm flex flex-col gap-3"
                style={{ borderColor: CSS.formBorder }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display font-bold text-sm" style={{ color: 'var(--color-egrem-black)' }}>
                      {tr('auth.dashboard.order_detail_title').replace('{id}', String(p.orderId))}
                    </p>
                    <p className="text-small" style={{ color: CSS.textSecondary }}>
                      {formatFecha(p.placed, lang as Lang)}
                      {p.storeLabel ? ` · ${p.storeLabel}` : ''}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                      badgeVariant(p.state) === 'green'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : badgeVariant(p.state) === 'red'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : badgeVariant(p.state) === 'gold'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-white text-text-secondary border-black/10'
                    }`}
                  >
                    {p.state}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: CSS.formBorder }}>
                  <span className="font-display font-bold text-sm" style={{ color: 'var(--color-egrem-black)' }}>
                    {formatPrecio(p.total, lang as Lang)}
                  </span>
                  <a
                    href={`/mi-cuenta/pedidos/${p.uuid}`}
                    className="inline-flex items-center gap-1 text-sm font-display font-bold no-underline"
                    style={{ color: CSS.brandPrimary }}
                  >
                    Ver detalle
                    <span className="icon text-[16px]">arrow_forward</span>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {nextCursor && (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={() => load(false, nextCursor)}
                disabled={loadingMore}
                className="px-6 py-3 rounded-xl border font-display font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
                style={{ borderColor: CSS.formBorder, color: CSS.textSecondary }}
              >
                {loadingMore ? (
                  <span className="inline-block w-4 h-4 border-2 border-[var(--color-brand-primary)]/30 border-t-[var(--color-brand-primary)] rounded-full animate-spin" />
                ) : (
                  tr('auth.dashboard.orders_load_more')
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
