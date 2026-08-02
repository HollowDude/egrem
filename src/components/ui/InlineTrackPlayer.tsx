import { useState, useEffect, useRef } from 'react';
import type { MusicPlatform } from '@/lib/nodehive/music-embed';
import { EMBED_CONFIG } from '@/lib/nodehive/music-embed';

interface Props {
  audioUrl?: string | null;
  embedUrl?: string | null;
  embedPlatform?: MusicPlatform | null;
  fixedDuration?: number | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function InlineTrackPlayer({
  audioUrl,
  embedUrl,
  embedPlatform,
  fixedDuration,
}: Props) {
  const [open, setOpen] = useState(false);
  const [autoDuration, setAutoDuration] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.duration)) {
      setAutoDuration(Math.round(audio.duration));
      return;
    }
    function onLoaded() {
      const el = audioRef.current;
      if (el && Number.isFinite(el.duration)) setAutoDuration(Math.round(el.duration));
    }
    audio.addEventListener('loadedmetadata', onLoaded);
    return () => audio.removeEventListener('loadedmetadata', onLoaded);
  }, []);

  if (!audioUrl && !embedUrl) return null;

  const isAudio = Boolean(audioUrl);
  const shownDuration = fixedDuration ?? (isAudio ? autoDuration : null);
  const config = embedPlatform === 'apple_music' ? EMBED_CONFIG.apple_music : EMBED_CONFIG.spotify;
  const separator = embedUrl?.includes('?') ? '&' : '?';

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-egrem-red font-display font-bold text-[10px] uppercase tracking-wider hover:text-egrem-red-dark transition-colors"
        >
          {isAudio ? (
            <span
              aria-hidden="true"
              style={{ fontFamily: "'Material Symbols Outlined'", fontVariationSettings: "'FILL' 1", fontSize: 18 }}
            >
              {open ? 'pause_circle' : 'play_circle'}
            </span>
          ) : (
            <span aria-hidden="true">
              {embedPlatform === 'apple_music' ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3c-.22.36-.68.47-1.04.25-2.85-1.74-6.44-2.13-10.67-1.17-.41.1-.83-.16-.93-.57-.1-.41.16-.83.57-.93 4.63-1.06 8.62-.6 11.83 1.38.36.22.47.68.24 1.04zm1.46-3.27c-.28.45-.86.6-1.31.32-3.26-2-8.23-2.58-12.09-1.41-.5.15-1.05-.13-1.2-.63-.15-.5.13-1.05.63-1.2 4.5-1.35 10.02-.7 13.84 1.63.45.28.6.86.32 1.31zm.13-3.4C15.24 8.35 8.82 8.16 5.1 9.3c-.6.18-1.24-.15-1.43-.75-.18-.6.15-1.24.75-1.43C9.02 5.8 16.09 6.02 20.71 8.9c.53.32.71 1.02.39 1.55-.32.53-1.02.71-1.55.39z" />
                </svg>
              )}
            </span>
          )}
          <span className="hidden sm:inline">Preview</span>
        </button>

        {shownDuration !== null && (
          <span className="font-display text-small text-egrem-gray tabular-nums">
            {formatDuration(shownDuration)}
          </span>
        )}
      </div>

      {isAudio && (
        <audio
          ref={audioRef}
          src={audioUrl ?? undefined}
          preload="metadata"
          controls={open}
          autoPlay={open}
          style={{ display: open ? 'block' : 'none', width: '100%' }}
        />
      )}

      {open && !isAudio && (
        <div className="w-full max-w-md">
          <iframe
            src={`${embedUrl}${separator}utm_source=oembed`}
            title="Preview"
            allow={config.allow}
            loading="lazy"
            style={{ width: '100%', height: config.height, border: 'none', borderRadius: 12 }}
          />
        </div>
      )}
    </div>
  );
}
