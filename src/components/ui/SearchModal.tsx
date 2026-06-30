import { useState, useEffect, useRef } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  lang?: Lang;
}

const POPULAR_TAGS = ['Son cubano', 'Buena Vista', 'Trova', 'Salsa', 'Timba', 'Jazz cubano'];

const MOCK_RESULTS = [
  { type: 'music_note', title: 'Buena Vista Social Club', subtitle: 'Álbum' },
  { type: 'music_note', title: 'Los Zafiros', subtitle: 'Artista' },
  { type: 'article', title: 'Historia de la Trova Cubana', subtitle: 'Artículo' },
  { type: 'event', title: 'Festival de Jazz 2025', subtitle: 'Evento' },
] as const;

export default function SearchModal({ open, onClose, lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
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

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const prefix = lang === 'en' ? '/en' : '';
    window.location.href = `${prefix}/buscar?q=${encodeURIComponent(q)}`;
  }

  function selectTag(tag: string) {
    setQuery(tag);
  }

  const hasQuery = query.trim().length >= 2;

  return (
    <>
      {/* Overlay */}
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

      {/* Panel */}
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

        {hasQuery && (
          <div>
            {/* TODO: conectar con API de búsqueda */}
            {MOCK_RESULTS.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 12, padding: '10px 20px',
                  alignItems: 'center', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F5F5'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
              >
                <span className="icon" style={{ fontSize: '1.2rem', color: '#808080' }}>
                  {item.type}
                </span>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: '#000000' }}>
                    {item.title}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: '#808080' }}>
                    {item.subtitle}
                  </div>
                </div>
              </div>
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
