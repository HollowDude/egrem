import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type * as LeafletType from 'leaflet';
import type { NhSede } from '@/lib/nodehive/entities';
import { getProvinceName } from '@/lib/cuba';

interface SedeView extends NhSede {
  tipoName: string;
  provinciaName: string;
  provinciaSlug: string;
  municipio: string;
}

const TIPO_ORDER = ['Oficina Central', 'Centro Cultural', 'Complejo Cultural', 'Casas de la Música', 'Casa de la Música', 'Agencias', 'Agencia', 'Álbum Café', 'Café Cantante', 'Centros de Información', 'Piano Bar', 'Tiendas'];
const TIPO_COLORS: Record<string, string> = {
  'Oficina Central': '#bc0100',
  'Centro Cultural': '#7c3aed',
  'Complejo Cultural': '#7c3aed',
  'Casas de la Música': '#0d9488',
  'Casa de la Música': '#0d9488',
  'Agencias': '#CC9933',
  'Agencia': '#CC9933',
  'Álbum Café': '#0891b2',
  'Café Cantante': '#0891b2',
  'Centros de Información': '#d97706',
  'Piano Bar': '#db2777',
  'Tiendas': '#4f46e5',
};
const DEFAULT_COLOR = '#bc0100';

function getTipoColor(tipo: string): string {
  return TIPO_COLORS[tipo] ?? DEFAULT_COLOR;
}

function normalizeSede(s: NhSede): SedeView {
  const tipoName = s.tipo?.name ?? 'Otros';
  const provinciaCode = s.direccion?.administrative_area ?? '';
  const provinciaName = getProvinceName(provinciaCode);
  const provinciaSlug = provinciaCode;
  const municipio = s.direccion?.locality ?? '';
  return { ...s, tipoName, provinciaName, provinciaSlug, municipio };
}

function getPhoneNumber(s: SedeView): string {
  if (s.telefono.length > 0) return s.telefono[0].phone_number;
  return '';
}

function getEmail(s: SedeView): string {
  return s.correo;
}

function formatHorario(s: SedeView): string {
  if (!s.horario) return '';
  const start = s.horario.value ? new Date(s.horario.value).toLocaleDateString('es') : '';
  const end = s.horario.end_value ? new Date(s.horario.end_value).toLocaleDateString('es') : '';
  if (start && end) return `${start} — ${end}`;
  if (start) return start;
  return '';
}

function getAddress(s: SedeView): string {
  const parts: string[] = [];
  if (s.direccion?.address_line1) parts.push(s.direccion.address_line1);
  if (s.municipio) parts.push(s.municipio);
  if (s.provinciaName) parts.push(s.provinciaName);
  return parts.join(', ');
}

interface Props {
  sedes: NhSede[];
}

export default function SedesMap({ sedes }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletType.Map | null>(null);
  const markersRef = useRef<Map<string, LeafletType.Marker>>(new Map());
  const [L, setL] = useState<typeof LeafletType | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((mod) => {
      if (cancelled) return;
      const leaflet = (mod.default ?? mod) as unknown as typeof LeafletType;
      setL(leaflet);
      import('leaflet/dist/leaflet.css');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterProvincia, setFilterProvincia] = useState('');
  const [filterMunicipio, setFilterMunicipio] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  const normalized = useMemo(() => sedes.map(normalizeSede), [sedes]);

  const provincias = useMemo(() => {
    const set = new Set(normalized.map((s) => s.provinciaSlug).filter(Boolean));
    return Array.from(set).sort();
  }, [normalized]);

  const municipios = useMemo(() => {
    const set = new Set(
      normalized
        .filter((s) => !filterProvincia || s.provinciaSlug === filterProvincia)
        .map((s) => s.municipio)
        .filter(Boolean),
    );
    return Array.from(set).sort();
  }, [normalized, filterProvincia]);

  const tipos = useMemo(() => {
    const set = new Set(normalized.map((s) => s.tipoName).filter(Boolean));
    return Array.from(set).sort((a, b) => {
      const ia = TIPO_ORDER.indexOf(a);
      const ib = TIPO_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [normalized]);

  const filtered = useMemo(() => {
    return normalized.filter((s) => {
      if (filterProvincia && s.provinciaSlug !== filterProvincia) return false;
      if (filterMunicipio && s.municipio !== filterMunicipio) return false;
      if (filterTipo && s.tipoName !== filterTipo) return false;
      return true;
    });
  }, [normalized, filterProvincia, filterMunicipio, filterTipo]);

  const grouped = useMemo(() => {
    const groups: Record<string, SedeView[]> = {};
    for (const s of filtered) {
      if (!groups[s.tipoName]) groups[s.tipoName] = [];
      groups[s.tipoName].push(s);
    }
    return groups;
  }, [filtered]);

  const selectedSede = useMemo(
    () => (selectedId ? normalized.find((s) => s.id === selectedId) ?? null : null),
    [selectedId, normalized],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleReset = useCallback(() => {
    setFilterProvincia('');
    setFilterMunicipio('');
    setFilterTipo('');
    setSelectedId(null);
  }, []);

  useEffect(() => {
    if (!L || !mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [22.1, -79.5],
      zoom: 7,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);
    mapInstance.current = map;
  }, [L]);

  useEffect(() => {
    if (!L) return;
    const map = mapInstance.current;
    if (!map) return;

    const currentIds = new Set(normalized.map((s) => s.id));
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const s of normalized) {
      if (!s.location) continue;
      let marker = markersRef.current.get(s.id);
      if (!marker) {
        marker = L.marker([s.location.lat, s.location.lon]);
        marker.bindTooltip(s.title, {
          permanent: false,
          className: 'sede-tooltip',
          direction: 'top',
          offset: [0, -30],
        });
        marker.on('click', () => handleSelect(s.id));
        marker.addTo(map);
        markersRef.current.set(s.id, marker);
      }
    }

    return () => {
      for (const [, marker] of markersRef.current) {
        marker.remove();
      }
      markersRef.current.clear();
    };
  }, [L, normalized, handleSelect]);

  useEffect(() => {
    if (!L) return;
    const map = mapInstance.current;
    if (!map) return;

    const filteredIds = new Set(filtered.map((s) => s.id));

    for (const s of normalized) {
      const marker = markersRef.current.get(s.id);
      if (!marker) continue;

      const isVisible = filteredIds.has(s.id);
      const isSelected = s.id === selectedId;

      if (!isVisible) {
        marker.setOpacity(0.12);
      } else {
        marker.setOpacity(1);
        const color = getTipoColor(s.tipoName);
        const size = isSelected ? 36 : 26;
        const border = isSelected ? '3px solid white' : '2px solid white';
        const shadow = isSelected ? '0 3px 10px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.25)';
        const html = `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:${border};box-shadow:${shadow};"></div>`;
        marker.setIcon(
          L.divIcon({
            html,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size],
            popupAnchor: [0, -(size + 4)],
          }),
        );
      }
    }

    if (selectedSede && selectedSede.location) {
      map.setView([selectedSede.location.lat, selectedSede.location.lon], Math.max(map.getZoom(), 14), { animate: true });
    } else if (filtered.length > 0) {
      const bounds = L.latLngBounds(
        filtered.filter((s) => s.location).map((s) => [s.location!.lat, s.location!.lon]),
      );
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.35), { animate: true });
      }
    }
  }, [L, filtered, selectedId, selectedSede, normalized]);

  const selected = selectedSede;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* LEFT: Directory panel */}
      <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-3">
        {/* Filters */}
        <div className="bg-white border border-[#ebbbb4] rounded-lg p-4">
          <p className="font-label-sm text-[10px] text-[#603e39] uppercase tracking-wider font-bold mb-3 flex items-center gap-1.5">
            <span className="icon text-[14px] text-[#FF0000]">tune</span>
            Filtrar sedes
          </p>
          <div className="space-y-2.5">
            <div className="relative">
              <select
                value={filterProvincia}
                onChange={(e) => { setFilterProvincia(e.target.value); setFilterMunicipio(''); setSelectedId(null); }}
                className="w-full appearance-none border border-[#ebbbb4] rounded-xl px-3 py-2.5 pr-8 text-[14px] text-[#1b1b1b] bg-white focus:border-[#FF0000] focus:outline-none cursor-pointer transition-colors"
              >
                <option value="">Todas las provincias</option>
                {provincias.map((p) => (
                  <option key={p} value={p}>{getProvinceName(p)}</option>
                ))}
              </select>
              <span className="icon absolute right-2 top-1/2 -translate-y-1/2 text-[#603e39] text-[18px] pointer-events-none">expand_more</span>
            </div>
            <div className="relative">
              <select
                value={filterMunicipio}
                onChange={(e) => { setFilterMunicipio(e.target.value); setSelectedId(null); }}
                disabled={!filterProvincia}
                className="w-full appearance-none border border-[#ebbbb4] rounded-xl px-3 py-2.5 pr-8 text-[14px] text-[#1b1b1b] bg-white focus:border-[#FF0000] focus:outline-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Todos los municipios</option>
                {municipios.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="icon absolute right-2 top-1/2 -translate-y-1/2 text-[#603e39] text-[18px] pointer-events-none">expand_more</span>
            </div>
            <div className="relative">
              <select
                value={filterTipo}
                onChange={(e) => { setFilterTipo(e.target.value); setSelectedId(null); }}
                className="w-full appearance-none border border-[#ebbbb4] rounded-xl px-3 py-2.5 pr-8 text-[14px] text-[#1b1b1b] bg-white focus:border-[#FF0000] focus:outline-none cursor-pointer transition-colors"
              >
                <option value="">Todos los tipos</option>
                {tipos.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="icon absolute right-2 top-1/2 -translate-y-1/2 text-[#603e39] text-[18px] pointer-events-none">expand_more</span>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="mt-3 w-full text-center text-[10px] uppercase tracking-wider text-[#603e39] hover:text-[#FF0000] transition-colors flex items-center justify-center gap-1 font-bold"
          >
            <span className="icon text-[13px]">refresh</span>
            Limpiar filtros
          </button>
        </div>

        {/* Directory list */}
        <div className="bg-white border border-[#ebbbb4] rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: '420px' }}>
          <div className="px-4 py-2.5 border-b border-[#ebbbb4] bg-[#f5f5f5] flex items-center justify-between flex-shrink-0">
            <p className="text-[10px] text-[#603e39] uppercase tracking-wider font-bold">Directorio</p>
            <span className="text-[10px] text-[#FF0000] uppercase tracking-wider font-bold">
              {filtered.length}{filtered.length === 1 ? ' sede' : ' sedes'}
            </span>
          </div>
          <div className="overflow-y-auto flex-grow divide-y divide-[#ebbbb4]/40">
            {filtered.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-[11px] uppercase tracking-wider text-[#603e39]">Sin resultados</p>
              </div>
            ) : (
              TIPO_ORDER.filter((t) => grouped[t]).concat(
                Object.keys(grouped).filter((t) => !TIPO_ORDER.includes(t)),
              ).filter((t, i, arr) => arr.indexOf(t) === i).map((tipo) => (
                <div key={tipo} className="pt-2 pb-1">
                  <p
                    className="px-3 py-1 text-[9px] uppercase tracking-widest font-bold"
                    style={{ color: getTipoColor(tipo) }}
                  >
                    {tipo}
                  </p>
                  {grouped[tipo].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelect(s.id)}
                      className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 border-l-[3px] transition-colors hover:bg-[#f5f5f5]"
                      style={{
                        borderLeftColor: selectedId === s.id ? '#FF0000' : 'transparent',
                        background: selectedId === s.id ? '#fff5f5' : undefined,
                      }}
                    >
                      <span className="text-[13px] text-[#1b1b1b] overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                        {s.title}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-[#603e39] whitespace-nowrap flex-shrink-0">
                        {s.municipio}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white border border-[#ebbbb4] rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {tipos.map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getTipoColor(t) }} />
              <span className="text-[10px] text-[#603e39] uppercase tracking-wider">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Map + Detail card */}
      <div className="flex-grow min-w-0 flex flex-col gap-4">
        {/* Map */}
        <div
          ref={mapRef}
          className="w-full rounded-lg overflow-hidden border border-[#ebbbb4] shadow-sm"
          style={{ height: '460px', zIndex: 0 }}
        />

        {/* Detail card */}
        {selected ? (
          <div className="bg-white border border-[#ebbbb4] rounded-lg overflow-hidden">
            <div className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5 pb-4 border-b border-[#ebbbb4]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-[10px] h-[10px] rounded-full flex-shrink-0 inline-block"
                      style={{ background: getTipoColor(selected.tipoName) }}
                    />
                    <span
                      className="text-[10px] uppercase tracking-widest font-bold"
                      style={{ color: getTipoColor(selected.tipoName) }}
                    >
                      {selected.tipoName}
                    </span>
                  </div>
                  <h3 className="text-h3 text-[#1b1b1b] uppercase leading-tight">{selected.title}</h3>
                  <p className="text-[11px] uppercase tracking-wider text-[#603e39] mt-1">
                    {selected.provinciaName} &bull; {selected.municipio}
                  </p>
                </div>
                {selected.location && (
                  <button
                    onClick={() => {
                      const map = mapInstance.current;
                      if (map) map.setView([selected.location!.lat, selected.location!.lon], 16, { animate: true });
                    }}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-[#ebbbb4] rounded-lg bg-transparent cursor-pointer text-[11px] uppercase tracking-wider text-[#603e39] hover:border-[#FF0000] hover:text-[#FF0000] transition-colors"
                  >
                    <span className="icon text-[14px]">my_location</span>
                    Centrar mapa
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selected.direccion && (
                  <InfoRow icon="location_on" label="Dirección" value={getAddress(selected)} />
                )}
                {selected.horario && (
                  <InfoRow icon="schedule" label="Horario" value={formatHorario(selected)} />
                )}
                {getPhoneNumber(selected) && (
                  <InfoRow icon="call" label="Teléfono" value={getPhoneNumber(selected)} />
                )}
                {getEmail(selected) && (
                  <InfoRow icon="mail" label="Correo">
                    <a href={`mailto:${getEmail(selected)}`} className="text-[#FF0000] no-underline hover:underline">
                      {getEmail(selected)}
                    </a>
                  </InfoRow>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-dashed border-[#ebbbb4] rounded-lg p-8 text-center">
            <span className="icon text-[#603e39] text-[28px] mb-2 block">location_searching</span>
            <p className="text-[11px] text-[#603e39] uppercase tracking-wider">
              Selecciona una sede del directorio o haz clic en un marcador del mapa
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, children }: { icon: string; label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="icon text-[18px] text-[#FF0000] flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-[#603e39] mb-0.5">{label}</p>
        {children ?? <p className="text-[13px] text-[#1b1b1b] leading-relaxed">{value}</p>}
      </div>
    </div>
  );
}
