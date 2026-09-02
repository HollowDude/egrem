import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import Alert from '@/components/ui/Alert';
import AddressForm from './AddressForm';

interface Direccion {
  uuid: string;
  countryCode: string;
  administrativeArea: string;
  locality: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
  firstName: string;
  lastName: string;
  phone: string;
  ciPassport: string;
  isDefault: boolean;
}

interface Props {
  lang?: Lang;
}

const CSS = {
  formBorder: 'var(--color-form-border)',
  textSecondary: 'var(--color-text-secondary)',
  egremGold: 'var(--color-egrem-gold)',
  brandPrimary: 'var(--color-brand-primary)',
  surfaceContainer: 'var(--color-surface-container)',
};

export default function AddressBook({ lang = 'es' }: Props) {
  const tr = useTranslations(lang as Lang);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Direccion | null>(null);

  async function load() {
    setFetching(true);
    setError('');
    try {
      const res = await fetch('/api/user/direcciones');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error');
      }
      const data = (await res.json()) as Direccion[];
      setDirecciones(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String((e as Error)?.message ?? tr('auth.dashboard.error')));
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleSuccess() {
    setShowForm(false);
    setEditing(null);
    setSuccess('');
    load();
  }

  async function handleDelete(uuid: string) {
    if (!window.confirm(tr('auth.dashboard.address_delete_confirm'))) return;
    setError('');
    try {
      const res = await fetch(`/api/user/direcciones/${uuid}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error');
      }
      load();
    } catch (e) {
      setError(String((e as Error)?.message ?? 'No se pudo eliminar.'));
    }
  }

  async function handleSetDefault(uuid: string) {
    setError('');
    try {
      const res = await fetch(`/api/user/direcciones/${uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error');
      }
      load();
    } catch (e) {
      setError(String((e as Error)?.message ?? 'No se pudo marcar como predeterminada.'));
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="inline-block w-6 h-6 border-2 border-[var(--color-brand-primary)]/30 border-t-[var(--color-brand-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8">
        <h3 className="text-h2 uppercase m-0 border-b-2 border-egrem-gold pb-2" style={{ borderColor: CSS.egremGold }}>
          {tr('auth.dashboard.addresses')}
        </h3>
        <p className="text-small mt-2" style={{ color: CSS.textSecondary }}>
          {tr('auth.dashboard.addresses_desc')}
        </p>
      </header>

      <Alert type="success" message={success} />
      <Alert type="error" message={error} />

      <div className="flex justify-end mb-6">
        {!showForm && !editing && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
            <span className="icon text-[18px]">add_location</span>
            {tr('auth.dashboard.address_add')}
          </button>
        )}
      </div>

      {(showForm || editing) && (
        <div className="mb-8">
          <AddressForm
            lang={lang}
            direccion={editing}
            onSuccess={handleSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      {direcciones.length === 0 ? (
        <div className="empty-state">
          <span className="icon text-[48px] mb-4" style={{ color: 'var(--color-egrem-gray)', opacity: 0.4 }}>
            location_off
          </span>
          <p className="text-small mb-4" style={{ color: CSS.textSecondary }}>
            {tr('auth.dashboard.address_empty')}
          </p>
          {!showForm && !editing && (
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
              {tr('auth.dashboard.address_add')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {direcciones.map((d) => (
            <div
              key={d.uuid}
              className="bg-white border rounded-xl p-6 shadow-sm flex flex-col"
              style={{ borderColor: CSS.formBorder }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="icon text-[20px]" style={{ color: CSS.egremGold }}>
                    location_on
                  </span>
                  {d.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border" style={{ background: 'var(--color-brand-primary)', color: '#fff', borderColor: 'var(--color-brand-primary)' }}>
                      <span className="icon text-[12px]">star</span>
                      {tr('auth.dashboard.address_default')}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!d.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(d.uuid)}
                      className="w-8 h-8 rounded-full border flex items-center justify-center transition-colors"
                      style={{ borderColor: CSS.formBorder, color: CSS.textSecondary }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = CSS.egremGold;
                        (e.currentTarget as HTMLElement).style.borderColor = CSS.egremGold;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = CSS.textSecondary;
                        (e.currentTarget as HTMLElement).style.borderColor = CSS.formBorder;
                      }}
                      aria-label={tr('auth.dashboard.address_set_default')}
                      title={tr('auth.dashboard.address_set_default')}
                    >
                      <span className="icon text-[16px]">star</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(d);
                      setShowForm(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-8 h-8 rounded-full border flex items-center justify-center transition-colors"
                    style={{ borderColor: CSS.formBorder, color: CSS.textSecondary }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = CSS.brandPrimary;
                      (e.currentTarget as HTMLElement).style.borderColor = CSS.brandPrimary;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = CSS.textSecondary;
                      (e.currentTarget as HTMLElement).style.borderColor = CSS.formBorder;
                    }}
                    aria-label={tr('auth.dashboard.address_edit')}
                  >
                    <span className="icon text-[16px]">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(d.uuid)}
                    className="w-8 h-8 rounded-full border flex items-center justify-center transition-colors"
                    style={{ borderColor: CSS.formBorder, color: CSS.textSecondary }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = CSS.brandPrimary;
                      (e.currentTarget as HTMLElement).style.borderColor = CSS.brandPrimary;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = CSS.textSecondary;
                      (e.currentTarget as HTMLElement).style.borderColor = CSS.formBorder;
                    }}
                    aria-label={tr('auth.dashboard.address_delete')}
                  >
                    <span className="icon text-[16px]">delete</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1 flex-1">
                <p className="font-display font-bold text-sm" style={{ color: 'var(--color-egrem-black)' }}>
                  {d.firstName} {d.lastName}
                </p>
                {d.phone && (
                  <p className="text-small" style={{ color: CSS.textSecondary }}>
                    {d.phone}
                  </p>
                )}
                {d.addressLine1 && (
                  <p className="font-display font-bold text-sm" style={{ color: 'var(--color-egrem-black)' }}>
                    {d.addressLine1}
                  </p>
                )}
                {d.addressLine2 && (
                  <p className="text-small" style={{ color: CSS.textSecondary }}>
                    {d.addressLine2}
                  </p>
                )}
                <p className="text-small" style={{ color: CSS.textSecondary }}>
                  {d.locality}, {d.administrativeArea}
                  {d.postalCode ? ` · ${d.postalCode}` : ''}
                </p>
                {d.ciPassport && (
                  <p className="text-small" style={{ color: CSS.textSecondary }}>
                    {d.ciPassport}
                  </p>
                )}
                <p className="text-small" style={{ color: CSS.textSecondary }}>
                  {d.countryCode}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
