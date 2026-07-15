import type { PasswordStrength } from '@/utils/passwordValidation';

interface Props {
  strength: PasswordStrength;
}

const config: Record<PasswordStrength, { label: string; color: string; width: string }> = {
  weak:    { label: 'Débil',       color: 'var(--color-form-error)', width: '33%' },
  medium:  { label: 'Media',       color: 'var(--color-egrem-gold)', width: '66%' },
  strong:  { label: 'Fuerte',      color: '#16a34a',                width: '100%' },
};

export default function PasswordStrengthBar({ strength }: Props) {
  const c = config[strength];
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full rounded-full bg-[var(--color-form-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: c.width, backgroundColor: c.color }}
        />
      </div>
      <p className="font-sans text-xs mt-1" style={{ color: c.color }}>
        {c.label}
      </p>
    </div>
  );
}
