import { useState, useEffect, useRef, useMemo } from 'react';
import type { Lang } from '@/i18n';

interface SearchResult {
  type: 'album' | 'artista' | 'actualidad' | 'video' | 'producto';
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string | null;
  href: string;
  youtubeId?: string | null;
}

interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  lang?: Lang;
}

import { useTranslations } from '@/i18n/translations';

const POPULAR_TAGS = ['Son cubano', 'Buena Vista', 'Trova', 'Salsa', 'Timba', 'Jazz cubano'];

type GroupKey = 'tienda' | 'novedades' | 'recursos';

interface GroupConfig {
  key: GroupKey;
  icon: string;
  types: SearchResult['type'][];
}

const GROUPS: GroupConfig[] = [
  { key: 'tienda', icon: 'shopping_bag', types: ['producto'] },
  { key: 'novedades', icon: 'newspaper', types: ['actualidad'] },
  { key: 'recursos', icon: 'library_music', types: ['album', 'artista', 'video'] },
];

const GROUP_LABEL: Record<GroupKey, Record<Lang, string>> = {
  tienda: { es: 'Tienda', en: 'Shop' },
  novedades: { es: 'Novedades', en: 'News' },
  recursos: { es: 'Recursos', en: 'Resources' },
};

const TYPE_BADGE: Record<string, Record<Lang, string>> = {
  producto: { es: 'Tienda', en: 'Shop' },
  actualidad: { es: 'Novedades', en: 'News' },
  album: { es: 'Lanzamiento', en: 'Release' },
  artista: { es: 'Artista', en: 'Artist' },
  video: { es: 'Video', en: 'Video' },
};

function groupResults(results: SearchResult[]): Record<GroupKey, SearchResult[]> {
  const grouped: Record<GroupKey, SearchResult[]> = {
    tienda: [],
    novedades: [],
    recursos: [],
  };
  for (const r of results) {
    for (const g of GROUPS) {
      if ((g.types as string[]).includes(r.type)) {
        grouped[g.key].push(r);
        break;
      }
    }
  }
  return grouped;
}

export default function SearchModal({ open, onClose, lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => groupResults(results), [results]);
  const hasQuery = query.trim().length >= 2;
  const total = results.length;
  const hasAnyResults = total > 0;

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setLoading(false);
      setError(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // reset scroll on new results
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [results]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error('search failed');
        const data: SearchResponse = await res.json();
        setResults(data.results ?? []);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(true);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // keep grouping; just go to first result or search page fallback
    if (results[0]?.href) window.location.href = results[0].href;
    else window.location.href = `/tienda?q=${encodeURIComponent(q)}`;
  }

  function handleVideoClick(item: SearchResult, e: React.MouseEvent) {
    e.preventDefault();
    onClose();
    if (item.youtubeId) {
      const el = document.querySelector(`[data-youtube-id="${item.youtubeId}"]`);
      if (el) {
        (el as HTMLElement).click();
      } else {
        const fake = document.createElement('a');
        fake.setAttribute('data-youtube-id', item.youtubeId);
        fake.style.display = 'none';
        document.body.appendChild(fake);
        fake.click();
        fake.remove();
      }
    }
  }

  function selectTag(tag: string) {
    setQuery(tag);
    inputRef.current?.focus();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        role="presentation"
        className="fixed inset-0 z-[9998] bg-black/55 backdrop-blur-[3px] transition-opacity duration-200"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr('nav.search')}
        className="fixed left-1/2 z-[9999] w-[min(720px,calc(100vw-1.5rem))] bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.18)] border border-black/[0.06] overflow-hidden flex flex-col transition-all duration-200"
        style={{
          top: '4.5rem',
          opacity: open ? 1 : 0,
          transform: open
            ? 'translateX(-50%) translateY(0) scale(1)'
            : 'translateX(-50%) translateY(-10px) scale(0.97)',
          pointerEvents: open ? 'auto' : 'none',
          maxHeight: 'min(78vh, 640px)',
        }}
      >
        {/* Search input */}
        <form onSubmit={handleSubmit} className="shrink-0">
          <div className="relative flex items-center">
            <span
              className="icon pointer-events-none absolute left-4 text-egrem-gray"
              style={{ fontSize: '1.35rem' }}
              aria-hidden="true"
            >
              search
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('search.placeholder')}
              aria-label={tr('search.placeholder')}
              autoComplete="off"
              className="w-full border-0 border-b border-black/5 bg-transparent py-4 pl-12 pr-12 font-display text-[15px] font-bold text-egrem-black placeholder:text-egrem-gray/60 focus:outline-none focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar búsqueda"
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full text-egrem-gray transition-colors hover:bg-black/5 hover:text-egrem-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egrem-gold"
            >
              <span className="icon" style={{ fontSize: '1.25rem' }}>
                close
              </span>
            </button>
          </div>
        </form>

        {/* Content */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          aria-live="polite"
          aria-busy={loading}
        >
          {/* Estado inicial: tags populares */}
          {!hasQuery && (
            <div className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="icon text-egrem-gold" style={{ fontSize: '1rem' }} aria-hidden="true">
                  local_fire_department
                </span>
                <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-egrem-gray">
                  {tr('search.popular')}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {POPULAR_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => selectTag(tag)}
                    className="rounded-full border border-black/10 bg-egrem-gray-light px-3.5 py-1.5 font-display text-[12px] font-bold text-egrem-black transition-colors hover:border-egrem-gold hover:bg-egrem-gold hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egrem-gold"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-dashed border-black/10 bg-section-neutral px-4 py-3">
                <p className="font-display text-[12px] leading-relaxed text-text-secondary">
                  Busca por <span className="font-bold text-egrem-black">producto</span>, canción, artista o noticia. Los resultados se agrupan en{' '}
                  <span className="inline-flex items-center gap-1 font-bold text-egrem-black">
                    <span className="icon text-[14px]">shopping_bag</span> Tienda
                  </span>
                  ,{' '}
                  <span className="inline-flex items-center gap-1 font-bold text-egrem-black">
                    <span className="icon text-[14px]">newspaper</span> Novedades
                  </span>{' '}
                  y{' '}
                  <span className="inline-flex items-center gap-1 font-bold text-egrem-black">
                    <span className="icon text-[14px]">library_music</span> Recursos
                  </span>
                  .
                </p>
              </div>
            </div>
          )}

          {/* Loading skeletons por sección */}
          {hasQuery && loading && (
            <div className="space-y-4 px-2 py-4">
              {GROUPS.map((g) => (
                <div key={g.key} className="px-3">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-black/10" />
                    <div className="h-3 w-20 animate-pulse rounded bg-black/10" />
                  </div>
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl bg-black/[0.03] p-3">
                        <div className="h-12 w-12 animate-pulse rounded-xl bg-black/10" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4 animate-pulse rounded bg-black/10" />
                          <div className="h-2.5 w-1/2 animate-pulse rounded bg-black/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {hasQuery && !loading && error && (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-egrem-red/10 text-egrem-red">
                <span className="icon">error</span>
              </div>
              <p className="font-display text-[13px] font-bold text-egrem-red">{tr('search.error')}</p>
              <button
                type="button"
                onClick={() => setQuery((q) => q + ' ')}
                className="mt-3 font-display text-[12px] font-bold uppercase tracking-widest text-brand-primary hover:underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Sin resultados global */}
          {hasQuery && !loading && !error && !hasAnyResults && (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-section-neutral text-egrem-gray">
                <span className="icon text-[1.7rem]">search_off</span>
              </div>
              <p className="font-display text-[14px] font-bold text-egrem-black">
                Sin resultados para “{query.trim()}”
              </p>
              <p className="mx-auto mt-1 max-w-sm font-display text-[12px] leading-relaxed text-text-secondary">
                Prueba con otro término o explora las secciones. Los productos de la tienda también se buscan aquí.
              </p>
            </div>
          )}

          {/* Resultados agrupados */}
          {hasQuery && !loading && !error && hasAnyResults && (
            <div className="py-2">
              {GROUPS.map((group) => {
                const items = grouped[group.key];
                const count = items.length;
                const label = GROUP_LABEL[group.key][lang];
                const isTienda = group.key === 'tienda';
                const isNovedades = group.key === 'novedades';

                // Siempre renderizamos el header para mantener la arquitectura visible,
                // incluso si está vacía (opacity atenuada).
                const viewAllHref = isTienda
                  ? `/tienda?q=${encodeURIComponent(query.trim())}`
                  : isNovedades
                    ? `/actualidad?q=${encodeURIComponent(query.trim())}`
                    : `/catalogo/musica?q=${encodeURIComponent(query.trim())}`;

                return (
                  <section key={group.key} className="border-b border-black/[0.04] last:border-0" aria-labelledby={`search-group-${group.key}`}>
                    {/* Sticky header */}
                    <div
                      id={`search-group-${group.key}`}
                      className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-4 py-2.5 backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[16px] ${
                            count > 0 ? 'bg-egrem-black text-white' : 'bg-black/5 text-egrem-gray'
                          }`}
                          aria-hidden="true"
                        >
                          <span className="icon" style={{ fontSize: '1rem' }}>
                            {group.icon}
                          </span>
                        </span>
                        <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.08em] text-egrem-black">
                          {label}
                        </h3>
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-display text-[11px] font-bold leading-none ${
                            count > 0 ? 'bg-egrem-gold text-white' : 'bg-black/5 text-egrem-gray'
                          }`}
                        >
                          {count}
                        </span>
                      </div>
                      {count > 0 && (
                        <a
                          href={viewAllHref}
                          className="action-link text-[11px] no-underline hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egrem-gold"
                          onClick={onClose}
                        >
                          Ver todo
                          <span className="icon text-[14px]" aria-hidden="true">
                            arrow_forward
                          </span>
                        </a>
                      )}
                    </div>

                    {/* Items */}
                    {count > 0 ? (
                      <ul role="list" className="mx-2 mb-2 space-y-1">
                        {items.map((item) => {
                          const badge = TYPE_BADGE[item.type]?.[lang] ?? item.type;
                          const isProduct = item.type === 'producto';
                          const isVideo = item.type === 'video';
                          const thumbIcon = isProduct
                            ? 'inventory_2'
                            : item.type === 'album'
                              ? 'album'
                              : item.type === 'artista'
                                ? 'person'
                                : item.type === 'video'
                                  ? 'videocam'
                                  : 'article';

                          const commonClasses =
                            'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-section-neutral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egrem-gold';

                          const content = (
                            <>
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-egrem-gray-light ring-1 ring-black/5 flex items-center justify-center">
                                {item.thumbnail ? (
                                  <img
                                    src={item.thumbnail}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="icon text-egrem-gray" style={{ fontSize: '1.4rem' }} aria-hidden="true">
                                    {thumbIcon}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="line-clamp-1 font-display text-[14px] font-bold leading-tight text-egrem-black group-hover:text-egrem-black">
                                  {item.title}
                                </div>
                                {item.subtitle && (
                                  <div className="line-clamp-1 font-display text-[12px] leading-tight text-text-secondary">
                                    {item.subtitle}
                                  </div>
                                )}
                              </div>
                              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                                <span className="rounded-full bg-black/[0.06] px-2 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-egrem-gray group-hover:bg-egrem-black group-hover:text-white transition-colors">
                                  {badge}
                                </span>
                                <span
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-egrem-gray shadow-sm ring-1 ring-black/5 transition-all group-hover:bg-egrem-red group-hover:text-white group-hover:ring-egrem-red"
                                  aria-hidden="true"
                                >
                                  <span className="icon text-[16px]">arrow_forward</span>
                                </span>
                              </div>
                              <span className="icon shrink-0 text-egrem-gray/40 group-hover:text-egrem-red sm:hidden" aria-hidden="true">
                                chevron_right
                              </span>
                            </>
                          );

                          if (isVideo) {
                            return (
                              <li key={`${item.type}-${item.id}`} role="listitem">
                                <button type="button" onClick={(e) => handleVideoClick(item, e)} className={commonClasses}>
                                  {content}
                                </button>
                              </li>
                            );
                          }

                          return (
                            <li key={`${item.type}-${item.id}`} role="listitem">
                              <a href={item.href} onClick={onClose} className={`${commonClasses} no-underline`}>
                                {content}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="mx-4 mb-3 rounded-xl border border-dashed border-black/10 bg-section-neutral/60 px-3 py-2.5">
                        <p className="font-display text-[11px] font-bold uppercase tracking-widest text-egrem-gray">
                          Sin coincidencias
                        </p>
                        <p className="font-display text-[12px] leading-relaxed text-text-secondary">
                          No hay {label.toLowerCase()} para “{query.trim()}”. Prueba otro término.
                        </p>
                      </div>
                    )}
                  </section>
                );
              })}

              {/* Resumen + atajo */}
              <div className="flex items-center justify-between px-4 py-2">
                <span className="font-display text-[11px] font-bold uppercase tracking-widest text-egrem-gray">
                  {total} resultado{total !== 1 ? 's' : ''} · 3 secciones
                </span>
                <span className="hidden items-center gap-1 font-display text-[11px] text-egrem-gray/60 sm:flex" aria-hidden="true">
                  <span className="rounded border border-black/10 bg-white px-1.5 py-0.5 font-mono text-[10px]">↵</span> abrir
                  <span className="rounded border border-black/10 bg-white px-1.5 py-0.5 font-mono text-[10px]">ESC</span> cerrar
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="shrink-0 border-t border-black/[0.06] bg-section-neutral/50 px-4 py-2.5 text-center">
          <span className="font-display text-[11px] leading-none text-egrem-gray">
            {tr('search.hint')}
          </span>
        </div>
      </div>
    </>
  );
}
