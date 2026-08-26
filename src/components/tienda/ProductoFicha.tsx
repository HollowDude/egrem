import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { ProductoDetalle } from '@/types/producto';
import { formatPrecio } from '@/lib/moneda';
import {
  seleccionCompleta,
  resolverVariacion,
  previsualizarVariacion,
  combinacionDisponible,
  stockCombinacion,
  dimensionesRequeridas,
  edicionesDisponibles,
  formatosDisponibles,
  type SeleccionAtributos,
} from '@/lib/tienda/productoSeleccion';
import ProductoFichaTecnica from './ProductoFichaTecnica';

interface Props {
  producto: ProductoDetalle;
  lang?: Lang;
  /** Selección inicial desde query params (?color=&talla=) — continuidad listado→detalle. */
  seleccionInicial?: SeleccionAtributos;
}

/**
 * Ficha de producto unificada: posee TODO el estado de variante (galería +
 * selector + precio) en un solo componente React, igual que `ProductDetail`
 * en Magic_Astro. No hay dos fuentes de verdad: la imagen principal, el
 * precio y los swatches se derivan de `preview`, que se recalcula en cada
 * cambio de `seleccion`. Monta con `client:load` (SSR isomórfico de Astro
 * renderiza la primera imagen en el HTML inicial).
 */
export default function ProductoFicha({ producto, lang = 'es', seleccionInicial }: Props) {
  const tr = useTranslations(lang);
  const { tipo, variaciones, materiales, plazoEnvio } = producto;

  const [seleccion, setSeleccion] = useState<SeleccionAtributos>(seleccionInicial ?? {});
  const [cantidad, setCantidad] = useState(1);
  const [errorVisible, setErrorVisible] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [agregado, setAgregado] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  const esPrenda = tipo === 'prenda';
  const completa = seleccionCompleta(tipo, seleccion);

  // Preview SIEMPRE disponible (a diferencia de `variacion` estricta): la foto
  // y el precio reaccionan aunque solo se haya elegido el color.
  const preview = useMemo(
    () => previsualizarVariacion(variaciones, seleccion),
    [variaciones, seleccion],
  );
  const imagenes = useMemo(() => {
    if (!preview) return [];
    if (preview.imagenes.length) return preview.imagenes;
    if (preview.imagenVarianteUrl) return [preview.imagenVarianteUrl];
    return [];
  }, [preview]);

  // `variacion` sigue siendo la estricta que valida el alta al carrito.
  const variacion = useMemo(
    () => (completa ? resolverVariacion(variaciones, seleccion) : null),
    [completa, variaciones, seleccion],
  );
  const precioMostrar = preview?.precio ?? null;

  // Resetear miniatura activa cuando cambia la variación previsualizada.
  useEffect(() => {
    setActiveImg(0);
  }, [preview]);

  // Sincronizar la selección con la URL (continuidad + estado compartible).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (seleccion.color) url.searchParams.set('color', seleccion.color);
    else url.searchParams.delete('color');
    if (seleccion.talla) url.searchParams.set('talla', seleccion.talla);
    else url.searchParams.delete('talla');
    if (seleccion.edicion) url.searchParams.set('edicion', seleccion.edicion);
    else url.searchParams.delete('edicion');
    if (seleccion.formato) url.searchParams.set('formato', seleccion.formato);
    else url.searchParams.delete('formato');
    window.history.replaceState(null, '', url.toString());
  }, [seleccion.color, seleccion.talla, seleccion.edicion, seleccion.formato]);

  const mainImage =
    imagenes[activeImg] ?? preview?.imagenVarianteUrl ?? producto.imagenPrincipal ?? null;

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
  const hayStock = completa && variacion ? (variacion.stock ?? 0) > 0 : false;

  // Mensaje de error preciso según qué dimensión falta.
  const faltantes = dimensionesRequeridas(tipo).filter((d) => !seleccion[d]);
  const mensajeError =
    faltantes.length === 1
      ? faltantes[0] === 'talla'
        ? tr('tienda.product.seleccion_incompleta_talla')
        : faltantes[0] === 'color'
          ? tr('tienda.product.seleccion_incompleta_color')
          : faltantes[0] === 'edicion'
            ? tr('tienda.product.selecciona_edicion')
            : tr('tienda.product.selecciona_formato')
      : esPrenda
        ? tr('tienda.product.seleccion_incompleta')
        : tr('tienda.product.seleccion_incompleta_color');

  const setTalla = (t: string) =>
    setSeleccion((prev) => ({ ...prev, talla: prev.talla === t ? undefined : t }));
  const setColor = (c: string) =>
    setSeleccion((prev) => ({ ...prev, color: prev.color === c ? undefined : c }));
  const setEdicion = (e: string) =>
    setSeleccion((prev) => ({ ...prev, edicion: prev.edicion === e ? undefined : e }));
  const setFormato = (f: string) =>
    setSeleccion((prev) => ({ ...prev, formato: prev.formato === f ? undefined : f }));

  const cambiarCantidad = (delta: number) =>
    setCantidad((c) => Math.max(1, Math.min(stockMax || 10, c + delta)));

  async function anadirAlCarrito() {
    setServerError(null);
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
      edicion: seleccion.edicion,
      formato: seleccion.formato,
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
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) {
        setServerError(tr('tienda.product.error_servidor'));
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
      const variacionLabel =
        [seleccion.talla, seleccion.color, seleccion.edicion, seleccion.formato]
          .filter(Boolean)
          .join(' · ') || null;
      window.dispatchEvent(
        new CustomEvent('cart:added', {
          detail: {
            title: producto.titulo,
            variation: variacionLabel,
            quantity: cantidad,
            count,
          },
        }),
      );
      setServerError(null);
      setAgregado(true);
      window.setTimeout(() => setAgregado(false), 1800);
    } catch {
      setServerError(tr('tienda.product.error_red'));
    } finally {
      setAdding(false);
    }
  }

  const labelClase =
    'font-display text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-3';

  function edicionSelector() {
    if (tipo !== 'libro') return null;
    const eds = edicionesDisponibles(variaciones);
    if (eds.length === 0) return null;
    return (
      <div>
        <p className={labelClase}>{tr('tienda.product.edicion')}</p>
        <div className="flex flex-wrap gap-2">
          {eds.map((e) => {
            const disp = combinacionDisponible(variaciones, undefined, undefined, e);
            const activo = seleccion.edicion === e;
            return (
              <button
                key={e}
                type="button"
                disabled={!disp}
                aria-pressed={activo}
                onClick={() => setEdicion(e)}
                className={[
                  'px-4 h-12 flex items-center justify-center border-2 rounded-xl font-display font-bold text-[15px] transition-all duration-200',
                  !disp
                    ? 'opacity-40 cursor-not-allowed border-form-border text-text-secondary'
                    : activo
                      ? 'border-egrem-red text-egrem-red bg-white'
                      : 'border-form-border text-text-secondary hover:border-egrem-red',
                ].join(' ')}
              >
                {e}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function formatoSelector() {
    if (tipo !== 'disco') return null;
    const fmts = formatosDisponibles(variaciones);
    if (fmts.length === 0) return null;
    return (
      <div>
        <p className={labelClase}>{tr('tienda.product.formato')}</p>
        <div className="flex flex-wrap gap-2">
          {fmts.map((f) => {
            const disp = combinacionDisponible(variaciones, undefined, undefined, undefined, f);
            const activo = seleccion.formato === f;
            return (
              <button
                key={f}
                type="button"
                disabled={!disp}
                aria-pressed={activo}
                onClick={() => setFormato(f)}
                className={[
                  'px-4 h-12 flex items-center justify-center border-2 rounded-xl font-display font-bold text-[15px] transition-all duration-200',
                  !disp
                    ? 'opacity-40 cursor-not-allowed border-form-border text-text-secondary'
                    : activo
                      ? 'border-egrem-red text-egrem-red bg-white'
                      : 'border-form-border text-text-secondary hover:border-egrem-red',
                ].join(' ')}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Columna izquierda: galería ── */}
      <div className="md:col-span-7 flex flex-col gap-4">
        <div className="w-full aspect-square bg-egrem-gray-light border border-form-border rounded-2xl overflow-hidden relative">
          {mainImage ? (
            <img
              src={mainImage}
              alt={producto.titulo}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="icon text-6xl text-egrem-gray/40">inventory_2</span>
            </div>
          )}
        </div>
        {imagenes.length > 1 && (
          <div className="grid grid-cols-4 gap-3">
            {imagenes.map((src, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setActiveImg(i)}
                className={`aspect-square bg-egrem-gray-light border overflow-hidden rounded-xl transition-all ${
                  i === activeImg
                    ? 'border-2 border-egrem-red ring-2 ring-egrem-red/25'
                    : 'border border-form-border hover:border-egrem-red'
                }`}
                aria-label={`${producto.titulo} ${i + 1}`}
                aria-pressed={i === activeImg}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Columna derecha: info + selector ── */}
      <div className="md:col-span-5 flex flex-col justify-start pt-4 lg:sticky lg:top-24 self-start">
        <h1 className="text-h1 uppercase mb-2 leading-[0.95] tracking-tight">{producto.titulo}</h1>
        <p className="font-display text-text-secondary uppercase tracking-wider mb-6">
          {tr('tienda.product.merchandising_oficial')}
        </p>

        <div className="mb-4">
          <span className="text-h1 text-egrem-red font-black">
            {precioMostrar !== null ? formatPrecio(precioMostrar, lang) : tr('tienda.product.consultar')}
          </span>
        </div>

        {(completa && variacion) && (
          <p
            className={`flex items-center gap-1.5 font-display text-[13px] -mt-2 mb-4 ${
              hayStock ? 'text-[#16a34a]' : 'text-egrem-red'
            }`}
          >
            <span className="icon text-[16px]">{hayStock ? 'check_circle' : 'error'}</span>
            {hayStock ? tr('tienda.product.en_stock') : tr('tienda.product.sin_stock')}
          </p>
        )}

        <div className="h-px w-full bg-egrem-gray-light mb-6" />

        <div
          className="egrem-richtext font-display text-body leading-relaxed text-egrem-gray mb-6"
          dangerouslySetInnerHTML={{ __html: producto.descripcion }}
        />

        <ProductoFichaTecnica vRef={preview} tipo={tipo} lang={lang} />

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
          {colores.length > 0 && (
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
      )}

        {/* ── Selector de Edición (libro) ── */}
        {edicionSelector()}

        {/* ── Selector de Formato (disco) ── */}
        {formatoSelector()}

        {/* ── Chips informativos (solo si hay contenido) ── */}
          {(plazoEnvio || (materiales && materiales.length <= 24 && tipo !== 'instrumento') || seleccion.talla || seleccion.color || seleccion.edicion || seleccion.formato) && (
            <div className="flex flex-wrap gap-2">
              {plazoEnvio && (
                <span className="inline-flex items-center px-3 py-1 bg-egrem-gray-light text-egrem-black font-display text-[11px] font-bold uppercase tracking-wider rounded-full border border-form-border">
                  {plazoEnvio}
                </span>
              )}
              {materiales && materiales.length <= 24 && tipo !== 'instrumento' && (
                <span className="inline-flex items-center px-3 py-1 bg-egrem-gray-light text-egrem-black font-display text-[11px] font-bold uppercase tracking-wider rounded-full border border-form-border">
                  {materiales}
                </span>
              )}
              {seleccion.talla && (
                <span className="inline-flex items-center px-3 py-1 bg-egrem-gray-light text-egrem-black font-display text-[11px] font-bold uppercase tracking-wider rounded-full border border-form-border">
                  {tr('tienda.product.talla_seleccionada', { talla: seleccion.talla })}
                </span>
              )}
              {seleccion.color && (
                <span className="inline-flex items-center px-3 py-1 bg-egrem-gray-light text-egrem-black font-display text-[11px] font-bold uppercase tracking-wider rounded-full border border-form-border">
                  {tr('tienda.product.color_seleccionado', { color: seleccion.color })}
                </span>
              )}
              {seleccion.edicion && (
                <span className="inline-flex items-center px-3 py-1 bg-egrem-gray-light text-egrem-black font-display text-[11px] font-bold uppercase tracking-wider rounded-full border border-form-border">
                  {tr('tienda.product.edicion_seleccionada', { edicion: seleccion.edicion })}
                </span>
              )}
              {seleccion.formato && (
                <span className="inline-flex items-center px-3 py-1 bg-egrem-gray-light text-egrem-black font-display text-[11px] font-bold uppercase tracking-wider rounded-full border border-form-border">
                  {tr('tienda.product.formato_seleccionado', { formato: seleccion.formato })}
                </span>
              )}
            </div>
          )}

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

          {/* ── Confirmación de alta ── */}
          {agregado && (
            <p
              role="status"
              className="flex items-center gap-1.5 font-display text-[13px] text-[#16a34a] m-0"
            >
              <span className="icon text-[16px]" aria-hidden="true">
                check_circle
              </span>
              {tr('tienda.product.agregado')}
            </p>
          )}

          {/* ── Banner de error de selección (Escenario 2) ── */}
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

          {/* ── Banner de error del servidor (sin importar selección) ── */}
          {serverError && (
            <p
              role="alert"
              className="rounded-xl px-4 py-3 text-small font-display flex items-center gap-2 bg-form-error-bg border border-form-error text-form-error m-0"
            >
              <span className="icon" aria-hidden="true" style={{ fontSize: 20 }}>
                error
              </span>
              {serverError}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
