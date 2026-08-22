import { useMemo, useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { NhEventoProgramaDia, NhEventoTipoEntrada } from '@/lib/nodehive';
import { tiersPorDia, calcularResumen, combinacionesPosibles, type DiaSeleccion } from '@/lib/tienda/seleccion';

interface Props {
  programa: NhEventoProgramaDia[];
  tiposEntrada: NhEventoTipoEntrada[];
  lang?: Lang;
  entradaSku?: string;
  /** Se invoca al confirmar (lo cablea Fase 5/6/7 al checkout). */
  onConfirm?: (seleccion: DiaSeleccion[]) => void;
}

function formatPrice(value: number, lang: Lang): string {
  const formatted = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-CU', {
    maximumFractionDigits: 2,
  }).format(value);
  return `$${formatted}`;
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
  onDecrement,
  onIncrement,
}: {
  cantidad: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onDecrement}
        className="w-9 h-9 rounded-lg border border-form-border text-egrem-black font-display text-lg leading-none flex items-center justify-center hover:border-egrem-red hover:text-egrem-red transition-colors disabled:opacity-40"
        disabled={cantidad <= 1}
        aria-label="-"
      >
        −
      </button>
      <span className="font-display font-bold text-[18px] text-egrem-black w-6 text-center">
        {cantidad}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        className="w-9 h-9 rounded-lg border border-form-border text-egrem-black font-display text-lg leading-none flex items-center justify-center hover:border-egrem-red hover:text-egrem-red transition-colors disabled:opacity-40"
        disabled={cantidad >= 10}
        aria-label="+"
      >
        +
      </button>
    </div>
  );
}

interface EstadoDia {
  sku: string | null;
  cantidad: number;
}

export default function EventoCompraWidget({
  programa,
  tiposEntrada,
  lang = 'es',
  entradaSku,
  onConfirm,
}: Props) {
  const tr = useTranslations(lang);

  const opciones = useMemo(() => tiersPorDia(programa, tiposEntrada), [programa, tiposEntrada]);

  const sinOpciones = opciones.every((o) => o.tiers.length === 0);
  const todoAgotado =
    !sinOpciones && opciones.every((o) => o.tiers.every((t) => t.disponibles === 0));

  const [estado, setEstado] = useState<Record<string, EstadoDia>>(() => {
    const init: Record<string, EstadoDia> = {};
    for (const o of opciones) {
      const preselect =
        entradaSku !== undefined
          ? o.tiers.find((t) => t.sku === entradaSku && t.disponibles !== 0)
          : o.tiers.find((t) => t.disponibles !== 0);
      init[o.dia.id] = {
        sku: preselect ? preselect.sku : o.tiers.length === 1 ? o.tiers[0].sku : null,
        cantidad: 1,
      };
    }
    return init;
  });

  const seleccion: DiaSeleccion[] = opciones.map((o) => ({
    diaId: o.dia.id,
    tipoEntradaSku: estado[o.dia.id]?.sku ?? null,
    cantidad: estado[o.dia.id]?.cantidad ?? 0,
  }));

  const resumen = useMemo(() => calcularResumen(seleccion, tiposEntrada), [seleccion, tiposEntrada]);
  const compacto = opciones.length === 1 && opciones[0].tiers.length === 1;
  const posibles = combinacionesPosibles(opciones);

  const setSku = (diaId: string, sku: string | null) =>
    setEstado((prev) => ({ ...prev, [diaId]: { ...prev[diaId], sku } }));

  const setCantidad = (diaId: string, cantidad: number) =>
    setEstado((prev) => ({
      ...prev,
      [diaId]: { ...prev[diaId], cantidad: Math.max(0, Math.min(10, cantidad)) },
    }));

  const confirmar = () => onConfirm?.(seleccion);

  if (sinOpciones || todoAgotado) {
    return (
      <p className="font-display text-small text-text-secondary m-0">
        {tr('tienda.product.sin_entradas')}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display font-bold text-[18px] text-egrem-black uppercase m-0">
        {tr('tienda.product.entrada')}
      </h2>

      <div className="space-y-4">
        {opciones.map((o) => {
          const activo = estado[o.dia.id]?.sku ?? null;
          const unSoloTier = o.tiers.length === 1;
          const qty = estado[o.dia.id]?.cantidad ?? 1;
          return (
            <div
              key={o.dia.id}
              className="border border-form-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  {!compacto && (
                    <p className="font-display font-bold text-[14px] text-egrem-black m-0 leading-tight">
                      {o.dia.titulo}
                    </p>
                  )}
                  <p className="font-display text-small text-text-secondary m-0">
                    {formatFechaDia(o.dia.fecha, lang)}
                  </p>
                </div>
                <span className="font-display text-small text-text-secondary uppercase tracking-wider">
                  {tr('tienda.product.personas')}
                </span>
              </div>

              {o.tiers.length === 0 ? (
                <p className="font-display text-small text-text-secondary m-0">
                  {tr('tienda.product.sin_entradas_dia')}
                </p>
              ) : (
                <div className={unSoloTier ? 'space-y-3' : 'grid grid-cols-1 gap-2'}>
                  {o.tiers.map((t) => {
                    const agotado = t.disponibles === 0;
                    const selected = activo === t.sku;
                    return (
                      <div key={t.sku} className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          disabled={agotado}
                          onClick={() => setSku(o.dia.id, selected ? null : t.sku)}
                          className={[
                            'flex-1 text-left rounded-lg border p-3 transition-all duration-200 cursor-pointer',
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
                            {t.precio !== null ? formatPrice(t.precio, lang) : tr('tienda.product.consultar')}
                          </p>
                          {agotado && (
                            <span className="inline-block mt-1 font-display font-bold text-[10px] uppercase tracking-wider text-egrem-red">
                              {tr('tienda.product.agotado')}
                            </span>
                          )}
                        </button>
                        {selected && (
                          <div className="shrink-0">
                            <Stepper
                              cantidad={qty}
                              onDecrement={() => setCantidad(o.dia.id, qty - 1)}
                              onIncrement={() => setCantidad(o.dia.id, qty + 1)}
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

      <div className="flex items-center justify-between border-t border-form-border pt-4">
        <span className="font-display text-small text-text-secondary uppercase tracking-wider">
          {tr('tienda.product.total')}
        </span>
        <span className="font-display font-bold text-[24px] text-egrem-red">
          {resumen.hasNullPrice ? tr('tienda.product.consultar') : formatPrice(resumen.total ?? 0, lang)}
        </span>
      </div>

      <button
        type="button"
        disabled={resumen.combinaciones === 0}
        onClick={confirmar}
        className="w-full inline-flex items-center justify-center gap-2 bg-egrem-red text-white font-display font-bold text-[14px] uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all duration-200 cursor-pointer border-none shadow-sm hover:bg-egrem-red-dark hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <span style={{ fontSize: 18 }}>shopping_cart_checkout</span>
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
