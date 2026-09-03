import type { Lang } from '@/i18n';
import type { CheckoutOrderDetail, PlaceResult } from '@/lib/nodehive/checkout';
import CheckoutPaymentEfectivo from './CheckoutPaymentEfectivo';
import CheckoutPaymentTransfermovil from './CheckoutPaymentTransfermovil';

interface Props {
  order: CheckoutOrderDetail;
  orderIds: number[];
  cartGroup: string | null;
  lang?: Lang;
  snapshot: Record<string, unknown> | null;
  onBack: (step: 'billing' | 'shipping' | 'payment_method') => void;
  onPlaced: (result: PlaceResult) => void;
}

export default function CheckoutPaymentStep(props: Props) {
  const { order, snapshot } = props;
  const subtotal = (() => {
    if (snapshot && typeof (snapshot as { subtotal?: number }).subtotal === 'number') return (snapshot as { subtotal: number }).subtotal;
    return order.items.reduce((a, it) => a + (it.unitPrice ?? 0) * it.quantity, 0);
  })();
  if (order.paymentMethod === 'transfermovil') {
    return <CheckoutPaymentTransfermovil {...props} subtotal={subtotal} />;
  }
  return <CheckoutPaymentEfectivo {...props} subtotal={subtotal} />;
}
