export default function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  ...props
}) {
  let baseClass = 'btn-primary';

  if (variant === 'secondary') {
    baseClass = 'btn-secondary';
  } else if (variant === 'danger') {
    baseClass = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center';
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
