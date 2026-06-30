import { useState, useEffect } from 'react';

export default function SpotifyPlayer() {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('[data-spotify-embed]');
      if (target) {
        e.preventDefault();
        const url = target.getAttribute('data-spotify-embed');
        if (url) setEmbedUrl(url);
      }
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (!embedUrl) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEmbedUrl(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [embedUrl]);

  if (!embedUrl) return null;

  return (
    <>
      <div
        onClick={() => setEmbedUrl(null)}
        role="presentation"
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.8)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reproductor de Spotify"
        style={{
          position: 'fixed', zIndex: 9999,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(500px, calc(100vw - 2rem))',
        }}
      >
        <iframe
          src={`${embedUrl}?utm_source=oembed`}
          title="Reproductor de Spotify"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{
            width: '100%', height: 352, border: 'none', borderRadius: 12,
          }}
        />
        <button
          onClick={() => setEmbedUrl(null)}
          aria-label="Cerrar"
          style={{
            position: 'absolute', top: -36, right: 0,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: '1.5rem',
          }}
        >
          <span className="icon">close</span>
        </button>
      </div>
    </>
  );
}
