import { useMemo, useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { TiendaInfo } from '@/types/tienda';
import { agruparPorProvincia } from '@/lib/nodehive/tiendas';
import {
  resolverTiendasPermitidas,
  type MunicipioSeleccionado,
} from '@/lib/tienda/ubicacion';

interface Props {
  tiendas: TiendaInfo[];
  seleccionInicial?: MunicipioSeleccionado[];
  lang?: Lang;
}

/**
 * Popup de zona geográfica: pill "Tu zona" + modal acordeón provincia → municipio.
 * Al aplicar guarda la cookie vía /api/tienda/preferencias y dispara
 * `ubicacion:cambiada` (con los ids de tienda permitidos) para que el listado
 * reaccione sin recargar. "Ver todo sin filtrar" guarda `[]` (mismo camino).
 *
 * Se monta con `client:load`. Auto-abre si no hay selección previa (primera visita).
 */
export default function UbicacionPopup({ tiendas, seleccionInicial = [], lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const [open, setOpen] = useState(seleccionInicial.length === 0);
  const [seleccion, setSeleccion] = useState<MunicipioSeleccionado[]>(seleccionInicial);

  const grupos = useMemo(() => agruparPorProvincia(tiendas), [tiendas]);
  const provincias = useMemo(() => Object.keys(grupos).sort(), [grupos]);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(provincias.map((p) => [p, true])),
  );

  const tieneSeleccion = seleccion.length > 0;
  const zonaLabel = useMemo(() => {
    if (!tieneSeleccion) return null;
    const prov = seleccion[0].provincia;
    const mismaProv = seleccion.every((s) => s.provincia === prov);
    if (mismaProv) {
      return `${prov} · ${seleccion.length} ${tr('tienda.ubicacion.municipio')}${seleccion.length > 1 ? '' : ''}`;
    }
    return tr('tienda.ubicacion.varias_zonas', { count: seleccion.length });
  }, [seleccion, tieneSeleccion, tr]);

  const toggleMunicipio = (provincia: string, municipio: string) => {
    setSeleccion((prev) => {
      const idx = prev.findIndex((s) => s.provincia === provincia && s.municipio === municipio);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { provincia, municipio }];
    });
  };

  const guardar = async (nueva: MunicipioSeleccionado[]) => {
    try {
      await fetch('/api/tienda/preferencias', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seleccion: nueva }),
      });
    } catch {
      /* best-effort: el evento de abajo igual actualiza la UI */
    }
    const permitidas = resolverTiendasPermitidas(nueva, tiendas);
    window.dispatchEvent(
      new CustomEvent('ubicacion:cambiada', { detail: { tiendasPermitidas: [...permitidas] } }),
    );
    setOpen(false);
  };

  const aplicar = () => void guardar(seleccion);
  const verTodo = () => {
    setSeleccion([]);
    void guardar([]);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 flex-1 min-w-0 sm:flex-none max-w-full px-4 h-11 rounded-full border-2 border-egrem-gold text-egrem-gold font-display font-bold text-[13px] uppercase tracking-wider hover:bg-egrem-gold hover:text-white transition-colors"
        >
          <span className="icon text-[18px] flex-none">location_on</span>
          {zonaLabel ? (
            <span
              className="min-w-0 truncate"
              title={`${tr('tienda.ubicacion.tu_zona')}: ${zonaLabel}`}
            >
              {tr('tienda.ubicacion.tu_zona')}: {zonaLabel}
            </span>
          ) : (
            <span className="truncate">{tr('tienda.ubicacion.elegir_zona')}</span>
          )}
          <span className="underline underline-offset-2 flex-none">{tr('tienda.ubicacion.cambiar')}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-egrem-gray-light">
              <h2 className="font-display font-bold text-h3 uppercase text-egrem-black m-0">
                {tr('tienda.ubicacion.popup_titulo')}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tr('tienda.quickbuy.cerrar')}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-egrem-gray-light transition-colors"
              >
                <span className="icon text-[22px]">close</span>
              </button>
            </div>

            <p className="px-6 pt-4 font-display text-small text-text-secondary m-0">
              {tr('tienda.ubicacion.popup_subtitulo')}
            </p>

            <div className="max-h-[55vh] overflow-y-auto px-6 py-4 space-y-3">
              {provincias.length === 0 && (
                <p className="font-display text-small text-text-secondary">
                  {tr('tienda.ubicacion.sin_tiendas')}
                </p>
              )}
              {provincias.map((prov) => {
                const abierto = abiertos[prov];
                return (
                  <div key={prov} className="border border-form-border rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAbiertos((a) => ({ ...a, [prov]: !a[prov] }))}
                      className="w-full flex items-center justify-between px-4 py-3 font-display font-bold text-egrem-black"
                    >
                      <span>{prov}</span>
                      <span className={`icon text-[20px] transition-transform ${abierto ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </button>
                    {abierto && (
                      <ul className="px-4 pb-3 space-y-1">
                        {grupos[prov].map((mun) => {
                          const checked = seleccion.some(
                            (s) => s.provincia === prov && s.municipio === mun,
                          );
                          return (
                            <li key={mun}>
                              <label className="flex items-center gap-3 cursor-pointer group py-1.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleMunicipio(prov, mun)}
                                  className="w-5 h-5 rounded accent-egrem-red cursor-pointer"
                                />
                                <span className="group-hover:text-egrem-red transition-colors font-display text-text-secondary">
                                  {mun}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-egrem-gray-light">
              <button
                type="button"
                onClick={verTodo}
                className="flex-1 border border-form-border text-egrem-black font-display font-bold uppercase py-3 rounded-2xl hover:border-egrem-red hover:text-egrem-red transition-colors"
              >
                {tr('tienda.ubicacion.ver_todo')}
              </button>
              <button
                type="button"
                onClick={aplicar}
                className="flex-1 bg-egrem-red text-white font-display font-bold uppercase py-3 rounded-2xl hover:bg-egrem-red-dark transition-colors"
              >
                {tr('tienda.ubicacion.aplicar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
