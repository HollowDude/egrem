export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'outline-red';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-1.5 text-xs',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3 text-lg',
  xl: 'px-10 py-4 text-xl',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-egrem-red text-white border border-transparent hover:bg-egrem-red-dark shadow-lg hover:scale-105 active:scale-[0.97]',
  secondary:
    'bg-white border-2 border-egrem-gold text-egrem-gold hover:bg-egrem-gold hover:text-white shadow-lg hover:scale-105 active:scale-[0.97]',
  ghost:
    'bg-transparent text-egrem-black border border-egrem-black hover:bg-egrem-black hover:text-white',
  gold: 'bg-egrem-gold text-white border border-transparent hover:opacity-90 hover:scale-105 shadow-lg active:scale-[0.97]',
  'outline-red':
    'bg-transparent text-egrem-red border border-egrem-red hover:bg-egrem-red hover:text-white active:scale-[0.97]',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = '',
): string {
  return [
    'inline-flex items-center justify-center gap-2',
    'font-display font-bold tracking-wide uppercase',
    'rounded-2xl transition-all duration-300 cursor-pointer no-underline',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-egrem-red',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    sizeClasses[size],
    variantClasses[variant],
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}
