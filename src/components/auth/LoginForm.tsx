import { useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';

interface Props {
  lang?: Lang;
}

export default function LoginForm({ lang = 'es' }: Props) {
  const tr = useTranslations(lang as Lang);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});

  function validate(): boolean {
    const errs: { username?: string; password?: string } = {};
    if (!username.trim()) {
      errs.username = tr('auth.error.email_required');
    }
    if (!password) {
      errs.password = tr('auth.error.password_required');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || tr('auth.error.generic'));
        return;
      }

      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get('redirect') || '/';
    } catch {
      setError(tr('auth.error.generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {error && (
        <div
          className="rounded-xl px-4 py-3 font-sans text-sm"
          style={{
            backgroundColor: 'var(--color-form-error-bg)',
            color: 'var(--color-form-error)',
            border: '1px solid var(--color-form-error)',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="login-email"
          className="block font-display font-bold text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {tr('auth.login.email')}
        </label>
        <div className="relative">
          <span
            className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span className="icon text-[20px]">person</span>
          </span>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={e => setUsername(e.currentTarget.value)}
            placeholder="Username"
            autoComplete="username"
            aria-invalid={fieldErrors.username ? 'true' : undefined}
            aria-describedby={fieldErrors.username ? 'login-username-error' : undefined}
            className="w-full pl-10 pr-3 py-2.5 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
            style={{
              borderColor: fieldErrors.username
                ? 'var(--color-form-error)'
                : 'var(--color-form-border)',
              color: 'var(--color-egrem-black)',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--color-brand-primary)';
              e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-brand-primary)';
            }}
            onBlur={e => {
              if (!fieldErrors.username) {
                e.currentTarget.style.borderColor = 'var(--color-form-border)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          />
        </div>
        {fieldErrors.username && (
          <p id="login-username-error" className="font-sans text-xs mt-1" style={{ color: 'var(--color-form-error)' }}>
            {fieldErrors.username}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="login-password"
          className="block font-display font-bold text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {tr('auth.login.password')}
        </label>
        <div className="relative">
          <span
            className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span className="icon text-[20px]">lock</span>
          </span>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.currentTarget.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={fieldErrors.password ? 'true' : undefined}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            className="w-full pl-10 pr-3 py-2.5 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
            style={{
              borderColor: fieldErrors.password
                ? 'var(--color-form-error)'
                : 'var(--color-form-border)',
              color: 'var(--color-egrem-black)',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--color-brand-primary)';
              e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-brand-primary)';
            }}
            onBlur={e => {
              if (!fieldErrors.password) {
                e.currentTarget.style.borderColor = 'var(--color-form-border)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          />
        </div>
        <div className="flex justify-end pt-1">
          <a
            href="/recuperar-contrasena"
            className="font-sans text-xs font-semibold no-underline"
            style={{ color: 'var(--color-egrem-gold)' }}
          >
            {tr('auth.login.forgot')}
          </a>
        </div>
        {fieldErrors.password && (
          <p id="login-password-error" className="font-sans text-xs mt-1" style={{ color: 'var(--color-form-error)' }}>
            {fieldErrors.password}
          </p>
        )}
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
            {tr('auth.login.submit')}
            <span className="icon text-[20px]">arrow_forward</span>
          </>
        )}
      </button>

      <div className="pt-5 border-t mt-6 text-center" style={{ borderColor: 'var(--color-form-border)' }}>
        <p className="font-sans text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {tr('auth.login.no_account')}
          {' '}
          <a
            href="/registro"
            className="font-semibold no-underline"
            style={{ color: 'var(--color-brand-primary)' }}
          >
            {tr('auth.login.register_link')}
          </a>
        </p>
      </div>
    </form>
  );
}
