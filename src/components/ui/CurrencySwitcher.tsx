import { useState, useEffect, useRef } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';

const STORAGE_KEY = 'egrem-currency';

interface Props {
  defaultCurrency?: 'USD' | 'CUP';
  lang?: Lang;
}

type Currency = 'USD' | 'CUP';

export default function CurrencySwitcher({ defaultCurrency = 'USD', lang = 'es' }: Props) {
  const tr = useTranslations(lang);
  const currencies: { code: Currency; labelKey: string }[] = [
    { code: 'USD', labelKey: 'nav.currency.usd' },
    { code: 'CUP', labelKey: 'nav.currency.cup' },
  ];
  const [currency, setCurrencyState] = useState<Currency>(defaultCurrency);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Currency | null;
    const initial = saved || defaultCurrency;
    setCurrencyState(initial);
    (window as any).__EGREM_CURRENCY__ = initial;
  }, [defaultCurrency]);

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

  function setCurrency(c: Currency) {
    setCurrencyState(c);
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, c);
    (window as any).__EGREM_CURRENCY__ = c;
    window.dispatchEvent(new CustomEvent('currency-change', { detail: { currency: c } }));
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.10)',
          borderRadius: 20,
          padding: '3px 8px 3px 6px',
          cursor: 'pointer',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
          color: '#1b1b1b',
          minWidth: 72,
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.07)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.18)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.10)';
        }}
        aria-label={tr('nav.currency.select')}
        aria-expanded={open}
      >
        <span className="icon" style={{ fontSize: 16 }}>payments</span>
        {currency}
        <span className="icon" style={{
          fontSize: 14,
          transition: 'transform 0.2s ease',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          expand_more
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            minWidth: 190, background: '#ffffff',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            border: '1px solid rgba(0,0,0,0.08)',
            zIndex: 200,
            opacity: 1,
            transform: 'translateY(0)',
            transition: 'opacity 150ms ease, transform 150ms ease',
            overflow: 'hidden',
          }}
        >
          {currencies.map(c => (
            <button
              key={c.code}
              type="button"
              onClick={() => setCurrency(c.code)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '8px 14px', border: 'none', cursor: 'pointer',
                background: 'transparent', textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#1b1b1b' }}>
                  {c.code}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#808080', marginLeft: 6 }}>
                  — {tr(c.labelKey)}
                </span>
              </span>
              {currency === c.code && (
                <span className="icon" style={{ fontSize: 14, color: '#bc0100' }}>check</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
