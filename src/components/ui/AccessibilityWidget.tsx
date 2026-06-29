import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'egrem-font-size';
const MIN_PCT = 80;
const MAX_PCT = 150;
const STEP = 10;

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const pct = parseInt(saved, 10);
      if (pct >= MIN_PCT && pct <= MAX_PCT) {
        document.documentElement.style.fontSize = `${pct}%`;
      }
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

  function getCurrent(): number {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 100;
  }

  function setSize(pct: number) {
    const clamped = Math.max(MIN_PCT, Math.min(MAX_PCT, pct));
    document.documentElement.style.fontSize = `${clamped}%`;
    localStorage.setItem(STORAGE_KEY, String(clamped));
  }

  return (
    <div ref={ref} className="aw-root" role="region" aria-label="Controles de accesibilidad">
      {open && (
        <div className="aw-panel">
          <button
            className="aw-btn"
            onClick={() => setSize(getCurrent() - STEP)}
            aria-label="Reducir tamaño de texto"
            type="button"
          >
            A&minus;
          </button>
          <button
            className="aw-btn aw-btn--reset"
            onClick={() => setSize(100)}
            aria-label="Restablecer tamaño de texto"
            type="button"
          >
            A
          </button>
          <button
            className="aw-btn"
            onClick={() => setSize(getCurrent() + STEP)}
            aria-label="Aumentar tamaño de texto"
            type="button"
          >
            A+
          </button>
        </div>
      )}
      <button
        className="aw-tab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar controles de accesibilidad' : 'Abrir controles de accesibilidad'}
        aria-expanded={open}
        type="button"
      >
        <span className="icon" style={{ fontSize: '1.25rem' }}>accessible</span>
      </button>
    </div>
  );
}
