export default function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  helperText,
  className = '',
  ...props
}) {
  return (
    <div className="mb-4">
      {label && <label className="label">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`input-field ${className}`}
        {...props}
      />
      {helperText && (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      )}
    </div>
  );
}
