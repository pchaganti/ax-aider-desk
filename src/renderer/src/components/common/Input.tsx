import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export type Props = InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
  label?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, Props>(({ wrapperClassName, label, className = '', ...props }, ref) => {
  return (
    <div className={wrapperClassName}>
      {label && <label className="block text-sm font-medium text-neutral-100 mb-1">{label}</label>}
      <input
        ref={ref}
        spellCheck={false}
        {...props}
        className={`w-full p-2 bg-neutral-800 border-2 border-neutral-600 rounded focus:outline-none focus:border-neutral-200 text-neutral-100 text-sm placeholder-neutral-500 ${className}`}
      />
    </div>
  );
});

Input.displayName = 'Input';
