/**
 * Formato de precio único para todo el sitio ($99, $12.50).
 * Sin decimales forzados: los ceros ".00" se recortan.
 */
export function formatPrecio(value: number, lang = 'es'): string {
  const formatted = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-CU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `$${formatted}`;
}
