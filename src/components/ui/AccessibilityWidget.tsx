import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'egrem-font-size';
const CONTRAST_KEY = 'egrem-contrast';
const MIN_PCT = 80;
const MAX_PCT = 150;
const STEP = 10;

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(100);
  const [contrast, setContrast] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const v = parseInt(saved, 10);
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
  }, []);

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

  function setSize(v: number) {
    const clamped = Math.max(MIN_PCT, Math.min(MAX_PCT, v));
    setPct(clamped);
    document.documentElement.style.fontSize = `${clamped}%`;
    localStorage.setItem(STORAGE_KEY, String(clamped));
  }

  function toggleContrast() {
    const next = !contrast;
    setContrast(next);
    if (next) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    localStorage.setItem(CONTRAST_KEY, String(next));
  }

  const isModified = pct !== 100;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="action-btn bg-transparent border-none cursor-pointer p-2 rounded-2xl flex items-center justify-center"
        style={{ color: '#1b1b1b', position: 'relative' }}
        aria-label={open ? 'Cerrar controles de accesibilidad' : 'Abrir controles de accesibilidad'}
        aria-expanded={open}
      >
        <span className="icon text-[22px]">text_fields</span>
        {isModified && (
          <span
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 6, height: 6, borderRadius: '50%',
              background: '#bc0100',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            minWidth: 200, background: '#ffffff',
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
          <div
            style={{
              fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: '#808080', marginBottom: 10,
            }}
          >
            Tamaño de texto
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setSize(pct - STEP)}
              aria-label="Reducir tamaño de texto"
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
                color: '#bc0100',
              }}
            >
              {pct}%
            </span>

            <button
              onClick={() => setSize(pct + STEP)}
              aria-label="Aumentar tamaño de texto"
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

          {isModified && (
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
                Restablecer
              </button>
            </div>
          )}

          <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: '#1b1b1b' }}>
              Alto contraste
            </span>
            <button
              role="switch"
              aria-checked={contrast}
              onClick={toggleContrast}
              type="button"
              style={{
                width: 36, height: 20,
                borderRadius: 10, border: 'none', cursor: 'pointer',
                background: contrast ? '#bc0100' : '#e0e0e0',
                position: 'relative', transition: 'background 0.2s ease',
                padding: 0, flexShrink: 0,
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
        </div>
      )}
    </div>
  );
}
