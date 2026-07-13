import { useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import Alert from '@/components/ui/Alert';

interface Props {
  lang?: Lang;
}

export default function RegisterForm({ lang = 'es' }: Props) {
  const tr = useTranslations(lang as Lang);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = tr('auth.error.email_required');
    if (!email.trim()) {
      errs.email = tr('auth.register.error.email_required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = tr('auth.register.error.email_invalid');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || tr('auth.error.generic'));
        return;
      }

      setSuccess(tr('auth.register.success'));
    } catch {
      setError(tr('auth.error.generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <Alert type="success" message={success} />
      <Alert type="error" message={error} />

      <div className="space-y-1.5">
        <label
          htmlFor="reg-username"
          className="block font-display font-bold text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {tr('auth.login.email')}
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="icon text-[20px]">person</span>
          </span>
          <input
            id="reg-username"
            type="text"
            value={username}
            onChange={e => setUsername(e.currentTarget.value)}
            placeholder={tr('auth.login.email')}
            autoComplete="username"
            aria-invalid={fieldErrors.username ? 'true' : undefined}
            className="w-full pl-10 pr-3 py-2.5 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
            style={{
              borderColor: fieldErrors.username ? 'var(--color-form-error)' : 'var(--color-form-border)',
              color: 'var(--color-egrem-black)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand-primary)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-brand-primary)'; }}
            onBlur={e => { if (!fieldErrors.username) { e.currentTarget.style.borderColor = 'var(--color-form-border)'; e.currentTarget.style.boxShadow = 'none'; } }}
          />
        </div>
        {fieldErrors.username && (
          <p className="font-sans text-xs mt-1" style={{ color: 'var(--color-form-error)' }}>{fieldErrors.username}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="reg-email"
          className="block font-display font-bold text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {tr('auth.register.email')}
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="icon text-[20px]">mail</span>
          </span>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.currentTarget.value)}
            placeholder={tr('auth.register.email_placeholder')}
            autoComplete="email"
            aria-invalid={fieldErrors.email ? 'true' : undefined}
            className="w-full pl-10 pr-3 py-2.5 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
            style={{
              borderColor: fieldErrors.email ? 'var(--color-form-error)' : 'var(--color-form-border)',
              color: 'var(--color-egrem-black)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand-primary)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-brand-primary)'; }}
            onBlur={e => { if (!fieldErrors.email) { e.currentTarget.style.borderColor = 'var(--color-form-border)'; e.currentTarget.style.boxShadow = 'none'; } }}
          />
        </div>
        {fieldErrors.email && (
          <p className="font-sans text-xs mt-1" style={{ color: 'var(--color-form-error)' }}>{fieldErrors.email}</p>
        )}
      </div>

      <div
        className="rounded-xl px-4 py-3 font-sans text-sm flex items-center gap-2"
        style={{
          backgroundColor: 'var(--color-surface-container)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span className="icon text-xl shrink-0">mail</span>
        <span>{tr('auth.register.passwordless_note')}</span>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary mt-2"
        style={{ opacity: loading ? 0.7 : 1 }}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            {tr('auth.register.submit')}
            <span className="icon text-[20px]">person_add</span>
          </>
        )}
      </button>

      <div className="pt-5 border-t mt-6 text-center" style={{ borderColor: 'var(--color-form-border)' }}>
        <p className="font-sans text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {tr('auth.register.has_account')}
          {' '}
          <a
            href="/login"
            className="font-semibold no-underline"
            style={{ color: 'var(--color-brand-primary)' }}
          >
            {tr('auth.register.login_link')}
          </a>
        </p>
      </div>
    </form>
  );
}
