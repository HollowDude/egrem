import { useEffect, useState } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';

type CartAddedDetail = {
  title?: string;
  variation?: string | null;
  quantity?: number;
  count?: number;
};

export default function CartToast({ lang = 'es' }: { lang?: Lang }) {
  const tr = useTranslations(lang);
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState<CartAddedDetail | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const onAdded = (e: Event) => {
      const d = (e as CustomEvent<CartAddedDetail>).detail;
      setDetail(d);
      setVisible(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), 3200);
    };
    window.addEventListener('cart:added', onAdded as EventListener);
    return () => {
      window.removeEventListener('cart:added', onAdded as EventListener);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-3 bg-egrem-dark text-white px-4 py-3 rounded-2xl shadow-2xl max-w-[90vw]">
        <span className="icon text-egrem-gold text-[22px]" aria-hidden="true">
          check_circle
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-display font-bold text-[14px] uppercase tracking-wide">
            {detail?.title ?? tr('tienda.product.agregado')}
          </span>
          {detail?.variation && (
            <span className="font-display text-[12px] text-egrem-gray">{detail.variation}</span>
          )}
          {typeof detail?.count === 'number' && (
            <span className="font-display text-[11px] text-egrem-gold">
              {tr('tienda.cart.count', { count: detail.count })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
