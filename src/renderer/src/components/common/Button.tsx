import { ReactNode } from 'react';

type ButtonVariant = 'contained' | 'text' | 'outline';
type ButtonColor = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md';

type Props = {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  color?: ButtonColor;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: ButtonSize;
};

const colorClasses: Record<ButtonColor, Record<ButtonVariant, string>> = {
  primary: {
    contained: 'bg-amber-600 hover:bg-amber-500 text-white',
    text: 'text-amber-600 hover:bg-amber-600/10',
    outline: 'border-amber-600 text-amber-600 hover:bg-amber-600/10',
  },
  secondary: {
    contained: 'bg-blue-600 hover:bg-blue-500 text-white',
    text: 'text-blue-600 hover:bg-blue-600/10',
    outline: 'border-blue-600 text-blue-600 hover:bg-blue-600/10',
  },
  danger: {
    contained: 'bg-red-500 hover:bg-red-500 text-white',
    text: 'text-red-500 hover:bg-red-500/10',
    outline: 'border-red-500 text-red-500 hover:bg-red-500/10',
  },
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-4 py-2 text-base',
  sm: 'px-2.5 py-1.5 text-sm',
};

export const Button = ({
  children,
  onClick,
  variant = 'contained',
  color = 'primary',
  className = '',
  disabled = false,
  autoFocus = false,
  size = 'md',
}: Props) => {
  const baseColorClasses = disabled
    ? 'bg-neutral-700/50 text-neutral-500 cursor-not-allowed hover:bg-neutral-700/50 hover:text-neutral-500'
    : colorClasses[color][variant];

  const baseSizeClasses = sizeClasses[size];

  const borderClass = variant === 'outline' && !disabled ? 'border' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`flex items-center space-x-1 rounded-lg font-medium transition-colors ${borderClass} ${baseColorClasses} ${baseSizeClasses} ${className}`}
    >
      {children}
    </button>
  );
};
