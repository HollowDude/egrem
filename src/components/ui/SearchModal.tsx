import { useState, useEffect, useRef } from 'react';
import type { Lang } from '@/i18n';

interface SearchResult {
  type: 'album' | 'artista' | 'actualidad' | 'video';
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

const TYPE_LABELS: Record<string, Record<Lang, string>> = {
  album: { es: 'Álbum', en: 'Album' },
  artista: { es: 'Artista', en: 'Artist' },
  actualidad: { es: 'Actualidad', en: 'News' },
  video: { es: 'Video', en: 'Video' },
};

export default function SearchModal({ open, onClose, lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        const data: SearchResponse = await res.json();
        setResults(data.results ?? []);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(true);
      } finally {
        setLoading(false);
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    window.location.href = `/api/search?q=${encodeURIComponent(q)}`;
  }

  function handleResultClick(item: SearchResult) {
    onClose();
    if (item.type === 'video' && item.youtubeId) {
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
      return;
    }
    if (item.href) {
      window.location.href = item.href;
    }
  }

  function selectTag(tag: string) {
    setQuery(tag);
  }

  const hasQuery = query.trim().length >= 2;

  return (
    <>
      <div
        onClick={onClose}
        role="presentation"
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 180ms ease-out',
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr('nav.search')}
        style={{
          position: 'fixed', top: 80, left: '50%',
          width: 'min(640px, calc(100vw - 2rem))',
          zIndex: 9999,
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          opacity: open ? 1 : 0,
          transform: open ? 'translateX(-50%) translateY(0) scale(1)' : 'translateX(-50%) translateY(-12px) scale(0.97)',
          transition: 'opacity 180ms ease-out, transform 180ms ease-out',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span
              className="icon"
              style={{
                position: 'absolute', left: 16,
                fontSize: '1.3rem', color: '#808080',
                pointerEvents: 'none',
              }}
            >
              search
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={tr('search.placeholder')}
              aria-label={tr('search.placeholder')}
              style={{
                width: '100%', border: 'none', outline: 'none',
                fontFamily: 'var(--font-display)', fontSize: 15,
                padding: '16px 48px 16px 48px',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                background: 'transparent',
              }}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar búsqueda"
              style={{
                position: 'absolute', right: 12,
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#808080', padding: 4, display: 'flex',
              }}
            >
              <span className="icon" style={{ fontSize: '1.2rem' }}>close</span>
            </button>
          </div>
        </form>

        {!hasQuery && (
          <div style={{ padding: '16px 20px' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                color: '#808080', marginBottom: 10,
              }}
            >
              {tr('search.popular')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {POPULAR_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => selectTag(tag)}
                  style={{
                    padding: '5px 12px', borderRadius: 9999, border: '1px solid rgba(0,0,0,0.10)',
                    background: '#F5F5F5', cursor: 'pointer',
                    fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                    color: '#1b1b1b', transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#CC9933'; (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F5F5F5'; (e.currentTarget as HTMLElement).style.color = '#1b1b1b'; }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasQuery && loading && (
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 13, color: '#808080',
            }}>
              {tr('search.loading')}
            </div>
          </div>
        )}

        {hasQuery && !loading && error && (
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 13, color: '#CC0000',
            }}>
              {tr('search.error')}
            </div>
          </div>
        )}

        {hasQuery && !loading && !error && results.length === 0 && (
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 13, color: '#808080',
            }}>
              {tr('search.no_results').replace('{query}', query.trim())}
            </div>
          </div>
        )}

        {hasQuery && !loading && !error && results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {results.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => handleResultClick(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '10px 20px',
                  border: 'none', borderBottom: '1px solid rgba(0,0,0,0.06)',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-display)', transition: 'background 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F5F5'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: item.thumbnail ? 'transparent' : '#F0F0F0',
                  overflow: 'hidden', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="icon" style={{ fontSize: '1.2rem', color: '#808080' }}>
                      {item.type === 'album' ? 'album' : item.type === 'artista' ? 'person' : item.type === 'video' ? 'videocam' : 'article'}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600,
                    color: '#1b1b1b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: 12, color: '#808080',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: '#F0F0F0', color: '#808080', flexShrink: 0,
                }}>
                  {TYPE_LABELS[item.type]?.[lang] ?? item.type}
                </span>
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            textAlign: 'center', padding: '10px 20px',
            fontFamily: 'var(--font-display)', fontSize: 11, color: '#808080',
            borderTop: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {tr('search.hint')}
        </div>
      </div>
    </>
  );
}
