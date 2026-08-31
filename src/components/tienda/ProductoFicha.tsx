import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { ProductoDetalle, ProductoTiendaStock } from '@/types/producto';
import { formatPrecio } from '@/lib/moneda';
import {
  seleccionCompleta,
  seleccionPorDefecto,
  resolverVariacion,
  previsualizarVariacion,
  combinacionDisponible,
  dimensionesRequeridas,
  edicionesDisponibles,
  formatosDisponibles,
  type SeleccionAtributos,
} from '@/lib/tienda/productoSeleccion';
import type { CartLineItem } from '@/lib/nodehive/carrito';
import {
  resolverTiendasPermitidas,
  type MunicipioSeleccionado,
} from '@/lib/tienda/ubicacion';
import type { TiendaInfo } from '@/types/tienda';
import ProductoFichaTecnica from './ProductoFichaTecnica';

interface Props {
  producto: ProductoDetalle;
  lang?: Lang;
  /** Selección inicial desde query params (?color=&talla=) — continuidad listado→detalle. */
  seleccionInicial?: SeleccionAtributos;
  /** Catálogo de tiendas con dirección (para el selector de tienda). */
  tiendasCatalogo?: TiendaInfo[];
  /** Zona elegida por el usuario (cookie) — filtra las tiendas mostradas. */
  tiendaSeleccion?: MunicipioSeleccionado[];
}

/**
 * Ficha de producto unificada: posee TODO el estado de variante (galería +
 * selector + precio) en un solo componente React, igual que `ProductDetail`
 * en Magic_Astro. No hay dos fuentes de verdad: la imagen principal, el
 * precio y los swatches se derivan de `preview`, que se recalcula en cada
 * cambio de `seleccion`. Monta con `client:load` (SSR isomórfico de Astro
 * renderiza la primera imagen en el HTML inicial).
 */
export default function ProductoFicha({
  producto,
  lang = 'es',
  seleccionInicial,
  tiendasCatalogo = [],
  tiendaSeleccion = [],
}: Props) {
  const tr = useTranslations(lang);
  const { tipo, variaciones, materiales, plazoEnvio } = producto;

  const [seleccion, setSeleccion] = useState<SeleccionAtributos>(() =>
    seleccionInicial && Object.values(seleccionInicial).some(Boolean)
      ? seleccionInicial
      : seleccionPorDefecto(tipo, variaciones),
  );
  const [cantidad, setCantidad] = useState(1);
  const [errorVisible, setErrorVisible] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [agregado, setAgregado] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  // Tienda elegida para el sourcing estricto (id de TiendaInfo).
  const [tiendaSel, setTiendaSel] = useState<string | null>(null);
  // Líneas del carrito (para restar lo ya agregado de la variación+tienda concreta).
  const [cartLines, setCartLines] = useState<CartLineItem[] | null>(null);

  // Ids de tienda permitidos según la zona del usuario (vacío = sin filtro).
  const tiendasPermitidas = useMemo(
    () => resolverTiendasPermitidas(tiendaSeleccion, tiendasCatalogo),
    [tiendaSeleccion, tiendasCatalogo],
  );

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

  // Tiendas donde esta variación tiene stock (cantidad>0 o ilimitado).
  const tiendasConStock = useMemo<ProductoTiendaStock[]>(() => {
    if (!variacion?.stockPorTienda) return [];
    return variacion.stockPorTienda.filter((s) => s.ilimitado || (s.cantidad ?? 0) > 0);
  }, [variacion]);

  // Tiendas elegibles: intersección con la zona; si queda vacío, fallback a todas
  // las con stock (regla confirmada: si ninguna tienda permitida tiene stock, se
  // listan todas las que sí lo tienen, ignorando el filtro).
  const tiendasElegibles = useMemo<ProductoTiendaStock[]>(() => {
    if (tiendasConStock.length === 0) return [];
    if (tiendasPermitidas.size === 0) return tiendasConStock;
    const filtradas = tiendasConStock.filter((s) => tiendasPermitidas.has(s.tienda.id));
    return filtradas.length > 0 ? filtradas : tiendasConStock;
  }, [tiendasConStock, tiendasPermitidas]);

  // Auto-seleccionar si solo hay una tienda elegible (sin ambigüedad).
  useEffect(() => {
    if (tiendasElegibles.length === 1) setTiendaSel(tiendasElegibles[0].tienda.id);
    else if (!tiendasElegibles.some((s) => s.tienda.id === tiendaSel)) setTiendaSel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendasElegibles]);
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

  // Mantener sincronizado el carrito para descontar lo ya agregado de esta variación.
  useEffect(() => {
    let cancelled = false;
    const cargar = () => {
      fetch('/api/cart')
        .then((r) => (r.ok ? r.json() : null))
        .then((c: { orders?: { items: CartLineItem[] }[] } | null) => {
          if (!cancelled && c?.orders) setCartLines(c.orders.flatMap((o) => o.items));
        })
        .catch(() => {});
    };
    cargar();
    const alActualizar = () => cargar();
    window.addEventListener('cart:updated', alActualizar);
    window.addEventListener('cart:added', alActualizar);
    return () => {
      cancelled = true;
      window.removeEventListener('cart:updated', alActualizar);
      window.removeEventListener('cart:added', alActualizar);
    };
  }, []);

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

  // Stock que realmente queda por agregar: el de la TIENDA ELEGIDA (sourcing
  // estricto), menos lo ya en el carrito para esa misma tienda. Si la tienda es
  // ilimitada, el tope es Infinito. Sin tienda elegida no hay tope todavía.
  const tiendaElegida = useMemo(
    () => variacion?.stockPorTienda?.find((s) => s.tienda.id === tiendaSel) ?? null,
    [variacion, tiendaSel],
  );
  const stockBase = tiendaElegida
    ? tiendaElegida.ilimitado
      ? null
      : (tiendaElegida.cantidad ?? 0)
    : null;
  const yaEnCarrito = useMemo(() => {
    if (!variacion || !cartLines || !tiendaSel) return 0;
    const key = variacion.sku;
    const line = cartLines.find(
      (l) => (l.sku ?? l.variationUuid) === key && (l.storeId ?? '') === tiendaSel,
    );
    return line?.quantity ?? 0;
  }, [variacion, cartLines, tiendaSel]);
  const stockRestante = stockBase == null ? Infinity : Math.max(0, stockBase - yaEnCarrito);
  const hayStock = completa && !!variacion && !!tiendaSel && stockRestante > 0;

  // Mensaje de error preciso según qué dimensión falta.
  const faltantes = dimensionesRequeridas(tipo).filter((d) => !seleccion[d]);
  // Con variación resuelta pero sin tienda elegida (sourcing estricto).
  const faltaTienda = completa && !!variacion && !tiendaSel && tiendasElegibles.length > 0;
  const mensajeError =
    faltantes.length === 1
      ? faltantes[0] === 'talla'
        ? tr('tienda.product.seleccion_incompleta_talla')
        : faltantes[0] === 'color'
          ? tr('tienda.product.seleccion_incompleta_color')
          : faltantes[0] === 'edicion'
            ? tr('tienda.product.selecciona_edicion')
            : tr('tienda.product.selecciona_formato')
      : faltaTienda
        ? tr('tienda.ubicacion.selecciona_tienda_error')
        : esPrenda
          ? tr('tienda.product.seleccion_incompleta')
          : tr('tienda.product.seleccion_incompleta_color');

  // Al cambiar una dimensión, invalida las OTRAS dimensiones seleccionadas que
  // ya no tienen combinación disponible (p. ej. talla S + color Azul → si Azul
  // no existe en S, se deselecciona el color automáticamente).
  const validarCascada = (
    prev: SeleccionAtributos,
    next: SeleccionAtributos,
  ): SeleccionAtributos => {
    const dims: (keyof SeleccionAtributos)[] = ['talla', 'color', 'edicion', 'formato'];
    const cambiadas = dims.filter((d) => prev[d] !== next[d]);
    const resultado: SeleccionAtributos = { ...next };
    for (const d of dims) {
      if (cambiadas.includes(d) || !resultado[d]) continue;
      if (
        !combinacionDisponible(
          variaciones,
          resultado.talla,
          resultado.color,
          resultado.edicion,
          resultado.formato,
        )
      ) {
        delete resultado[d];
      }
    }
    return resultado;
  };

  const toggleDim = (dim: keyof SeleccionAtributos, val: string) =>
    setSeleccion((prev) => {
      const siguiente: SeleccionAtributos = {
        ...prev,
        [dim]: prev[dim] === val ? undefined : val,
      };
      return validarCascada(prev, siguiente);
    });

  const setTalla = (t: string) => toggleDim('talla', t);
  const setColor = (c: string) => toggleDim('color', c);
  const setEdicion = (e: string) => toggleDim('edicion', e);
  const setFormato = (f: string) => toggleDim('formato', f);

  const cambiarCantidad = (delta: number) =>
    setCantidad((c) => Math.max(1, Math.min(stockRestante > 0 ? stockRestante : 1, c + delta)));

  // Reajustar la cantidad si cambia la variación, la tienda o el stock disponible.
  useEffect(() => {
    setCantidad((c) => Math.max(1, Math.min(stockRestante > 0 ? stockRestante : 1, c)));
  }, [stockRestante, tiendaSel]);

  async function anadirAlCarrito() {
    setServerError(null);
    if (!completa || !variacion || !tiendaSel) {
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
      storeId: tiendaSel,
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
        const data = (await res.json().catch(() => null)) as { message?: string; disponible?: number } | null;
        if (data?.message === 'stock_insufficient') {
          setServerError(
            tr('tienda.product.error_stock', { disponible: data.disponible ?? 0 }),
          );
        } else {
          setServerError(tr('tienda.product.error_servidor'));
        }
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
        <div
          className="group/zoom relative w-full aspect-square overflow-hidden rounded-2xl border border-form-border bg-egrem-gray-light"
          onMouseEnter={() => setZooming(true)}
          onMouseLeave={() => setZooming(false)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * 100;
            const y = ((e.clientY - r.top) / r.height) * 100;
            setZoomPos({
              x: Math.min(100, Math.max(0, x)),
              y: Math.min(100, Math.max(0, y)),
            });
          }}
        >
          {mainImage ? (
            <img
              src={mainImage}
              alt={producto.titulo}
              className="h-full w-full object-cover transition-transform duration-150 ease-out will-change-transform"
              style={
                zooming
                  ? { transform: 'scale(2.5)', transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }
                  : undefined
              }
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="icon text-egrem-gray/40 text-6xl">inventory_2</span>
            </div>
          )}

          {/* Lente que marca el área ampliada (tipo Amazon). */}
          {mainImage && zooming && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute border border-egrem-red/70 shadow-[0_0_0_1px_rgba(255,255,255,0.65)]"
              style={{
                width: '40%',
                height: '40%',
                left: `calc(${zoomPos.x}% - 20%)`,
                top: `calc(${zoomPos.y}% - 20%)`,
              }}
            />
          )}

          {/* Pista de interacción (se oculta al acercar). */}
          {mainImage && !zooming && (
            <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 font-display text-[11px] uppercase tracking-wide text-egrem-black shadow-sm">
              <span className="icon text-[14px]">zoom_in</span>
              {tr('tienda.product.zoom_hint')}
            </span>
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
              tiendaSel
                ? hayStock
                  ? 'text-[#16a34a]'
                  : 'text-egrem-red'
                : tiendasElegibles.length > 0
                  ? 'text-text-secondary'
                  : 'text-egrem-red'
            }`}
          >
            <span className="icon text-[16px]">
              {tiendaSel ? (hayStock ? 'check_circle' : 'error') : 'store'}
            </span>
            {tiendaSel ? (
              hayStock ? (
                stockBase == null ? (
                  yaEnCarrito > 0 ? (
                    tr('tienda.product.en_carrito', { enCarrito: yaEnCarrito })
                  ) : (
                    tr('tienda.product.en_stock')
                  )
                ) : yaEnCarrito > 0 ? (
                  <span>
                    {tr('tienda.product.stock_restante', { restante: stockRestante, enCarrito: yaEnCarrito })}
                  </span>
                ) : (
                  tr('tienda.product.en_stock')
                )
              ) : yaEnCarrito > 0 ? (
                tr('tienda.product.max_en_carrito', { enCarrito: yaEnCarrito })
              ) : (
                tr('tienda.product.sin_stock')
              )
            ) : tiendasElegibles.length > 0 ? (
              tr('tienda.ubicacion.selecciona_tienda')
            ) : (
              tr('tienda.product.sin_stock')
            )}
          </p>
        )}

        {tiendasElegibles.length > 0 && (
          <div className="mb-6">
            <p className={labelClase}>{tr('tienda.ubicacion.selector_titulo')}</p>
            <ul className="space-y-2">
              {tiendasElegibles.map((s) => {
                const sel = tiendaSel === s.tienda.id;
                const agotada = !s.ilimitado && (s.cantidad ?? 0) <= 0;
                return (
                  <li key={s.tienda.id}>
                    <label
                      className={[
                        'flex items-start gap-3 border-2 rounded-xl p-3 cursor-pointer transition-all',
                        sel
                          ? 'border-egrem-red bg-white'
                          : agotada
                            ? 'border-form-border opacity-50 cursor-not-allowed'
                            : 'border-form-border hover:border-egrem-red',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="tienda"
                        value={s.tienda.id}
                        checked={sel}
                        disabled={agotada}
                        onChange={() => setTiendaSel(s.tienda.id)}
                        className="mt-1 accent-egrem-red"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block font-display font-bold text-egrem-black">{s.tienda.label}</span>
                        {s.tienda.direccion && (
                          <span className="block font-display text-small text-text-secondary">
                            {s.tienda.direccion}
                          </span>
                        )}
                        <span
                          className={`font-display text-small ${
                            s.ilimitado || (s.cantidad ?? 0) > 0 ? 'text-[#16a34a]' : 'text-egrem-red'
                          }`}
                        >
                          {agotada
                            ? tr('tienda.ubicacion.agotado_en_esta_tienda')
                            : s.ilimitado
                              ? tr('tienda.product.stock_ilimitado')
                              : `${s.cantidad} ud.`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
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
                const dispC = combinacionDisponible(variaciones, seleccion.talla, c.nombre);
                return (
                  <button
                    key={c.nombre}
                    type="button"
                    title={c.nombre}
                    aria-label={c.nombre}
                    aria-pressed={activo}
                    disabled={!dispC}
                    onClick={() => setColor(c.nombre)}
                    style={{
                      backgroundColor: c.hex,
                      boxShadow: activo
                        ? '0 0 0 3px #fff, 0 0 0 5px var(--color-egrem-red)'
                        : undefined,
                    }}
                    className={[
                      'w-8 h-8 rounded-full border-2 transition-all duration-150',
                      !dispC
                        ? 'opacity-40 cursor-not-allowed border-egrem-gray/30'
                        : activo
                          ? 'border-egrem-red scale-110'
                          : 'border-egrem-gray/30 hover:border-egrem-red',
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex w-full sm:w-auto items-stretch border-2 border-form-border rounded-2xl bg-white h-14 overflow-hidden divide-x divide-form-border">
              <button
                type="button"
                onClick={() => cambiarCantidad(-1)}
                disabled={cantidad <= 1}
                aria-label={tr('tienda.product.cantidad') + ' -'}
                className="flex-none w-14 sm:w-12 h-full flex items-center justify-center text-egrem-black hover:text-egrem-red hover:bg-egrem-gray-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egrem-gold focus-visible:ring-inset disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                <span className="icon" style={{ fontSize: 22 }}>
                  remove
                </span>
              </button>
              <input
                aria-label={tr('tienda.product.cantidad')}
                className="flex-1 sm:flex-none sm:w-14 h-full text-center font-display font-bold text-[18px] border-none bg-transparent text-egrem-black tabular-nums p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egrem-gold focus-visible:ring-inset"
                type="text"
                value={cantidad}
                readOnly
              />
              <button
                type="button"
                onClick={() => cambiarCantidad(1)}
                disabled={cantidad >= stockRestante || stockRestante <= 0}
                aria-label={tr('tienda.product.cantidad') + ' +'}
                className="flex-none w-14 sm:w-12 h-full flex items-center justify-center text-egrem-black hover:text-egrem-red hover:bg-egrem-gray-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egrem-gold focus-visible:ring-inset disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                <span className="icon" style={{ fontSize: 22 }}>
                  add
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void anadirAlCarrito()}
              disabled={!completa || !tiendaSel || adding || stockRestante <= 0}
              aria-disabled={!completa || !tiendaSel || adding || stockRestante <= 0}
              className="w-full sm:flex-1 bg-egrem-red text-white font-display text-[18px] font-bold uppercase tracking-wide h-14 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-egrem-red-dark hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
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
