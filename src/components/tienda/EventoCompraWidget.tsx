import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { NhEventoProgramaDia, NhEventoTipoEntrada } from '@/lib/nodehive';
import { agruparTiers, calcularResumen, totalCombinaciones } from '@/lib/tienda/seleccion';
import { formatPrecio } from '@/lib/moneda';

interface Props {
  programa: NhEventoProgramaDia[];
  tiposEntrada: NhEventoTipoEntrada[];
  lang?: Lang;
  entradaSku?: string;
  /** Se invoca al confirmar con el mismo mapa sku→cantidad que muestra el resumen. */
  onConfirm?: (items: { sku: string; cantidad: number }[]) => void;
}

function formatFechaDia(fecha: string, lang: Lang): string {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function Stepper({
  cantidad,
  nombre,
  onDecrement,
  onIncrement,
}: {
  cantidad: number;
  nombre: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onDecrement}
        className="w-9 h-9 rounded-lg border border-form-border text-egrem-black font-display text-lg leading-none flex items-center justify-center hover:border-egrem-red hover:text-egrem-red transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-egrem-red"
        disabled={cantidad <= 1}
        aria-label={`${nombre}: quitar una`}
      >
        −
      </button>
      <span className="font-display font-bold text-[18px] text-egrem-black w-6 text-center">
        {cantidad}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        className="w-9 h-9 rounded-lg border border-form-border text-egrem-black font-display text-lg leading-none flex items-center justify-center hover:border-egrem-red hover:text-egrem-red transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-egrem-red"
        disabled={cantidad >= 10}
        aria-label={`${nombre}: agregar otra (máx. 10)`}
      >
        +
      </button>
    </div>
  );
}

/** Mismo look que DiaChip.astro en la página de detalle del evento. */
function DiaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-egrem-gray-light text-egrem-black font-display text-[11px] font-semibold uppercase tracking-wide border border-egrem-gray/20">
      {children}
    </span>
  );
}

export default function EventoCompraWidget({
  programa,
  tiposEntrada,
  lang = 'es',
  entradaSku,
  onConfirm,
}: Props) {
  const tr = useTranslations(lang);

  const grupos = useMemo(() => agruparTiers(programa, tiposEntrada), [programa, tiposEntrada]);

  const todosLosTiers = useMemo(
    () =>
      [
        ...grupos.porDia.flatMap((o) => o.tiers),
        ...grupos.multiDia.map((m) => m.tier),
      ] as NhEventoTipoEntrada[],
    [grupos],
  );

  const sinOpciones = todosLosTiers.length === 0;
  const todoAgotado =
    !sinOpciones && todosLosTiers.every((t) => t.disponibles === 0);

  /** Estado único por SKU: un sku no puede vivir en dos lugares → imposible duplicar. */
  const [estado, setEstado] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (entradaSku !== undefined) {
      const pre = todosLosTiers.find((t) => t.sku === entradaSku && t.disponibles !== 0);
      if (pre) init[pre.sku] = 1;
    }
    // Paridad con el comportamiento previo: un día con un único tier disponible
    // lo deja preseleccionado (qty 1).
    for (const o of grupos.porDia) {
      if (o.tiers.length === 1 && o.tiers[0].disponibles !== 0 && !(o.tiers[0].sku in init)) {
        init[o.tiers[0].sku] = 1;
      }
    }
    return init;
  });

  const setCantidad = (sku: string, cantidad: number) =>
    setEstado((prev) => ({ ...prev, [sku]: Math.max(0, Math.min(10, cantidad)) }));

  const toggleDia = (sku: string) =>
    setEstado((prev) => {
      const next = { ...prev };
      if (next[sku]) delete next[sku];
      else next[sku] = 1;
      return next;
    });

  // Resumen directo sobre Record<sku,cantidad>: exactamente lo que viaja al checkout.
  const resumen = useMemo(
    () => calcularResumen(estado, tiposEntrada),
    [estado, tiposEntrada],
  );
  const posibles = totalCombinaciones(grupos);
  const compacto =
    grupos.porDia.length === 1 &&
    grupos.porDia[0].tiers.length === 1 &&
    grupos.multiDia.length === 0;

  const confirmar = () =>
    onConfirm?.(Object.entries(estado)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([sku, cantidad]) => ({ sku, cantidad })));

  if (sinOpciones || todoAgotado) {
    return (
      <p className="font-display text-small text-text-secondary m-0">
        {tr('tienda.product.sin_entradas')}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display font-bold text-[18px] text-egrem-black uppercase m-0">
        {tr('tienda.product.selecciona_entradas')}
      </h2>

      {grupos.porDia.some((o) => o.tiers.length > 0) && (
        <div>
          {!compacto && (
            <h3 className="font-display font-bold text-[13px] text-text-secondary uppercase tracking-wider m-0 mb-4 flex items-center gap-2">
              <span
                className="icon"
                aria-hidden="true"
                style={{ fontSize: 16, color: 'var(--color-egrem-red)' }}
              >
                calendar_month
              </span>
              {tr('tienda.product.elige_dia')}
            </h3>
          )}
          <div className="space-y-3">
          {grupos.porDia.map((o) => {
            const unSoloTier = o.tiers.length === 1;
            return (
              <div key={o.dia.id} className="border border-form-border rounded-xl p-4">
                <div className="mb-3">
                  {!compacto && (
                    <p className="font-display font-bold text-[14px] text-egrem-black m-0 leading-tight">
                      {o.dia.titulo}
                    </p>
                  )}
                  <p className="font-display text-small text-text-secondary m-0">
                    {formatFechaDia(o.dia.fecha, lang)}
                  </p>
                </div>

                {o.tiers.length === 0 ? (
                  <p className="font-display text-small text-text-secondary m-0">
                    {tr('tienda.product.sin_entradas_dia')}
                  </p>
                ) : (
                  <div className={unSoloTier ? 'space-y-3' : 'grid grid-cols-1 gap-2'}>
                    {o.tiers.map((t) => {
                      const agotado = t.disponibles === 0;
                      const qty = estado[t.sku] ?? 0;
                      const selected = qty > 0;
                      return (
                        <div key={t.sku} className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            disabled={agotado}
                            onClick={() => toggleDia(t.sku)}
                            aria-pressed={selected}
                            className={[
                              'flex-1 text-left rounded-lg border p-3 transition-all duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-egrem-red',
                              agotado
                                ? 'border-form-border opacity-60 cursor-not-allowed'
                                : selected
                                  ? 'border-egrem-red bg-egrem-red/5'
                                  : 'border-form-border hover:border-egrem-red',
                            ].join(' ')}
                          >
                            <p className="font-display font-bold text-[15px] text-egrem-black m-0 leading-tight">
                              {t.nombre}
                            </p>
                            {t.descripcion && (
                              <p className="font-display text-small text-text-secondary m-0 mt-0.5">
                                {t.descripcion}
                              </p>
                            )}
                            <p className="font-display font-bold text-[16px] text-egrem-red m-0 mt-1">
                              {t.precio !== null
                                ? formatPrecio(t.precio, lang)
                                : tr('tienda.product.consultar')}
                            </p>
                            {agotado && (
                              <span className="inline-block mt-1 font-display font-bold text-[10px] uppercase tracking-wider text-egrem-red">
                                {tr('tienda.product.agotado')}
                              </span>
                            )}
                          </button>
                          {selected && !agotado && (
                            <div className="shrink-0">
                              <Stepper
                                cantidad={qty}
                                nombre={t.nombre}
                                onDecrement={() => setCantidad(t.sku, qty - 1)}
                                onIncrement={() => setCantidad(t.sku, qty + 1)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}

          {grupos.multiDia.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-[13px] text-text-secondary uppercase tracking-wider m-0 mb-4 flex items-center gap-2">
            <span
              className="icon"
              aria-hidden="true"
              style={{ fontSize: 16, color: 'var(--color-egrem-red)' }}
            >
              confirmation_number
            </span>
            {tr('tienda.product.pases_combinados')}
          </h3>
          <div className="space-y-4">
          {grupos.multiDia.map(({ tier: t, dias }) => {
            const agotado = t.disponibles === 0;
            const qty = estado[t.sku] ?? 0;
            const selected = qty > 0;
            return (
              <div key={t.sku} className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  disabled={agotado}
                  onClick={() => toggleDia(t.sku)}
                  aria-pressed={selected}
                  className={[
                    'flex-1 text-left rounded-lg border p-3 transition-all duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-egrem-red',
                    agotado
                      ? 'border-form-border opacity-60 cursor-not-allowed'
                      : selected
                        ? 'border-egrem-red bg-egrem-red/5'
                        : 'border-form-border hover:border-egrem-red',
                  ].join(' ')}
                >
                  <p className="font-display font-bold text-[15px] text-egrem-black m-0 leading-tight">
                    {t.nombre}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <span className="font-display text-caption text-text-secondary uppercase tracking-wide mr-1">
                      {tr('tienda.product.incluye')}:
                    </span>
                    {dias.map((d) => (
                      <DiaChip key={d.id}>
                        {tr('evento.detail.dia_n', { n: programa.indexOf(d) + 1 })} ·{' '}
                        {formatFechaDia(d.fecha, lang)}
                      </DiaChip>
                    ))}
                  </div>
                  {t.descripcion && (
                    <p className="font-display text-small text-text-secondary m-0 mt-1">
                      {t.descripcion}
                    </p>
                  )}
                  <p className="font-display font-bold text-[16px] text-egrem-red m-0 mt-1">
                    {t.precio !== null
                      ? formatPrecio(t.precio, lang)
                      : tr('tienda.product.consultar')}
                  </p>
                  {agotado && (
                    <span className="inline-block mt-1 font-display font-bold text-[10px] uppercase tracking-wider text-egrem-red">
                      {tr('tienda.product.agotado')}
                    </span>
                  )}
                </button>
                {selected && !agotado && (
                  <div className="shrink-0 mt-3">
                    <Stepper
                      cantidad={qty}
                      nombre={t.nombre}
                      onDecrement={() => setCantidad(t.sku, qty - 1)}
                      onIncrement={() => setCantidad(t.sku, qty + 1)}
                    />
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-form-border pt-4">
        <span className="font-display text-small text-text-secondary uppercase tracking-wider">
          {tr('tienda.product.total')}
        </span>
        <span className="font-display font-bold text-[24px] text-egrem-red">
          {resumen.hasNullPrice
            ? tr('tienda.product.consultar')
            : formatPrecio(resumen.total ?? 0, lang)}
        </span>
      </div>

      <button
        type="button"
        disabled={resumen.combinaciones === 0}
        onClick={confirmar}
        className="w-full inline-flex items-center justify-center gap-2 bg-egrem-red text-white font-display font-bold text-[14px] uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all duration-200 cursor-pointer border-none shadow-sm hover:bg-egrem-red-dark hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span className="icon" aria-hidden="true" style={{ fontSize: 18 }}>
          shopping_cart_checkout
        </span>
        {tr('tienda.product.proceder_pago')}
      </button>

      {resumen.combinaciones === 0 && (
        <p className="font-display text-caption text-text-secondary text-center m-0 -mt-2">
          {tr('tienda.product.sin_seleccion')}
        </p>
      )}

      <p className="font-display text-caption text-text-secondary text-center m-0">
        {posibles <= 1
          ? tr('tienda.product.disponible_proximamente')
          : tr('tienda.product.seleccion_varios_dias')}
      </p>
    </div>
  );
}
