import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { ProductoDetalle } from '@/types/producto';
import {
  seleccionCompleta,
  resolverVariacion,
  combinacionDisponible,
  stockCombinacion,
  dimensionesRequeridas,
  type SeleccionAtributos,
} from '@/lib/tienda/productoSeleccion';

interface Props {
  producto: ProductoDetalle;
  lang?: Lang;
}

export default function ProductoVariantSelector({ producto, lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const { tipo, variaciones, materiales, plazoEnvio } = producto;

  const [seleccion, setSeleccion] = useState<SeleccionAtributos>({});
  const [cantidad, setCantidad] = useState(1);
  const [errorVisible, setErrorVisible] = useState(false);
  const [adding, setAdding] = useState(false);

  const esPrenda = tipo === 'prenda';
  const completa = seleccionCompleta(tipo, seleccion);
  const variacion = useMemo(
    () => (completa ? resolverVariacion(variaciones, seleccion) : null),
    [completa, variaciones, seleccion],
  );

  const tallas = useMemo(
    () => [...new Set(variaciones.map((v) => v.talla).filter((t): t is string => !!t))],
    [variaciones],
  );
  const colores = useMemo(() => {
    const map = new Map<string, { nombre: string; hex: string }>();
    for (const v of variaciones) if (v.color) map.set(v.color.nombre, v.color);
    return [...map.values()];
  }, [variaciones]);

  const stockMax = variacion?.stock ?? stockCombinacion(variaciones, seleccion.talla, seleccion.color) ?? 10;

  // Mensaje de error preciso según qué dimensión falta.
  const faltantes = dimensionesRequeridas(tipo).filter((d) => !seleccion[d]);
  const mensajeError =
    faltantes.length === 1
      ? faltantes[0] === 'talla'
        ? tr('tienda.product.seleccion_incompleta_talla')
        : tr('tienda.product.seleccion_incompleta_color')
      : esPrenda
        ? tr('tienda.product.seleccion_incompleta')
        : tr('tienda.product.seleccion_incompleta_color');

  // Al resolver una variación, avisa a la ficha para actualizar imagen y precio.
  useEffect(() => {
    if (!variacion) return;
    const img = variacion.imagenVarianteUrl ?? variacion.imagenes[0];
    if (img) {
      window.dispatchEvent(new CustomEvent('producto:variacion-imagen', { detail: { url: img } }));
    }
    if (typeof variacion.precio === 'number') {
      window.dispatchEvent(
        new CustomEvent('producto:variacion-precio', { detail: { precio: variacion.precio } }),
      );
    }
  }, [variacion]);

  const setTalla = (t: string) =>
    setSeleccion((prev) => ({ ...prev, talla: prev.talla === t ? undefined : t }));
  const setColor = (c: string) =>
    setSeleccion((prev) => ({ ...prev, color: prev.color === c ? undefined : c }));

  const cambiarCantidad = (delta: number) =>
    setCantidad((c) => Math.max(1, Math.min(stockMax || 10, c + delta)));

  async function anadirAlCarrito() {
    if (!completa || !variacion) {
      setErrorVisible(true);
      return;
    }
    setErrorVisible(false);
    setAdding(true);
    const payload = {
      variationId: variacion.variationId,
      variationUuid: variacion.uuid,
      bundle: tipo,
      quantity: cantidad,
      talla: seleccion.talla,
      color: seleccion.color,
      sku: variacion.sku,
      title: producto.titulo,
      precioUnitario: variacion.precio ?? undefined,
      imagen: variacion.imagenVarianteUrl ?? variacion.imagenes[0] ?? null,
    };
    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        // Sin sesión: llevar al login conservando la página actual (igual que /carrito).
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) {
        // Error al añadir (no de red): mostrar el banner de error genérico.
        setErrorVisible(true);
        setAdding(false);
        return;
      }
      const data = await res.json().catch(() => null);
      const count = typeof data?.count === 'number' ? data.count : undefined;
      window.dispatchEvent(
        new CustomEvent('cart:updated', {
          detail: { variationId: variacion.variationId, quantity: cantidad, count },
        }),
      );
      // Abrir el minicart automáticamente para confirmar lo recién añadido.
      window.dispatchEvent(new CustomEvent('cart:open'));
    } catch {
      // Fallback optimista (invitado sin backend de carrito).
      const prev = parseInt(localStorage.getItem('egrem-cart') || '0', 10) || 0;
      const next = prev + cantidad;
      localStorage.setItem('egrem-cart', String(next));
      window.dispatchEvent(
        new CustomEvent('cart:updated', {
          detail: { variationId: variacion.variationId, quantity: cantidad, count: next },
        }),
      );
    } finally {
      setAdding(false);
    }
  }

  const labelClase =
    'font-display text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-3';

  return (
    <div className="flex flex-col gap-6">
      {/* ── Selector de Talla ── */}
      {esPrenda && (
        <div>
          <p className={labelClase}>{tr('tienda.product.talla')}</p>
          <div className="flex flex-wrap gap-2">
            {tallas.map((t) => {
              const disp = combinacionDisponible(variaciones, t, seleccion.color);
              const activo = seleccion.talla === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!disp}
                  aria-pressed={activo}
                  onClick={() => setTalla(t)}
                  className={[
                    'w-12 h-12 flex items-center justify-center border-2 rounded-xl font-display font-bold text-[18px] uppercase transition-all duration-200',
                    !disp
                      ? 'opacity-40 cursor-not-allowed border-form-border text-text-secondary'
                      : activo
                        ? 'border-egrem-red text-egrem-red bg-white'
                        : 'border-form-border text-text-secondary hover:border-egrem-red',
                  ].join(' ')}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selector de Color ── */}
      <div>
        <p className={labelClase}>{tr('tienda.product.color')}</p>
        <div className="flex flex-wrap gap-3 items-center">
          {colores.map((c) => {
            const activo = seleccion.color === c.nombre;
            return (
              <button
                key={c.nombre}
                type="button"
                title={c.nombre}
                aria-label={c.nombre}
                aria-pressed={activo}
                onClick={() => setColor(c.nombre)}
                style={{
                  backgroundColor: c.hex,
                  boxShadow: activo
                    ? '0 0 0 3px #fff, 0 0 0 5px var(--color-egrem-red)'
                    : undefined,
                }}
                className={[
                  'w-8 h-8 rounded-full border-2 transition-all duration-150',
                  activo ? 'border-egrem-red scale-110' : 'border-egrem-gray/30 hover:border-egrem-red',
                ].join(' ')}
              />
            );
          })}
        </div>
      </div>

      {/* ── Chips informativos ── */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center px-3 py-1 bg-egrem-gray-light text-egrem-black font-display text-[11px] font-bold uppercase tracking-wider rounded-md border border-form-border">
          {plazoEnvio}
        </span>
        {materiales && materiales.length <= 24 && (
          <span className="inline-flex items-center px-3 py-1 bg-egrem-gray-light text-egrem-black font-display text-[11px] font-bold uppercase tracking-wider rounded-md border border-form-border">
            {materiales}
          </span>
        )}
        {seleccion.talla && (
          <span className="inline-flex items-center px-3 py-1 bg-egrem-gray-light text-egrem-black font-display text-[11px] font-bold uppercase tracking-wider rounded-md border border-form-border">
            {tr('tienda.product.talla_seleccionada', { talla: seleccion.talla })}
          </span>
        )}
        {seleccion.color && (
          <span className="inline-flex items-center px-3 py-1 bg-egrem-gray-light text-egrem-black font-display text-[11px] font-bold uppercase tracking-wider rounded-md border border-form-border">
            {tr('tienda.product.color_seleccionado', { color: seleccion.color })}
          </span>
        )}
      </div>

      {/* ── Cantidad + CTA ── */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center border border-form-border rounded-md bg-white h-14 w-32 overflow-hidden">
          <button
            type="button"
            onClick={() => cambiarCantidad(-1)}
            disabled={cantidad <= 1}
            aria-label={tr('tienda.product.cantidad') + ' -'}
            className="w-10 h-full flex items-center justify-center text-egrem-black hover:text-egrem-red transition-colors focus:outline-none disabled:opacity-40"
          >
            <span className="icon" style={{ fontSize: 20 }}>
              remove
            </span>
          </button>
          <input
            aria-label={tr('tienda.product.cantidad')}
            className="w-full h-full text-center font-display font-bold text-[18px] border-none bg-transparent focus:ring-0 p-0 text-egrem-black"
            type="text"
            value={cantidad}
            readOnly
          />
          <button
            type="button"
            onClick={() => cambiarCantidad(1)}
            disabled={cantidad >= (stockMax || 10)}
            aria-label={tr('tienda.product.cantidad') + ' +'}
            className="w-10 h-full flex items-center justify-center text-egrem-black hover:text-egrem-red transition-colors focus:outline-none disabled:opacity-40"
          >
            <span className="icon" style={{ fontSize: 20 }}>
              add
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => void anadirAlCarrito()}
          disabled={!completa || adding}
          aria-disabled={!completa || adding}
          className={[
            'flex-1 bg-egrem-red text-white font-display text-[20px] font-bold uppercase h-14 rounded-2xl flex items-center justify-center gap-2 hover:bg-egrem-red-dark transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
            !completa && !adding ? 'cursor-not-allowed' : '',
          ].join(' ')}
        >
          <span className="icon" aria-hidden="true" style={{ fontSize: 22 }}>
            {adding ? 'autorenew' : 'shopping_cart'}
          </span>
          {tr('tienda.product.anadir_carrito')}
        </button>
      </div>

      {/* ── Banner de error (Escenario 2) ── */}
      {errorVisible && !completa && (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-small font-display flex items-center gap-2 bg-form-error-bg border border-form-error text-form-error m-0"
        >
          <span className="icon" aria-hidden="true" style={{ fontSize: 20 }}>
            error
          </span>
          {mensajeError}
        </p>
      )}
    </div>
  );
}
