import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import { isValidPassword, getPasswordStrength } from '@/utils/passwordValidation';
import type { PasswordStrength } from '@/utils/passwordValidation';
import PasswordStrengthBar from '@/components/ui/PasswordStrengthBar';

interface Props {
  lang?: Lang;
  uid: string;
  timestamp: string;
  hash: string;
}

type PageState = 'validating' | 'invalid' | 'form' | 'success';

export default function SetPasswordForm({ lang = 'es', uid, timestamp, hash }: Props) {
  const tr = useTranslations(lang as Lang);
  const [pageState, setPageState] = useState<PageState>('validating');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [strength, setStrength] = useState<PasswordStrength>('weak');
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch(`/api/auth/validate-reset-link?uid=${encodeURIComponent(uid)}&timestamp=${encodeURIComponent(timestamp)}&hash=${encodeURIComponent(hash)}`);
        const data = await res.json();
        if (data?.valid === true) {
          setPageState('form');
        } else {
          setPageState('invalid');
        }
      } catch {
        setPageState('invalid');
      }
    }
    validate();
  }, [uid, timestamp, hash]);

  useEffect(() => {
    if (password) {
      setStrength(getPasswordStrength(password));
    }
  }, [password]);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');

    if (!isValidPassword(password)) {
      setError(tr('auth.setPassword.error_weak'));
      return;
    }
    if (password !== confirm) {
      setError(tr('auth.setPassword.error_mismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, timestamp, hash, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || tr('auth.setPassword.error_server'));
        return;
      }

      if (data.requiresLogin) {
        setRequiresLogin(true);
      }
      setPageState('success');
    } catch {
      setError(tr('auth.setPassword.error_server'));
    } finally {
      setLoading(false);
    }
  }

  if (pageState === 'validating') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <span className="inline-block w-8 h-8 border-2 border-[var(--color-brand-primary)]/30 border-t-[var(--color-brand-primary)] rounded-full animate-spin mb-3" />
          <p className="font-sans text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {tr('auth.setPassword.validating')}
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid') {
    return (
      <div className="bg-white border rounded-xl p-6 text-center" style={{ borderColor: 'var(--color-form-border)' }}>
        <div className="w-16 h-16 rounded-full bg-[var(--color-form-error-bg)] flex items-center justify-center mx-auto mb-4">
          <span className="icon text-3xl" style={{ color: 'var(--color-form-error)' }}>link_off</span>
        </div>
        <h2 className="text-h3 uppercase mb-2" style={{ color: 'var(--color-form-error)' }}>
          {tr('auth.setPassword.link_expired')}
        </h2>
        <p className="font-sans text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          {tr('auth.setPassword.link_expired_desc')}
        </p>
        <a href="/recuperar-contrasena" className="btn-primary no-underline mb-3">
          {tr('auth.setPassword.link_expired_cta')}
        </a>
        <p className="font-sans text-sm mt-4">
          <a href="/login" className="font-semibold no-underline" style={{ color: 'var(--color-brand-primary)' }}>
            {tr('auth.setPassword.back_to_login')}
          </a>
        </p>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="bg-white border rounded-xl p-6 text-center" style={{ borderColor: 'var(--color-form-border)' }}>
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="icon text-3xl text-green-600 icon-filled">check_circle</span>
        </div>
        <h2 className="text-h3 uppercase text-green-700 mb-2">
          {tr('auth.setPassword.success_title')}
        </h2>
        <p className="font-sans text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          {requiresLogin ? tr('auth.setPassword.success_manual') : tr('auth.setPassword.success_generic')}
        </p>
        {requiresLogin ? (
          <a href="/login" className="btn-primary no-underline">
            {tr('auth.setPassword.back_to_login')}
          </a>
        ) : (
          <a href="/mi-cuenta" className="btn-primary no-underline">
            {tr('auth.setPassword.go_dashboard')}
          </a>
        )}
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
          htmlFor="sp-password"
          className="block font-display font-bold text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {tr('auth.setPassword.password')}
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="icon text-[20px]">lock</span>
          </span>
          <input
            id="sp-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.currentTarget.value)}
            placeholder={tr('auth.setPassword.password_placeholder')}
            autoComplete="new-password"
            className="w-full pl-10 pr-3 py-2.5 bg-white rounded-xl border outline-none transition-colors font-sans text-sm"
            style={{
              borderColor: error ? 'var(--color-form-error)' : 'var(--color-form-border)',
              color: 'var(--color-egrem-black)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand-primary)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-brand-primary)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-form-border)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
        {password && <PasswordStrengthBar strength={strength} />}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="sp-confirm"
          className="block font-display font-bold text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {tr('auth.setPassword.confirm')}
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="icon text-[20px]">lock</span>
          </span>
          <input
            id="sp-confirm"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.currentTarget.value)}
            placeholder={tr('auth.setPassword.confirm_placeholder')}
            autoComplete="new-password"
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
            {tr('auth.setPassword.submit')}
            <span className="icon text-[20px]">arrow_forward</span>
          </>
        )}
      </button>
    </form>
  );
}
