import { InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: ReactNode;
  checked: boolean;
  onChange: () => void;
  className?: string;
  size?: 'sm' | 'md';
};

export const Checkbox = ({ label, checked, onChange, className = '', size = 'sm', ...props }: Props) => {
  return (
    <div
      className={clsx(
        'flex items-center cursor-pointer',
        {
          'text-xs': size === 'sm',
          'text-sm': size === 'md',
        },
        className,
      )}
      onClick={onChange}
    >
      <div
        className="relative flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onChange();
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only" // Hide the actual input but keep it accessible
          {...props}
        />
        <div
          className={clsx(
            'rounded border flex items-center justify-center transition-colors duration-200 w-4 h-4',
            checked ? 'bg-neutral-600 border-neutral-500' : 'bg-neutral-800 border-neutral-600',
          )}
        >
          {checked && (
            <svg
              className={clsx('text-white', {
                'w-3 h-3': size === 'sm',
                'w-4 h-4': size === 'md',
              })}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      {label && <span className="ml-2">{label}</span>}
    </div>
  );
};
