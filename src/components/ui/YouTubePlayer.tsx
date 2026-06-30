import { useState, useEffect } from 'react';

export default function YouTubePlayer() {
  const [videoId, setVideoId] = useState<string | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('[data-youtube-id]');
      if (target) {
        e.preventDefault();
        const id = target.getAttribute('data-youtube-id');
        if (id) setVideoId(id);
      }
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (!videoId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setVideoId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoId]);

  if (!videoId) return null;

  return (
    <>
      <div
        onClick={() => setVideoId(null)}
        role="presentation"
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.8)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Video de YouTube"
        style={{
          position: 'fixed', zIndex: 9999,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(896px, calc(100vw - 2rem))',
          aspectRatio: '16 / 9',
        }}
      >
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title="Reproductor de YouTube"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            width: '100%', height: '100%',
            border: 'none', borderRadius: 12,
          }}
        />
        <button
          onClick={() => setVideoId(null)}
          aria-label="Cerrar video"
          style={{
            position: 'absolute', top: -40, right: 0,
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
