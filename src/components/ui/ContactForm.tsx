import { useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { NhSede, NhTipoConsultaOption } from '@/lib/nodehive';
import {
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH,
  validateContact,
  type ContactField,
  type ContactErrorCode,
} from '@/lib/contacto/validation';

interface Props {
  idPrefix?: string;
  lang?: Lang;
  tipoConsultaOptions?: NhTipoConsultaOption[];
  sede?: NhSede | null;
  className?: string;
  submitLabel?: string;
  /** Valor inicial del select de tipo de consulta (value o label) */
  initialInquiry?: string;
  initialMessage?: string;
}

/**
 * Identificador estable por defecto para "Contratación de artista".
 * Se usa cuando el término de la taxonomía no existe en el backend.
 */
export const ARTIST_BOOKING_FALLBACK: NhTipoConsultaOption = {
  value: 'artist_booking',
  label_es: 'Contratación de artista',
  label_en: 'Artist Booking',
};

const ERROR_KEYS: Record<ContactErrorCode, string> = {
  inquiry_required: 'contacto.form.inquiry_required',
  name_required: 'contacto.form.name_required',
  email_invalid: 'contacto.form.email_invalid',
  message_required: 'contacto.form.message_required',
  message_too_short: 'contacto.form.message_too_short',
  message_too_long: 'contacto.form.message_too_long',
};

const CHAR_WARN_FROM = 450;

type FieldErrors = Partial<Record<ContactField, ContactErrorCode>>;

export default function ContactForm({
  idPrefix = 'page',
  lang = 'es',
  tipoConsultaOptions,
  sede,
  className = '',
  submitLabel,
  initialInquiry,
  initialMessage,
}: Props) {
  const tr = useTranslations(lang as Lang);
  const options = tipoConsultaOptions ?? [
    { value: 'general', label_es: 'Información General', label_en: 'General Information' },
    { value: 'licensing', label_es: 'Licencias Comerciales', label_en: 'Commercial Licensing' },
    { value: 'events', label_es: 'Contratación de Eventos', label_en: 'Event Booking' },
    { value: 'support', label_es: 'Soporte Tienda Online', label_en: 'Online Store Support' },
  ];

  const resolvedOptions = options.some(
    (o) => o.label_es === ARTIST_BOOKING_FALLBACK.label_es || o.label_en === ARTIST_BOOKING_FALLBACK.label_en,
  )
    ? options
    : [...options, ARTIST_BOOKING_FALLBACK];

  function resolveInitialInquiry(): string {
    if (!initialInquiry) return '';
    const match = resolvedOptions.find(
      (o) =>
        o.value === initialInquiry ||
        o.label_es === initialInquiry ||
        o.label_en === initialInquiry,
    );
    if (match) return match.value;
    if (
      initialInquiry === 'artist_booking' ||
      initialInquiry.toLowerCase().includes('artista')
    ) {
      return ARTIST_BOOKING_FALLBACK.value;
    }
    const q = initialInquiry.toLowerCase();
    if (q.includes('entradas') || q.includes('ticket')) {
      const ticketOpt = resolvedOptions.find(
        (o) => o.label_es.toLowerCase().includes('entradas') || o.label_en.toLowerCase().includes('ticket'),
      );
      if (ticketOpt) return ticketOpt.value;
      const normalOpt = resolvedOptions.find(
        (o) => o.label_es.toLowerCase() === 'normal' || o.label_en.toLowerCase() === 'normal',
      );
      if (normalOpt) return normalOpt.value;
    }
    return '';
  }

  const [inquiry, setInquiry] = useState(resolveInitialInquiry());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(initialMessage ?? '');
  const [touched, setTouched] = useState<Record<ContactField, boolean>>({
    inquiry: false,
    name: false,
    email: false,
    message: false,
  });
  const [attempted, setAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverFieldError, setServerFieldError] = useState<{
    field: ContactField;
    message: string;
  } | null>(null);
  const [sent, setSent] = useState(false);

  const errors: FieldErrors = validateContact({ inquiry, name, email, message });

  function showFieldError(field: ContactField): ContactErrorCode | null {
    if (!(attempted || touched[field])) return null;
    return errors[field] ?? null;
  }

  function markTouched(field: ContactField) {
    setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  }

  function clearServerError(field?: ContactField) {
    if (!serverFieldError) return;
    if (!field || serverFieldError.field === field) setServerFieldError(null);
  }

  function hasErrors(): boolean {
    return Object.values(errors).some((code) => Boolean(code));
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setAttempted(true);
    setTouched({ inquiry: true, name: true, email: true, message: true });
    setError('');
    setServerFieldError(null);

    if (hasErrors()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/contacto/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiry,
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          hp: '',
          website: '',
          sede: sede?.title ?? '',
          sede_correo: sede?.correo ?? '',
        }),
      });

      let data: { error?: string; field?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        if (data?.field) {
          const field = data.field as ContactField;
          markTouched(field);
          setServerFieldError({ field, message: data.error || tr('contacto.form.error') });
        } else {
          setError(data?.error || tr('contacto.form.error'));
        }
        return;
      }

      setSent(true);
      setTimeout(() => {
        setSent(false);
        setAttempted(false);
        setInquiry('');
        setName('');
        setEmail('');
        setMessage('');
        setTouched({ inquiry: false, name: false, email: false, message: false });
      }, 2500);
    } catch {
      setError(tr('contacto.form.error'));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full bg-white border border-egrem-gray/30 text-egrem-black font-display text-body rounded-xl p-2 focus:border-egrem-gold focus:ring-1 focus:ring-egrem-gold focus:outline-none transition-colors';
  const inputErrorClass = 'border-egrem-red focus:border-egrem-red focus:ring-egrem-red';

  function fieldErrorText(field: ContactField): string | null {
    const code = showFieldError(field);
    if (code) return tr(ERROR_KEYS[code]);
    if (serverFieldError?.field === field) return serverFieldError.message;
    return null;
  }

  function fieldErrorId(field: ContactField): string | undefined {
    return fieldErrorText(field) ? `${idPrefix}-${field}-error` : undefined;
  }

  function isFieldInvalid(field: ContactField): boolean {
    return Boolean(showFieldError(field)) || serverFieldError?.field === field;
  }

  const disabled = loading || sent || hasErrors();
  const charAtMax = message.length >= MAX_MESSAGE_LENGTH;
  const charWarn = message.length >= CHAR_WARN_FROM;

  return (
    <form onSubmit={handleSubmit} noValidate className={`space-y-4 ${className}`}>
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <input type="text" name="hp" tabIndex={-1} autoComplete="off" defaultValue="" />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="flex flex-col gap-2">
        <label
          className="text-small text-egrem-gray uppercase font-bold"
          htmlFor={`${idPrefix}-inquiry`}
        >
          {tr('contacto.form.inquiry_label')}
        </label>
        <select
          id={`${idPrefix}-inquiry`}
          value={inquiry}
          onChange={(e) => {
            setInquiry(e.target.value);
            markTouched('inquiry');
            clearServerError('inquiry');
          }}
          onBlur={() => markTouched('inquiry')}
          aria-invalid={isFieldInvalid('inquiry')}
          aria-describedby={fieldErrorId('inquiry')}
          className={`${inputClass} appearance-none ${isFieldInvalid('inquiry') ? inputErrorClass : ''}`}
        >
          <option disabled value="">{tr('contacto.form.inquiry_placeholder')}</option>
          {resolvedOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {lang === 'en' ? opt.label_en : opt.label_es}
            </option>
          ))}
        </select>
        {fieldErrorText('inquiry') && (
          <p id={fieldErrorId('inquiry')} className="text-egrem-red text-small">
            {fieldErrorText('inquiry')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label
            className="text-small text-egrem-gray uppercase font-bold"
            htmlFor={`${idPrefix}-name`}
          >
            {tr('contacto.form.name_label')}
          </label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              markTouched('name');
              clearServerError('name');
            }}
            onBlur={() => markTouched('name')}
            placeholder={tr('contacto.form.name_placeholder')}
            aria-invalid={isFieldInvalid('name')}
            aria-describedby={fieldErrorId('name')}
            className={`${inputClass} ${isFieldInvalid('name') ? inputErrorClass : ''}`}
          />
          {fieldErrorText('name') && (
            <p id={fieldErrorId('name')} className="text-egrem-red text-small">
              {fieldErrorText('name')}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-small text-egrem-gray uppercase font-bold"
            htmlFor={`${idPrefix}-email`}
          >
            {tr('contacto.form.email_label')}
          </label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              markTouched('email');
              clearServerError('email');
            }}
            onBlur={() => markTouched('email')}
            placeholder={tr('contacto.form.email_placeholder')}
            aria-invalid={isFieldInvalid('email')}
            aria-describedby={fieldErrorId('email')}
            className={`${inputClass} ${isFieldInvalid('email') ? inputErrorClass : ''}`}
          />
          {fieldErrorText('email') && (
            <p id={fieldErrorId('email')} className="text-egrem-red text-small">
              {fieldErrorText('email')}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          className="text-small text-egrem-gray uppercase font-bold"
          htmlFor={`${idPrefix}-message`}
        >
          {tr('contacto.form.message_label')}
        </label>
        <textarea
          id={`${idPrefix}-message`}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            markTouched('message');
            clearServerError('message');
          }}
          onBlur={() => markTouched('message')}
          placeholder={tr('contacto.form.message_placeholder')}
          rows={6}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-invalid={isFieldInvalid('message')}
          aria-describedby={[fieldErrorId('message'), `${idPrefix}-message-count`]
            .filter(Boolean)
            .join(' ')}
          className={`${inputClass} resize-y ${isFieldInvalid('message') ? inputErrorClass : ''}`}
        />
        <div className="flex items-center justify-between gap-4">
          {fieldErrorText('message') ? (
            <p id={fieldErrorId('message')} className="text-egrem-red text-small">
              {fieldErrorText('message')}
            </p>
          ) : (
            <span />
          )}
          <span
            id={`${idPrefix}-message-count`}
            className={`font-display text-caption tabular-nums shrink-0 ${
              charAtMax
                ? 'text-egrem-red font-bold'
                : charWarn
                  ? 'text-egrem-red'
                  : 'text-egrem-gray'
            }`}
          >
            {charAtMax
              ? tr('contacto.form.char_limit_reached')
              : `${message.length}/${MAX_MESSAGE_LENGTH}`}
          </span>
        </div>
        {!fieldErrorText('message') && !charAtMax && (
          <span className="text-caption text-egrem-gray">
            {tr('contacto.form.message_min_hint', { count: String(MIN_MESSAGE_LENGTH) })}
          </span>
        )}
      </div>

      {error && <p className="text-egrem-red text-small">{error}</p>}

      <div className="pt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className={`font-display text-lg px-8 py-3 rounded-2xl uppercase font-bold tracking-wider transition-all duration-300 shadow-lg w-full md:w-auto disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100 ${
            sent
              ? 'bg-green-600 text-white scale-105'
              : 'bg-egrem-red text-white hover:bg-egrem-red-dark hover:scale-105 active:scale-[0.97]'
          }`}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {submitLabel ?? tr('contacto.form.submit')}
            </span>
          ) : sent ? (
            <span className="inline-flex items-center gap-2">
              <span className="icon text-lg">check</span>
              {tr('contacto.form.success')}
            </span>
          ) : (submitLabel ?? tr('contacto.form.submit'))}
        </button>
        {attempted && hasErrors() && (
          <span className="text-small text-egrem-gray">{tr('contacto.form.complete_fields')}</span>
        )}
      </div>
    </form>
  );
}
