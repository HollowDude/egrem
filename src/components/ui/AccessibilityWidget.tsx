import { useState, useEffect, useRef } from 'react';
import type { Lang } from '@/i18n';
import { useTranslations } from '@/i18n/translations';

const FONT_KEY = 'egrem-font-size';
const CONTRAST_KEY = 'egrem-contrast';
const COLOR_MODE_KEY = 'egrem-color-mode';
const MIN_PCT = 80;
const MAX_PCT = 150;
const STEP = 10;

type ColorMode = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

const COLOR_MODES: { value: ColorMode; trKey: string; icon: string }[] = [
  { value: 'normal', trKey: 'a11y.color_normal', icon: 'palette' },
  { value: 'protanopia', trKey: 'a11y.color_protanopia', icon: 'visibility' },
  { value: 'deuteranopia', trKey: 'a11y.color_deuteranopia', icon: 'visibility' },
  { value: 'tritanopia', trKey: 'a11y.color_tritanopia', icon: 'visibility' },
  { value: 'achromatopsia', trKey: 'a11y.color_achromatopsia', icon: 'contrast' },
];

function injectColorFilters() {
  if (document.getElementById('cb-filters')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'cb-filters';
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = `
    <filter id="cb-protanopia">
      <feColorMatrix type="matrix" values="
        0.567, 0.433, 0,     0, 0
        0.558, 0.442, 0,     0, 0
        0,     0.242, 0.758, 0, 0
        0,     0,     0,     1, 0
      "/>
    </filter>
    <filter id="cb-deuteranopia">
      <feColorMatrix type="matrix" values="
        0.625, 0.375, 0,   0, 0
        0.700, 0.300, 0,   0, 0
        0,     0.300, 0.7, 0, 0
        0,     0,     0,   1, 0
      "/>
    </filter>
    <filter id="cb-tritanopia">
      <feColorMatrix type="matrix" values="
        0.950, 0.050, 0,     0, 0
        0,     0.433, 0.567, 0, 0
        0,     0.475, 0.525, 0, 0
        0,     0,     0,     1, 0
      "/>
    </filter>
    <filter id="cb-achromatopsia">
      <feColorMatrix type="matrix" values="
        0.299, 0.587, 0.114, 0, 0
        0.299, 0.587, 0.114, 0, 0
        0.299, 0.587, 0.114, 0, 0
        0,     0,     0,     1, 0
      "/>
    </filter>
  `;
  document.body.prepend(svg);
}

function applyColorMode(mode: ColorMode) {
  const html = document.documentElement;
  for (const m of COLOR_MODES) {
    html.classList.toggle(`colorblind-${m.value}`, m.value === mode && m.value !== 'normal');
  }
}

interface Props {
  lang?: Lang;
}

export default function AccessibilityWidget({ lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(100);
  const [contrast, setContrast] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>('normal');
  const ref = useRef<HTMLDivElement>(null);

  /* ─── Init from localStorage ──────────────────────────────────────── */
  useEffect(() => {
    injectColorFilters();

    const savedFont = localStorage.getItem(FONT_KEY);
    if (savedFont) {
      const v = parseInt(savedFont, 10);
      if (v >= MIN_PCT && v <= MAX_PCT) {
        setPct(v);
        document.documentElement.style.fontSize = `${v}%`;
      }
    }

    const savedContrast = localStorage.getItem(CONTRAST_KEY);
    if (savedContrast === 'true') {
      setContrast(true);
      document.documentElement.classList.add('high-contrast');
    }

    const savedColor = localStorage.getItem(COLOR_MODE_KEY) as ColorMode | null;
    if (savedColor && savedColor !== 'normal') {
      setColorMode(savedColor);
      applyColorMode(savedColor);
    }
  }, []);

  /* ─── Close on click outside ──────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ─── Font size ───────────────────────────────────────────────────── */
  function setSize(v: number) {
    const clamped = Math.max(MIN_PCT, Math.min(MAX_PCT, v));
    setPct(clamped);
    document.documentElement.style.fontSize = `${clamped}%`;
    localStorage.setItem(FONT_KEY, String(clamped));
  }

  /* ─── High contrast ──────────────────────────────────────────────── */
  function toggleContrast() {
    const next = !contrast;
    setContrast(next);
    // High contrast and colorblind modes conflict (both use filter).
    // If enabling high contrast, reset color mode to normal.
    if (next) {
      setColorMode('normal');
      applyColorMode('normal');
      localStorage.setItem(COLOR_MODE_KEY, 'normal');
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    localStorage.setItem(CONTRAST_KEY, String(next));
  }

  /* ─── Color mode ──────────────────────────────────────────────────── */
  function selectColorMode(mode: ColorMode) {
    setColorMode(mode);
    applyColorMode(mode);
    localStorage.setItem(COLOR_MODE_KEY, mode);

    // Colorblind filter overrides high-contrast filter → disable it
    if (mode !== 'normal' && contrast) {
      setContrast(false);
      document.documentElement.classList.remove('high-contrast');
      localStorage.setItem(CONTRAST_KEY, 'false');
    }
  }

  const isFontModified = pct !== 100;
  const isColorModified = colorMode !== 'normal';
  const isModified = isFontModified || contrast || isColorModified;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="action-btn bg-transparent border-none cursor-pointer p-2 rounded-2xl flex items-center justify-center"
        style={{ color: '#1b1b1b', position: 'relative' }}
        aria-label={tr(open ? 'a11y.close' : 'a11y.open')}
        aria-expanded={open}
      >
        <span className="icon text-[22px]">text_fields</span>
        {isModified && (
          <span
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 6, height: 6, borderRadius: '50%',
              background: '#CC0000',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            minWidth: 240, background: '#ffffff',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
            border: '1px solid rgba(0,0,0,0.08)',
            padding: '14px 16px',
            zIndex: 200,
            opacity: 1,
            transform: 'translateY(0)',
            transition: 'opacity 150ms ease, transform 150ms ease',
          }}
        >
          {/* ─── Font size ─────────────────────────────────────────────── */}
          <div
            style={{
              fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: '#808080', marginBottom: 10,
            }}
          >
            {tr('a11y.font_size')}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setSize(pct - STEP)}
              aria-label={tr('a11y.font_decrease')}
              type="button"
              style={{
                width: 32, height: 32, border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 6, fontFamily: 'var(--font-display)',
                fontWeight: 700, fontSize: 13,
                cursor: 'pointer', background: 'transparent', color: '#1b1b1b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              A&minus;
            </button>

            <span
              style={{
                width: 52, textAlign: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                color: '#CC0000',
              }}
            >
              {pct}%
            </span>

            <button
              onClick={() => setSize(pct + STEP)}
              aria-label={tr('a11y.font_increase')}
              type="button"
              style={{
                width: 32, height: 32, border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 6, fontFamily: 'var(--font-display)',
                fontWeight: 700, fontSize: 13,
                cursor: 'pointer', background: 'transparent', color: '#1b1b1b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              A+
            </button>
          </div>

          {isFontModified && (
            <div style={{ textAlign: 'right', marginTop: 4 }}>
              <button
                onClick={() => setSize(100)}
                type="button"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontSize: 11,
                  color: '#808080', textDecoration: 'underline',
                  padding: 0,
                }}
              >
                {tr('a11y.font_reset')}
              </button>
            </div>
          )}

          <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)' }} />

          {/* ─── High contrast ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: '#1b1b1b' }}>
              {tr('a11y.high_contrast')}
            </span>
            <button
              role="switch"
              aria-checked={contrast}
              onClick={toggleContrast}
              type="button"
              disabled={colorMode !== 'normal'}
              style={{
                width: 36, height: 20,
                borderRadius: 10, border: 'none', cursor: colorMode === 'normal' ? 'pointer' : 'default',
                background: contrast ? '#CC0000' : '#e0e0e0',
                position: 'relative', transition: 'background 0.2s ease',
                padding: 0, flexShrink: 0, opacity: colorMode === 'normal' ? 1 : 0.4,
              }}
            >
              <span
                style={{
                  position: 'absolute', top: 2, left: contrast ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#ffffff',
                  transition: 'transform 0.2s ease, left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </button>
          </div>

          <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)' }} />

          {/* ─── Color mode ────────────────────────────────────────────── */}
          <div
            style={{
              fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: '#808080', marginBottom: 8,
            }}
          >
            {tr('a11y.color_mode')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {COLOR_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => selectColorMode(m.value)}
                aria-pressed={colorMode === m.value}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', border: 'none', borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontSize: 12,
                  fontWeight: colorMode === m.value ? 700 : 400,
                  background: colorMode === m.value ? 'rgba(204,0,0,0.08)' : 'transparent',
                  color: colorMode === m.value ? '#CC0000' : '#1b1b1b',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  if (colorMode !== m.value) (e.currentTarget as HTMLElement).style.background = '#f5f5f5';
                }}
                onMouseLeave={e => {
                  if (colorMode !== m.value) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <span className="icon" style={{ fontSize: '1rem' }}>{m.icon}</span>
                {tr(m.trKey)}
                {colorMode === m.value && (
                  <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>
                )}
              </button>
            ))}
          </div>

          {/* Reset all */}
          {isModified && (
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button
                onClick={() => {
                  setSize(100);
                  if (contrast) toggleContrast();
                  if (colorMode !== 'normal') selectColorMode('normal');
                }}
                type="button"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontSize: 11,
                  color: '#808080', textDecoration: 'underline',
                  padding: 0,
                }}
              >
                {tr('a11y.reset_all')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
