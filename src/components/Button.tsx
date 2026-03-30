import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'black' | 'danger' | 'icon' | 'icon-primary' | 'icon-danger';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const actualLoading = isLoading || loading;
  const baseStyles = "transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 font-bold";
  
  const variants = {
    primary: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] shadow-lg shadow-[var(--color-primary)]/20",
    secondary: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700",
    black: "bg-black text-white hover:bg-zinc-800 shadow-lg shadow-black/20",
    danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20",
    icon: "p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800",
    'icon-primary': "p-2 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20",
    'icon-danger': "p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100",
  };

  const sizes = {
    sm: "px-4 py-2 text-xs rounded-lg",
    md: "px-6 py-3 text-sm rounded-xl",
    lg: "px-8 py-4 text-base rounded-2xl",
    xl: "px-10 py-4.5 text-lg rounded-[1.5rem]",
    icon: "p-2 rounded-xl",
  };

  // Special case for icon buttons
  const isIcon = variant.startsWith('icon') || size === 'icon';
  const sizeStyles = isIcon ? sizes.icon : sizes[size];

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizeStyles} ${className}`}
      disabled={disabled || actualLoading}
      {...props}
    >
      {actualLoading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
