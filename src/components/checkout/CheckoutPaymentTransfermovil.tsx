import { useEffect, useState, useRef } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { CheckoutOrderDetail, TransfermovilQR, PlaceResult } from '@/lib/nodehive/checkout';
import { formatPrecio } from '@/lib/moneda';
import Alert from '@/components/ui/Alert';
import QRCode from 'qrcode';

interface Props {
  order: CheckoutOrderDetail;
  cartGroup: string | null;
  subtotal: number;
  lang?: Lang;
  onBack: (step: 'billing' | 'shipping' | 'payment_method') => void;
  onPlaced: (result: PlaceResult) => void;
}

export default function CheckoutPaymentTransfermovil({ order, cartGroup, subtotal, lang = 'es', onBack, onPlaced }: Props) {
  const tr = useTranslations(lang);
  const [qr, setQr] = useState<TransfermovilQR | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'polling' | 'placing' | 'error'>('loading');
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const pollRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Crear QR al montar
  useEffect(() => {
    let cancelled = false;
    async function create() {
      setPhase('loading');
      setError('');
      try {
        const res = await fetch('/api/checkout/transfermovil/create', { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || 'No se pudo crear el QR.');
        if (cancelled) return;
        setQr(data as TransfermovilQR);
        setPhase('ready');
      } catch (e) {
        const msg = String((e as Error).message ?? '');
        // Si es 502/500 por pasarela no configurada, mostrar opción de cambiar a efectivo
        if (msg.includes('Transfermóvil') || msg.includes('500') || msg.includes('502')) {
          setError('El pago con Transfermóvil no está disponible en este momento. Prueba con Efectivo.');
        } else {
          setError(msg || 'No se pudo generar el QR.');
        }
        setPhase('error');
      }
    }
    create();
    return () => { cancelled = true; };
  }, []);

  // Polling
  useEffect(() => {
    if (phase !== 'ready' && phase !== 'polling') return;
    if (!qr) return;
    setPhase('polling');
    const id = window.setInterval(async () => {
      try {
        const res = await fetch('/api/checkout/transfermovil/status');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const paid = (data as { paid?: boolean }).paid;
        if (paid) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
          setPhase('placing');
          try {
            const placeRes = await fetch('/api/checkout/place', { method: 'POST' });
            const placeData = await placeRes.json().catch(() => ({}));
            if (!placeRes.ok) throw new Error((placeData as { error?: string }).error || 'No se pudo colocar el pedido.');
            try { sessionStorage.removeItem('egrem_checkout_snapshot'); } catch {}
            onPlaced((placeData.result ?? placeData) as PlaceResult);
          } catch (e) {
            setError(String((e as Error).message ?? 'Pago confirmado pero no se pudo colocar el pedido. Reintenta.'));
            setPhase('error');
          }
        }
      } catch {}
    }, 4500);
    pollRef.current = id;
    // Timeout 10 min
    timeoutRef.current = window.setTimeout(() => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      setShowManual(true);
    }, 10 * 60 * 1000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [phase, qr]);

  async function handleManualCheck() {
    try {
      const res = await fetch('/api/checkout/transfermovil/status');
      const data = await res.json().catch(() => ({}));
      if ((data as { paid?: boolean }).paid) {
        const placeRes = await fetch('/api/checkout/place', { method: 'POST' });
        const placeData = await placeRes.json().catch(() => ({}));
        if (!placeRes.ok) throw new Error((placeData as { error?: string }).error || 'Error al colocar.');
        onPlaced((placeData.result ?? placeData) as PlaceResult);
      } else {
        setError('Aún no se detecta el pago. Verifica en Transfermóvil e intenta de nuevo.');
      }
    } catch (e) {
      setError(String((e as Error).message ?? 'No se pudo verificar.'));
    }
  }

  async function handleChangeToEfectivo() {
    try {
      const res = await fetch(`/api/checkout/${order.orderId}/payment-method`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: 'efectivo' }),
      });
      if (!res.ok) throw new Error('No se pudo cambiar a efectivo.');
      window.location.reload();
    } catch (e) {
      setError(String((e as Error).message ?? 'No se pudo cambiar.'));
    }
  }

  const billing = order.billingProfile;

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Generar QR client-side si qr es texto/JSON
  useEffect(() => {
    if (!qr) return;
    const raw = (qr.qrText || qr.qr || '').trim();
    if (!raw) return;
    // Si ya es data:image o http, usar directo
    if (raw.startsWith('data:image') || raw.startsWith('http')) {
      setQrDataUrl(raw);
      return;
    }
    // Si es base64 puro de imagen (iVBOR), convertir
    if (raw.startsWith('iVBOR') && raw.length > 100 && !raw.includes('{')) {
      setQrDataUrl(`data:image/png;base64,${raw}`);
      return;
    }
    // QR debe codificar el JSON {"id_transaccion":...,"importe":...} tal cual lo espera Transfermóvil
    // qr.qrText / qr.qr ya es ese JSON (ej: {"id_transaccion":"202609021558",...}), no el transfermovil:// URL
    const textToEncode = raw;
    QRCode.toDataURL(textToEncode, { width: 256, margin: 1 })
      .then((url: string) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [qr]);

  // Determinar src de QR (usa qrDataUrl generado)
  const qrSrc = qrDataUrl;

  return (
    <div>
      <div className="checkout-panel-header">
        <span className="icon text-[20px]" style={{ color: 'var(--color-brand-primary)' }}>qr_code_2</span>
        <h3 className="font-display font-bold text-h4 uppercase m-0">{tr('checkout.pago.paso_pago')} — Transfermóvil</h3>
      </div>
      <div className="checkout-panel-body space-y-6">
        <Alert type="error" message={error} />
        {phase === 'loading' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <span className="inline-block w-8 h-8 border-2 border-[var(--color-brand-primary)]/30 border-t-[var(--color-brand-primary)] rounded-full animate-spin" />
            <p className="text-small" style={{ color: 'var(--color-text-secondary)' }}>Generando QR...</p>
          </div>
        )}
        {phase === 'error' && !qr && (
          <div className="text-center py-6 space-y-3">
            <p className="text-small" style={{ color: 'var(--color-text-secondary)' }}>{error || 'No se pudo generar el QR.'}</p>
            <button type="button" onClick={handleChangeToEfectivo} className="btn-primary" style={{ width: 'auto' } as React.CSSProperties}>Cambiar a Efectivo</button>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => onBack('payment_method')} className="text-caption font-bold uppercase" style={{ color: 'var(--color-brand-primary)' }}>{tr('checkout.pago.cambiar')}</button>
            </div>
          </div>
        )}
        {qr && (
          <>
            <div className="flex flex-col items-center gap-4">
              {qrSrc ? <img src={qrSrc} alt="QR Transfermóvil" className="w-64 h-64 border rounded-xl p-2 bg-white" style={{ borderColor: 'var(--color-form-border)' }} /> : <div className="w-64 h-64 border rounded-xl flex items-center justify-center p-4 bg-white" style={{ borderColor: 'var(--color-form-border)' }}><p className="text-small break-all text-center" style={{ color: 'var(--color-text-secondary)' }}>{qr.qrText || qr.qr}</p></div>}
              <p className="text-small font-bold" style={{ color: 'var(--color-egrem-black)' }}>{formatPrecio(qr.total, lang)} {qr.currency}</p>
              <div className="text-caption text-center" style={{ color: 'var(--color-text-secondary)' }}>
                {qr.orders.map((o) => (
                  <div key={o.orderId}>Pedido #{o.orderId} — {o.storeLabel}</div>
                ))}
              </div>
              {qr.url && <a href={qr.url} target="_blank" rel="noopener noreferrer" className="text-small font-bold underline" style={{ color: 'var(--color-brand-primary)' }}>Abrir en Transfermóvil</a>}
            </div>

            <div className="border rounded-xl p-4 bg-amber-50" style={{ borderColor: 'rgba(204,153,51,0.3)' }}>
              <p className="text-small flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                <span className={`inline-block w-3 h-3 rounded-full ${phase === 'polling' ? 'bg-amber-500 animate-pulse' : 'bg-gray-300'}`} />
                Esperando confirmación de pago… {phase === 'polling' && <span className="icon text-[16px] animate-spin">progress_activity</span>}
              </p>
              <p className="text-caption mt-1" style={{ color: 'var(--color-text-secondary)' }}>Escanea el QR con Transfermóvil y confirma el pago. La confirmación es automática.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button type="button" onClick={handleManualCheck} className="px-6 py-3 rounded-xl border font-display font-bold text-sm uppercase tracking-wider" style={{ borderColor: 'var(--color-form-border)', color: 'var(--color-text-secondary)' }}>Ya pagué, verificar ahora</button>
              <button type="button" onClick={handleChangeToEfectivo} className="text-caption font-bold uppercase" style={{ color: 'var(--color-brand-primary)' }}>Cambiar a Efectivo</button>
            </div>
            {showManual && (
              <div className="text-center">
                <p className="text-small" style={{ color: 'var(--color-text-secondary)' }}>¿Sigues ahí? Si el QR expiró, genera uno nuevo.</p>
                <button type="button" onClick={() => window.location.reload()} className="text-small font-bold underline" style={{ color: 'var(--color-brand-primary)' }}>Generar nuevo QR</button>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t" style={{ borderColor: 'var(--color-form-border)' }}>
              <button type="button" onClick={() => onBack('payment_method')} className="text-caption font-bold uppercase" style={{ color: 'var(--color-brand-primary)' }}>{tr('checkout.pago.cambiar')}</button>
              <span className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>Pedido #{order.orderId}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
