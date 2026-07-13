import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import Alert from '@/components/ui/Alert';

interface Props {
  lang?: Lang;
}

const CSS = {
  formBorder: 'var(--color-form-border)',
  textSecondary: 'var(--color-text-secondary)',
  brandPrimary: 'var(--color-brand-primary)',
  egremBlack: 'var(--color-egrem-black)',
  egremGold: 'var(--color-egrem-gold)',
  surfaceContainer: 'var(--color-surface-container)',
};

export default function EditProfileForm({ lang = 'es' }: Props) {
  const tr = useTranslations(lang as Lang);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          const parts = (data.name ?? '').split(' ');
          setFirstName(parts[0] ?? '');
          setLastName(parts.slice(1).join(' ') ?? '');
          setEmail(data.mail ?? '');
        }
      } catch {} finally {
        setFetching(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const body: Record<string, string> = {
        displayName: `${firstName.trim()} ${lastName.trim()}`,
      };
      if (password) {
        body.newPassword = password;
      }

      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || tr('auth.dashboard.error'));
        return;
      }

      setSuccess(tr('auth.dashboard.success'));
      setPassword('');
    } catch {
      setError(tr('auth.dashboard.error'));
    } finally {
      setLoading(false);
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
        <h3
          className="text-h2 uppercase m-0 border-l-4 pl-4"
          style={{ borderColor: CSS.egremGold }}
        >
          {tr('auth.dashboard.personal_info')}
        </h3>
        <p className="text-small mt-2" style={{ color: CSS.textSecondary }}>
          {tr('auth.dashboard.personal_info_desc')}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border rounded-xl p-6 shadow-sm" style={{ borderColor: CSS.formBorder }}>
          <h4 className="text-h3 m-0 pb-2 mb-6 flex items-center gap-2 border-b" style={{ borderColor: CSS.formBorder }}>
            <span className="icon text-[20px]" style={{ color: CSS.egremGold }}>manage_accounts</span>
            {tr('auth.dashboard.account_data')}
          </h4>

          <Alert type="success" message={success} />
          <Alert type="error" message={error} />

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
                  {tr('auth.dashboard.first_name')}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.currentTarget.value)}
                  className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
                  style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
                />
              </div>
              <div className="space-y-2">
                <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
                  {tr('auth.dashboard.last_name')}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.currentTarget.value)}
                  className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
                  style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
                {tr('auth.dashboard.email')}
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3 py-3 rounded-xl border outline-none font-sans text-sm cursor-not-allowed"
                style={{ borderColor: CSS.formBorder, background: CSS.surfaceContainer, color: CSS.textSecondary }}
              />
              <p className="font-sans text-xs mt-1" style={{ color: CSS.textSecondary }}>
                {tr('auth.dashboard.email_locked')}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block font-display font-bold text-[11px] uppercase tracking-wider" style={{ color: CSS.textSecondary }}>
                {tr('auth.dashboard.new_password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.currentTarget.value)}
                placeholder={tr('auth.dashboard.new_password_placeholder')}
                className="w-full px-3 py-3 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
                style={{ borderColor: CSS.formBorder, color: CSS.egremBlack }}
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  tr('auth.dashboard.save')
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white border rounded-xl p-6 shadow-sm relative overflow-hidden" style={{ borderColor: CSS.formBorder }}>
            <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10" style={{ background: CSS.egremGold }} />
            <h4 className="text-h4 m-0 mb-4 relative" style={{ zIndex: 1 }}>
              {tr('auth.dashboard.last_purchase')}
            </h4>
            <p className="text-small" style={{ color: CSS.textSecondary, zIndex: 1, position: 'relative' }}>
              {tr('auth.dashboard.last_purchase_desc')}
            </p>
          </div>

          <div className="rounded-xl p-6 shadow-sm" style={{ background: CSS.brandPrimary }}>
            <h4 className="text-h4 text-white m-0 mb-4 flex items-center gap-2">
              <span className="icon text-[20px]">confirmation_number</span>
              {tr('auth.dashboard.next_event')}
            </h4>
            <p className="text-small text-white/80">
              {tr('auth.dashboard.next_event_desc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
