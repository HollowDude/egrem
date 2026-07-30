import { useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { NhTipoConsultaOption } from '@/lib/nodehive';

interface Props {
  idPrefix?: string;
  lang?: Lang;
  tipoConsultaOptions?: NhTipoConsultaOption[];
  onSuccess?: () => void;
  className?: string;
  submitLabel?: string;
}

export default function ContactForm({
  idPrefix = 'page',
  lang = 'es',
  tipoConsultaOptions,
  onSuccess,
  className = '',
  submitLabel,
}: Props) {
  const tr = useTranslations(lang as Lang);
  const options = tipoConsultaOptions ?? [
    { value: 'general', label_es: 'Información General', label_en: 'General Information' },
    { value: 'licensing', label_es: 'Licencias Comerciales', label_en: 'Commercial Licensing' },
    { value: 'events', label_es: 'Contratación de Eventos', label_en: 'Event Booking' },
    { value: 'support', label_es: 'Soporte Tienda Online', label_en: 'Online Store Support' },
  ];

  const [inquiry, setInquiry] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!inquiry) { setError(tr('contacto.form.inquiry_placeholder') || 'Seleccione una opción'); return; }

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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || tr('contacto.form.error'));
        return;
      }

      setSuccess(true);
      setInquiry('');
      setName('');
      setEmail('');
      setMessage('');
      onSuccess?.();
    } catch {
      setError(tr('contacto.form.error'));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full bg-white border border-egrem-gray text-egrem-black rounded-xl p-2 focus:border-egrem-red focus:ring-1 focus:ring-egrem-red focus:outline-none transition-colors';

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
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
          onChange={(e) => setInquiry(e.target.value)}
          className={`${inputClass} appearance-none`}
        >
          <option disabled value="">{tr('contacto.form.inquiry_placeholder')}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {lang === 'en' ? opt.label_en : opt.label_es}
            </option>
          ))}
        </select>
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
            onChange={(e) => setName(e.target.value)}
            placeholder={tr('contacto.form.name_placeholder')}
            className={inputClass}
          />
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
            onChange={(e) => setEmail(e.target.value)}
            placeholder={tr('contacto.form.email_placeholder')}
            className={inputClass}
          />
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
          onChange={(e) => setMessage(e.target.value)}
          placeholder={tr('contacto.form.message_placeholder')}
          rows={6}
          className={`${inputClass} resize-y`}
        />
      </div>

      {error && (
        <p className="text-egrem-red text-small">{error}</p>
      )}

      {success && (
        <p className="text-green-600 text-small">{tr('contacto.form.success')}</p>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-egrem-red text-white font-display text-lg px-8 py-3 rounded-2xl uppercase font-bold tracking-wider hover:bg-egrem-red-dark hover:scale-105 active:scale-[0.97] transition-all duration-300 shadow-lg w-full md:w-auto disabled:opacity-50"
        >
          {loading ? '...' : (submitLabel ?? tr('contacto.form.submit'))}
        </button>
      </div>
    </form>
  );
}
