import { useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';

interface Props {
  lang?: Lang;
}

export default function ForgotPasswordForm({ lang = 'es' }: Props) {
  const tr = useTranslations(lang as Lang);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError(tr('auth.forgotPassword.error_empty'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(tr('auth.forgotPassword.error_invalid_email'));
      return;
    }

    setLoading(true);
    try {
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const emailCheck = await checkRes.json();

      if (!checkRes.ok) {
        setError(emailCheck.error || tr('auth.forgotPassword.error_server'));
        return;
      }

      if (!emailCheck.exists) {
        setError(tr('auth.forgotPassword.error_not_found'));
        return;
      }

      setLoading(true);

      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || tr('auth.forgotPassword.error_server'));
        return;
      }

      setSent(true);
    } catch {
      setError(tr('auth.forgotPassword.error_server'));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-white border rounded-xl p-6 text-center" style={{ borderColor: 'var(--color-form-border)' }}>
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="icon text-3xl text-green-600 icon-filled">mark_email_read</span>
        </div>
        <h2 className="text-h3 uppercase text-green-700 mb-2">
          {tr('auth.forgotPassword.success_title')}
        </h2>
        <p className="font-sans text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          {tr('auth.forgotPassword.success_desc')}{' '}
          <strong className="text-[var(--color-egrem-black)]">{email}</strong>
        </p>
        <div className="rounded-md p-3 mb-4 text-left text-sm" style={{ backgroundColor: 'var(--color-surface-container)' }}>
          <p className="flex items-center gap-1.5 font-sans text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="icon text-sm">schedule</span>
            {' '}{tr('auth.forgotPassword.expiry_note')}
          </p>
          <p className="flex items-center gap-1.5 font-sans text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="icon text-sm">info</span>
            {' '}{tr('auth.forgotPassword.spam_note')}
          </p>
        </div>
        <a href="/login" className="btn-primary no-underline">
          {tr('auth.forgotPassword.back_to_login')}
        </a>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {error && (
        <div
          className="rounded-xl px-4 py-3 font-sans text-sm flex items-center gap-2"
          style={{
            backgroundColor: 'var(--color-form-error-bg)',
            color: 'var(--color-form-error)',
            border: '1px solid var(--color-form-error)',
          }}
          role="alert"
        >
          <span className="icon text-xl shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="fp-email"
          className="block font-display font-bold text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {tr('auth.forgotPassword.email')}
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="icon text-[20px]">mail</span>
          </span>
          <input
            id="fp-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.currentTarget.value)}
            placeholder={tr('auth.forgotPassword.email_placeholder')}
            autoComplete="email"
            className="w-full pl-10 pr-3 py-2.5 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
            style={{
              borderColor: error ? 'var(--color-form-error)' : 'var(--color-form-border)',
              color: 'var(--color-egrem-black)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand-primary)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-brand-primary)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-form-border)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
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
            {tr('auth.forgotPassword.submit')}
            <span className="icon text-[20px]">arrow_forward</span>
          </>
        )}
      </button>

      <div className="pt-5 border-t mt-6 text-center" style={{ borderColor: 'var(--color-form-border)' }}>
        <p className="font-sans text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <a
            href="/login"
            className="font-semibold no-underline"
            style={{ color: 'var(--color-brand-primary)' }}
          >
            {tr('auth.forgotPassword.back_to_login')}
          </a>
        </p>
      </div>
    </form>
  );
}
