import { useState, useEffect } from 'react';
import type { MusicPlatform } from '@/lib/nodehive/music-embed';
import { platformLabel, EMBED_CONFIG, EMBED_OPEN_EVENT, type EmbedOpenDetail } from '@/lib/nodehive/music-embed';

interface EmbedState {
  url: string;
  platform: MusicPlatform;
}

export default function MusicEmbedPlayer() {
  const [embed, setEmbed] = useState<EmbedState | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('[data-embed-url]');
      if (target) {
        e.preventDefault();
        const url = target.getAttribute('data-embed-url');
        const platform = (target.getAttribute('data-embed-platform') as MusicPlatform) ?? 'other';
        if (url) setEmbed({ url, platform });
      }
    }
    function onOpenEmbed(e: Event) {
      const detail = (e as CustomEvent<EmbedOpenDetail>).detail;
      if (detail?.url) setEmbed({ url: detail.url, platform: detail.platform ?? 'other' });
    }
    document.addEventListener('click', handler);
    window.addEventListener(EMBED_OPEN_EVENT, onOpenEmbed);
    return () => {
      document.removeEventListener('click', handler);
      window.removeEventListener(EMBED_OPEN_EVENT, onOpenEmbed);
    };
  }, []);

  useEffect(() => {
    if (!embed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEmbed(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [embed]);

  if (!embed) return null;

  const config = embed.platform === 'apple_music' ? EMBED_CONFIG.apple_music : EMBED_CONFIG.spotify;
  const label = platformLabel(embed.platform) || 'Spotify';
  const separator = embed.url.includes('?') ? '&' : '?';

  return (
    <>
      <div
        onClick={() => setEmbed(null)}
        role="presentation"
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.8)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Reproductor de ${label}`}
        style={{
          position: 'fixed', zIndex: 9999,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(500px, calc(100vw - 2rem))',
        }}
      >
        <iframe
          src={`${embed.url}${separator}utm_source=oembed`}
          title={`Reproductor de ${label}`}
          allow={config.allow}
          loading="lazy"
          style={{
            width: '100%', height: config.height, border: 'none', borderRadius: 12,
          }}
        />
        <button
          onClick={() => setEmbed(null)}
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
