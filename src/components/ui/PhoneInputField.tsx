import { useState } from 'react';
import PhoneInput from 'react-phone-number-input';
import type { Value } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

interface Props {
  value: string;
  onChange: (value?: Value) => void;
  error?: string;
  placeholder?: string;
  label: string;
  id: string;
}

export default function PhoneInputField({ value, onChange, error, placeholder, label, id }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block font-display font-bold text-[11px] uppercase tracking-wider"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </label>
      <PhoneInput
        id={id}
        defaultCountry="CU"
        international
        value={value || undefined}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoComplete="tel"
        className="flex items-center w-full bg-white rounded-xl border outline-none transition-colors font-sans text-sm pl-3 gap-0"
        style={{
          borderColor: error ? 'var(--color-form-error)' : focused ? 'var(--color-brand-primary)' : 'var(--color-form-border)',
          boxShadow: focused ? '0 0 0 1px var(--color-brand-primary)' : 'none',
        }}
        numberInputProps={{
          className: 'bg-transparent outline-none w-full py-2.5 pr-3 font-sans text-sm border-none',
        }}
      />
      {error && (
        <p className="font-sans text-xs mt-1" style={{ color: 'var(--color-form-error)' }}>{error}</p>
      )}
    </div>
  );
}
