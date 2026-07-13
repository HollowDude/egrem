type AlertType = 'error' | 'success' | 'info';

interface Props {
  type?: AlertType;
  message: string | null;
}

const icons: Record<AlertType, string> = {
  error: 'error',
  success: 'check_circle',
  info: 'info',
};

export default function Alert({ type = 'error', message }: Props) {
  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-xl px-4 py-3 font-sans text-sm flex items-center gap-2 ${
        type === 'error'
          ? 'bg-[var(--color-form-error-bg)] text-[var(--color-form-error)] border border-[var(--color-form-error)]'
          : type === 'success'
          ? 'bg-green-50 text-green-700 border border-green-300'
          : 'bg-blue-50 text-blue-700 border border-blue-300'
      }`}
    >
      <span className="icon text-xl shrink-0">{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
}
