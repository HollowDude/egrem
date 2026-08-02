import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { NhTipoConsultaOption, NhSede } from '@/lib/nodehive';
import ContactForm from './ContactForm';

interface Props {
  open?: boolean;
  onClose?: () => void;
  lang?: Lang;
  variant?: 'full' | 'form-only';
  tipoConsultaOptions?: NhTipoConsultaOption[];
  sede?: NhSede | null;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return iso;
  }
}

export default function ContactModal({
  open: controlledOpen,
  onClose: controlledOnClose,
  lang = 'es',
  variant: defaultVariant = 'full',
  tipoConsultaOptions,
  sede,
}: Props) {
  const tr = useTranslations(lang as Lang);
  const [internalOpen, setInternalOpen] = useState(false);
  const [variant, setVariant] = useState<'full' | 'form-only'>(defaultVariant);
  const [show, setShow] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function close() {
    if (isControlled) {
      controlledOnClose?.();
    } else {
      setInternalOpen(false);
    }
  }

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setShow(true));
    } else {
      setShow(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.variant) setVariant(detail.variant);
      else setVariant(defaultVariant);
      if (!isControlled) setInternalOpen(true);
    }
    window.addEventListener('open-contact-modal', handler);
    return () => window.removeEventListener('open-contact-modal', handler);
  }, [isControlled, defaultVariant]);

  if (!open) return null;

  const title = tr('contacto.hero.title');
  const subtitle = tr('contacto.hero.subtitle');
  const dir = sede?.direccion;
  const address = dir
    ? [dir.address_line1, dir.locality, dir.administrative_area, dir.country_code].filter(Boolean).join(', ')
    : 'Calle 3ra No. 1008 e/ 10 y 12, Miramar, Playa, La Habana, Cuba';
  const phones = sede?.telefono?.length
    ? sede.telefono.map((p) => p.phone_number).filter(Boolean)
    : ['+53 7 204 9822', '+53 7 204 9823'];
  const email = sede?.correo || 'info@egrem.co.cu';
  const horarioDisplay = sede?.horario
    ? `${formatTime(sede.horario.value)} – ${formatTime(sede.horario.end_value)}`
    : null;

  return (
    <>
      <div
        onClick={close}
        role="presentation"
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: show ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          opacity: show ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
      >
        <div
          className="bg-white w-full max-w-[1000px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative flex flex-col"
          style={{
            transform: show ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
            transition: 'transform 200ms ease-out',
          }}
        >
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 text-egrem-black hover:text-egrem-red transition-colors z-10 bg-transparent border-none cursor-pointer"
            aria-label="Cerrar"
          >
            <span className="icon text-3xl">close</span>
          </button>

          <div className="p-8 border-b border-egrem-gray/20">
            <h1 className="text-h1 text-egrem-black uppercase font-bold mb-2 border-b-4 border-egrem-red pb-2 inline-block">
              {title}
            </h1>
            <p className="text-body text-egrem-gray max-w-2xl">
              {subtitle}
            </p>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7">
                <h2 className="text-h2 text-egrem-black uppercase font-bold mb-6">
                  {tr('contacto.form.title')}
                </h2>
                <ContactForm
                  idPrefix="modal"
                  lang={lang}
                  tipoConsultaOptions={tipoConsultaOptions}
                />
              </div>

              {variant === 'full' && (
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <h2 className="text-h2 text-egrem-black uppercase font-bold border-b-4 border-egrem-gold pb-2 inline-block">
                    {tr('contacto.info.title')}
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <span className="icon icon-filled text-egrem-red text-2xl shrink-0">location_on</span>
                      <div>
                        <h3 className="text-small text-egrem-gray uppercase font-bold">{tr('contacto.info.sede_label')}</h3>
                        <p className="text-body text-egrem-black">{address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <span className="icon icon-filled text-egrem-red text-2xl shrink-0">call</span>
                      <div>
                        <h3 className="text-small text-egrem-gray uppercase font-bold">{tr('contacto.info.phone_label')}</h3>
                        {phones.map((p, i) => (
                          <p key={i} className="text-body text-egrem-black">{p}</p>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <span className="icon icon-filled text-egrem-red text-2xl shrink-0">mail</span>
                      <div>
                        <h3 className="text-small text-egrem-gray uppercase font-bold">{tr('contacto.info.email_label')}</h3>
                        <a href={`mailto:${email}`} className="text-body text-egrem-red no-underline hover:underline">
                          {email}
                        </a>
                      </div>
                    </div>
                    {horarioDisplay && (
                      <div className="flex items-start gap-4">
                        <span className="icon icon-filled text-egrem-red text-2xl shrink-0">schedule</span>
                        <div>
                          <h3 className="text-small text-egrem-gray uppercase font-bold">{tr('contacto.info.hours_label')}</h3>
                          <p className="text-body text-egrem-black">{horarioDisplay}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
