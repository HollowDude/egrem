import { useState, useEffect, useMemo } from 'react';

export interface BoletinModalItem {
  id: string;
  title: string;
  date: string;
  fileUrl: string | null;
}

interface Props {
  boletines: BoletinModalItem[];
}

function formatDate(d: string): string {
  if (!d) return '';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return d;
  return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function yearOf(d: string): number | null {
  const dateObj = new Date(d);
  return isNaN(dateObj.getTime()) ? null : dateObj.getFullYear();
}

const PER_PAGE = 10;

export default function BoletinesModal({ boletines }: Props) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState('todos');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('[data-boletines-modal-trigger]');
      if (target) {
        e.preventDefault();
        setOpen(true);
        setPage(1);
      }
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const years = useMemo(() => {
    const set = new Set<number>();
    boletines.forEach((b) => {
      const y = yearOf(b.date);
      if (y !== null) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [boletines]);

  const filtered = useMemo(() => {
    let list = boletines;
    if (year !== 'todos') {
      list = list.filter((b) => String(yearOf(b.date)) === year);
    }
    return [...list].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return order === 'desc' ? -diff : diff;
    });
  }, [boletines, year, order]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  useEffect(() => { setPage(1); }, [year, order]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        role="presentation"
        style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Boletines"
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(560px, calc(100vw - 2rem))',
          maxHeight: 'calc(100vh - 4rem)',
          display: 'flex', flexDirection: 'column',
          background: '#ffffff', borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          zIndex: 9999, overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
              color: '#000', margin: 0,
            }}
          >
            Boletines
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#808080', display: 'flex' }}
          >
            <span style={{ fontFamily: "'Material Symbols Outlined'", fontSize: 22 }}>close</span>
          </button>
        </div>

        <div
          style={{
            display: 'flex', gap: 10, alignItems: 'center',
            padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <label style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: '#808080' }}>
            Año
          </label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{
              fontFamily: 'var(--font-display)', fontSize: 13, padding: '6px 10px',
              borderRadius: 6, border: '1px solid rgba(0,0,0,0.15)', background: '#fff',
            }}
          >
            <option value="todos">Todos</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#CC9933', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}
          >
            <span style={{ fontFamily: "'Material Symbols Outlined'", fontSize: 16 }}>
              {order === 'desc' ? 'arrow_downward' : 'arrow_upward'}
            </span>
            {order === 'desc' ? 'Más reciente' : 'Más antiguo'}
          </button>
        </div>

        <ul style={{ overflowY: 'auto', margin: 0, padding: '4px 20px', listStyle: 'none' }}>
          {filtered.length === 0 && (
            <li style={{ padding: '24px 0', textAlign: 'center', color: '#808080', fontSize: 13 }}>
              No hay boletines para este filtro.
            </li>
          )}
          {paged.map((b) => (
            <li
              key={b.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                <span style={{ fontFamily: "'Material Symbols Outlined'", color: '#CC9933', marginTop: 2 }}>
                  picture_as_pdf
                </span>
                <div style={{ minWidth: 0 }}>
                  {b.fileUrl ? (
                    <a
                      href={b.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                        color: '#000', textDecoration: 'none',
                      }}
                    >
                      {b.title}
                    </a>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#808080' }}>
                      {b.title}
                    </span>
                  )}
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: '#808080', margin: '2px 0 0' }}>
                    {b.fileUrl ? `PDF · ${formatDate(b.date)}` : `Archivo no disponible · ${formatDate(b.date)}`}
                  </p>
                </div>
              </div>
              {b.fileUrl && (
                <a
                  href={b.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Descargar ${b.title}`}
                  style={{ flexShrink: 0, color: '#808080', display: 'flex' }}
                >
                  <span style={{ fontFamily: "'Material Symbols Outlined'" }}>download</span>
                </a>
              )}
            </li>
          ))}
        </ul>

        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center',
            padding: '12px 20px', borderTop: '1px solid rgba(0,0,0,0.08)',
          }}>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                aria-label="Anterior"
                style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)',
                  background: safePage <= 1 ? 'transparent' : '#fff',
                  cursor: safePage <= 1 ? 'default' : 'pointer',
                  color: safePage <= 1 ? '#ccc' : '#808080',
                }}
              >
                <span style={{ fontFamily: "'Material Symbols Outlined'", fontSize: 18 }}>chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  style={{
                    minWidth: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, border: 'none',
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                    background: p === safePage ? 'transparent' : 'transparent',
                    cursor: 'pointer',
                    borderBottom: p === safePage ? '2px solid #FF0000' : '2px solid transparent',
                    color: p === safePage ? '#FF0000' : '#000',
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                aria-label="Siguiente"
                style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)',
                  background: safePage >= totalPages ? 'transparent' : '#fff',
                  cursor: safePage >= totalPages ? 'default' : 'pointer',
                  color: safePage >= totalPages ? '#ccc' : '#808080',
                }}
              >
                <span style={{ fontFamily: "'Material Symbols Outlined'", fontSize: 18 }}>chevron_right</span>
              </button>
            </nav>
          </div>
        )}
      </div>
    </>
  );
}
