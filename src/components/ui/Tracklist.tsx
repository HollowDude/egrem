import { useEffect, useRef, useState } from 'react';
import type { NhTrack } from '@/lib/nodehive/entities';
import type { Lang } from '@/i18n';
import { useTranslations } from '@/i18n/translations';
import { EMBED_OPEN_EVENT, type EmbedOpenDetail, type MusicPlatform } from '@/lib/nodehive/music-embed';

interface Props {
  tracks: NhTrack[];
  lang?: Lang;
}

export const PREVIEW_LIMIT_SECONDS = 10;

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Tracklist({ tracks, lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function resetPlaybackState() {
    setPlayingIndex(null);
    setProgress(0);
    setCurrentTime(0);
  }

  function pauseNativeAudio() {
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();
    resetPlaybackState();
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime >= PREVIEW_LIMIT_SECONDS) {
      audio.pause();
      audio.currentTime = 0;
      resetPlaybackState();
      return;
    }
    setCurrentTime(audio.currentTime);
    setProgress(audio.currentTime / PREVIEW_LIMIT_SECONDS);
  }

  function togglePlay(idx: number) {
    const track = tracks[idx];
    if (!track) return;

    if (track.previewEmbedUrl && !track.audioUrl) {
      pauseNativeAudio();
      const detail: EmbedOpenDetail = {
        url: track.previewEmbedUrl,
        platform: (track.previewPlatform as MusicPlatform) ?? 'other',
      };
      window.dispatchEvent(new CustomEvent<EmbedOpenDetail>(EMBED_OPEN_EVENT, { detail }));
      return;
    }

    if (!track.audioUrl) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (playingIndex === idx) {
      audio.pause();
      setPlayingIndex(null);
      return;
    }

    if (audio.getAttribute('data-src') !== track.audioUrl) {
      audio.setAttribute('data-src', track.audioUrl);
      audio.src = `${track.audioUrl}#t=0,${PREVIEW_LIMIT_SECONDS}`;
      setProgress(0);
      setCurrentTime(0);
    }
    setPlayingIndex(idx);
    void audio.play();
  }

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) audio.pause();
    };
  }, []);

  return (
    <div className="bg-white border border-egrem-gray/20 rounded-xl overflow-hidden">
      <audio
        ref={audioRef}
        preload="none"
        controlsList="nodownload"
        onTimeUpdate={handleTimeUpdate}
        onEnded={resetPlaybackState}
        onContextMenu={(e) => e.preventDefault()}
        className="hidden"
      />
      <ul className="divide-y divide-egrem-gray/10">
        {tracks.map((track, idx) => {
          const isPlaying = playingIndex === idx;
          const hasAudio = Boolean(track.audioUrl);
          const hasEmbed = Boolean(track.previewEmbedUrl);
          const hasAnyPreview = hasAudio || hasEmbed;
          const duration =
            hasAudio
              ? PREVIEW_LIMIT_SECONDS
              : track.durationSeconds !== null
                ? track.durationSeconds
                : null;

          return (
            <li
              key={idx}
              className="relative flex items-center gap-4 px-4 md:px-5 py-3.5 group hover:bg-egrem-gray-light transition-colors overflow-hidden"
            >
              {hasAnyPreview ? (
                <button
                  type="button"
                  onClick={() => togglePlay(idx)}
                  aria-label={
                    isPlaying ? tr('musica.detail.pause_preview') : tr('musica.detail.play_preview')
                  }
                  aria-pressed={isPlaying}
                  className="w-6 h-6 flex items-center justify-center text-egrem-red shrink-0 cursor-pointer bg-transparent border-none p-0"
                >
                  <span
                    style={{
                      fontFamily: "'Material Symbols Outlined'",
                      fontVariationSettings: "'FILL' 1",
                      fontSize: 20,
                    }}
                  >
                    {isPlaying ? 'pause_circle' : 'play_circle'}
                  </span>
                </button>
              ) : (
                <span className="font-display font-bold text-[11px] text-egrem-gray w-6 text-center shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
              )}

              <span className="font-display font-semibold text-[0.95rem] text-egrem-black flex-1 min-w-0 truncate">
                {track.title}
              </span>

              {track.previewUrl && !hasAnyPreview ? (
                <a
                  href={track.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-egrem-gold font-display font-bold text-[10px] uppercase tracking-wider hover:text-egrem-gold/70 transition-colors shrink-0 no-underline"
                  aria-label={tr('musica.detail.preview')}
                >
                  <span className="icon" style={{ fontSize: 16 }}>open_in_new</span>
                  <span className="hidden sm:inline">{tr('musica.detail.preview')}</span>
                </a>
              ) : null}

              <span className="font-display text-small text-egrem-gray tabular-nums shrink-0">
                {isPlaying
                  ? `${formatDuration(currentTime)}${duration !== null ? ` / ${formatDuration(duration)}` : ''}`
                  : duration !== null
                    ? formatDuration(duration)
                    : ''}
              </span>

              {isPlaying && (
                <div
                  className="absolute bottom-0 left-0 h-[2px] bg-egrem-red"
                  style={{
                    width: `${Math.min(progress, 1) * 100}%`,
                    transition: 'width 0.3s linear, opacity 0.25s ease',
                    opacity: 1,
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
