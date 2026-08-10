/**
 * GAPAK Design System UI Primitives
 * High craftsmanship React 19 components with full Tailwind CSS styling,
 * micro-interactions via Motion, and dark/light mode support.
 */

import React, { forwardRef, useState, ReactNode, ElementType, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2,
  X,
  Check,
  ChevronDown,
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { PresenceStatus } from '../types';

// ==========================================
// 1. BUTTON & ICON BUTTON
// ==========================================
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const baseStyle =
      'inline-flex min-h-10 items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-[var(--radius-md)]';

    const variants = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-token-sm active:bg-indigo-700',
      secondary:
        'bg-surface-hover hover:bg-surface-soft text-primary border border-default',
      outline:
        'border border-default hover:bg-surface-subtle text-secondary',
      ghost:
        'hover:bg-surface-subtle text-secondary',
      danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-token-sm active:bg-rose-700',
      accent: 'bg-purple-600 hover:bg-purple-500 text-white shadow-token-sm active:bg-purple-700',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
    };

    return (
      <button
        ref={ref}
        id={id}
        disabled={disabled || isLoading}
        className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : leftIcon}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);
Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  ariaLabel: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, ariaLabel, variant = 'ghost', size = 'md', className = '', id, ...props }, ref) => {
    const baseStyle =
      'inline-flex min-h-10 min-w-10 items-center justify-center rounded-[var(--radius-md)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]';

    const variants = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      secondary: 'bg-surface-muted hover:bg-surface-strong text-primary border border-default',
      outline: 'border border-default hover:bg-surface-muted text-secondary',
      ghost: 'hover:bg-surface-muted text-tertiary hover:text-primary',
      danger: 'hover:bg-rose-500/10 text-rose-400',
    };

    const sizes = {
      sm: 'p-2 text-xs',
      md: 'p-2.5 text-sm',
      lg: 'p-3 text-base',
    };

    return (
      <button
        ref={ref}
        id={id}
        aria-label={ariaLabel}
        className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {icon}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';

// ==========================================
// 2. FORM INPUTS & CONTROLS
// ==========================================
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? `input_${label.toLowerCase().replace(/\s+/g, '_')}` : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-secondary dark:text-secondary">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && <div className="absolute left-3 text-tertiary pointer-events-none">{leftIcon}</div>}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-surface border text-primary text-sm rounded-[var(--radius-lg)] transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 ${
              leftIcon ? 'pl-9' : 'pl-3.5'
            } ${rightIcon ? 'pr-9' : 'pr-3.5'} py-2 ${
              error ? 'border-rose-500 focus:border-rose-500' : 'border-default focus:border-indigo-500'
            } ${className}`}
            {...props}
          />
          {rightIcon && <div className="absolute right-3 text-tertiary">{rightIcon}</div>}
        </div>
        {error ? (
          <p className="text-xs text-rose-500 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-xs font-medium text-secondary dark:text-secondary">{label}</label>}
        <textarea
          ref={ref}
          id={id}
          className={`w-full bg-surface border text-primary text-sm rounded-[var(--radius-lg)] p-3 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
            error ? 'border-rose-500' : 'border-default focus:border-indigo-500'
          } ${className}`}
          {...props}
        />
        {error ? <p className="text-xs text-rose-500 font-medium">{error}</p> : helperText ? <p className="text-xs text-muted">{helperText}</p> : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className = '', id, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-xs font-medium text-secondary dark:text-secondary">{label}</label>}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={`w-full bg-surface border text-primary text-sm rounded-[var(--radius-lg)] px-3.5 py-2 pr-9 appearance-none transition-all focus:outline-none focus:border-indigo-500 ${
              error ? 'border-rose-500' : 'border-default'
            } ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-surface text-primary">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-tertiary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ label, className = '', id, ...props }, ref) => {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        ref={ref}
        id={id}
        className={`w-4 h-4 rounded text-indigo-600 bg-surface border-default focus:ring-indigo-500/20 ${className}`}
        {...props}
      />
      {label && <span className="text-sm text-secondary">{label}</span>}
    </label>
  );
});
Checkbox.displayName = 'Checkbox';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled = false, id }) => {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-[var(--radius-pill)] transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
          checked ? 'bg-indigo-600' : 'bg-surface-soft dark:bg-surface-strong'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-[var(--radius-pill)] bg-white shadow transition duration-200 ease-in-out ${
            checked ? 'translate-x-5.5' : 'translate-x-0.5'
          } mt-0.5`}
        />
      </button>
      {label && <span className="text-sm text-secondary dark:text-secondary font-medium">{label}</span>}
    </label>
  );
};

// ==========================================
// 3. AVATAR & BADGE
// ==========================================
export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: PresenceStatus;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name = 'User', size = 'md', status, className = '' }) => {
  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const statusColors = {
    online: 'bg-emerald-500',
    away: 'bg-amber-500',
    busy: 'bg-rose-500',
    invisible: 'bg-surface-soft0',
    offline: 'bg-surface-stronger',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {src ? (
        <img src={src} alt={name} className={`${sizeMap[size]} rounded-[var(--radius-pill)] object-cover ring-1 ring-slate-700/50`} />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-[var(--radius-pill)] bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-semibold flex items-center justify-center ring-1 ring-slate-700/50`}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-[var(--radius-pill)] ${statusColors[status]} ring-2 ring-slate-900`}
        />
      )}
    </div>
  );
};

export interface BadgeProps {
  children: ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const variants = {
    neutral: 'bg-surface-subtle dark:bg-surface-muted text-secondary dark:text-secondary border-default',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    brand: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-[var(--radius-pill)] ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-[var(--radius-pill)] bg-current" />}
      {children}
    </span>
  );
};

// ==========================================
// 4. CARD PRIMITIVES
// ==========================================
export const Card: React.FC<{ children: ReactNode; className?: string; id?: string }> = ({
  children,
  className = '',
  id,
}) => {
  return (
    <div
      id={id}
      className={`bg-surface border border-subtle dark:border-subtle rounded-[var(--radius-xl)] shadow-token-sm overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-4 border-b border-subtle dark:border-subtle flex items-center justify-between ${className}`}>
    {children}
  </div>
);

export const CardBody: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

export const CardFooter: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-4 border-t border-subtle dark:border-subtle bg-surface-soft dark:bg-app-glass ${className}`}>
    {children}
  </div>
);

// ==========================================
// 5. DIALOG / MODAL
// ==========================================
export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  id?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, children, maxWidth = 'md', size, id }) => {
  const actualWidth = size || maxWidth;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusable = node?.querySelector<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = ''; previousFocus.current?.focus(); };
  }, [isOpen, onClose]);
  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id={id} className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby={title ? `${id || 'gapak-dialog'}-title` : undefined}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-app-glass backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            ref={dialogRef}
            className={`relative w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto ${maxWidths[actualWidth]} bg-surface border border-subtle dark:border-subtle rounded-[var(--radius-2xl)] shadow-token-lg overflow-hidden z-10 flex flex-col`}
          >
            {title && (
              <div className="p-4 border-b border-subtle dark:border-subtle flex items-center justify-between">
                <h3 id={`${id || 'gapak-dialog'}-title`} className="text-base font-semibold text-primary">{title}</h3>
                <IconButton icon={<X className="w-4 h-4" />} ariaLabel="Close dialog" onClick={onClose} />
              </div>
            )}
            <div className="p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const Modal = Dialog;

export const ModalHeader: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-4 border-b border-subtle dark:border-subtle flex items-center justify-between ${className}`}>
    {children}
  </div>
);

export const ModalBody: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);

export const ModalFooter: React.FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-4 border-t border-subtle dark:border-subtle bg-surface-soft dark:bg-app-glass flex items-center justify-end gap-2 ${className}`}>
    {children}
  </div>
);


// ==========================================
// 6. DRAWER (Mobile Sheet)
// ==========================================
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  position?: 'bottom' | 'right';
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, position = 'bottom' }) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex=\"-1\"])')?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus.current?.focus(); };
  }, [isOpen, onClose]);
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[var(--z-overlay)] overflow-hidden" role="dialog" aria-modal="true" aria-label={title || 'GAPAK drawer'}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-app-glass backdrop-blur-sm"
          />
          <motion.div
            initial={position === 'bottom' ? { y: '100%' } : { x: '100%' }}
            animate={position === 'bottom' ? { y: 0 } : { x: 0 }}
            exit={position === 'bottom' ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            ref={drawerRef}
            className={`fixed ${
              position === 'bottom'
                ? 'inset-x-0 bottom-0 rounded-t-[var(--radius-2xl)] max-h-[min(85dvh,42rem)] pb-[env(safe-area-inset-bottom)]'
                : 'inset-y-0 right-0 w-full max-w-sm rounded-l-2xl'
            } bg-surface border-subtle dark:border-subtle border-t shadow-token-lg flex flex-col z-10`}
          >
            <div className="p-4 border-b border-subtle dark:border-subtle flex items-center justify-between">
              <h3 className="text-base font-semibold text-primary">{title}</h3>
              <IconButton icon={<X className="w-4 h-4" />} ariaLabel="Close drawer" onClick={onClose} />
            </div>
            <div className="p-4 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ==========================================
// 7. TABS & SEGMENTED CONTROL
// ==========================================
export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`flex border-b border-subtle dark:border-subtle gap-1 overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative py-2.5 px-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
              active ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted hover:text-secondary'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <Badge size="sm" variant={active ? 'brand' : 'neutral'}>
                {tab.badge}
              </Badge>
            )}
            {active && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-500 rounded-[var(--radius-pill)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export const SegmentedControl: React.FC<{
  options: { label: string; value: string }[];
  value: string;
  onChange: (val: string) => void;
}> = ({ options, value, onChange }) => {
  return (
    <div className="inline-flex p-1 bg-surface-subtle dark:bg-surface border border-subtle dark:border-subtle rounded-[var(--radius-xl)]">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-[var(--radius-lg)] transition-all ${
              active ? 'text-primary dark:text-white bg-surface-muted shadow-token-sm' : 'text-muted hover:text-secondary'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

// ==========================================
// 8. SKELETON & SPINNER & PROGRESS
// ==========================================
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-surface-hover dark:bg-surface-muted rounded-[var(--radius-lg)] ${className}`} />
);

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return <Loader2 className={`animate-spin text-indigo-500 ${sizes[size]} ${className}`} />;
};

export const Progress: React.FC<{ value: number; max?: number; className?: string }> = ({
  value,
  max = 100,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`w-full h-2 bg-surface-hover dark:bg-surface-muted rounded-[var(--radius-pill)] overflow-hidden ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-[var(--radius-pill)]"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// ==========================================
// 9. EMPTY STATE & ERROR STATE
// ==========================================
export const EmptyState: React.FC<{
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="p-8 text-center flex flex-col items-center justify-center border border-dashed border-default dark:border-subtle rounded-[var(--radius-2xl)] bg-surface-glass dark:bg-surface-glass">
    <div className="p-3 bg-surface-subtle dark:bg-surface-muted rounded-[var(--radius-2xl)] text-tertiary mb-3">{icon || <HelpCircle className="w-8 h-8" />}</div>
    <h3 className="text-base font-semibold text-primary dark:text-primary mb-1">{title}</h3>
    {description && <p className="text-sm text-muted max-w-sm mb-4">{description}</p>}
    {action}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = 'Something went wrong', message, onRetry }) => (
  <div className="p-6 rounded-[var(--radius-2xl)] bg-rose-500/10 border border-rose-500/20 text-rose-400 flex flex-col items-center text-center gap-3">
    <AlertTriangle className="w-8 h-8 text-rose-500" />
    <div>
      <h4 className="font-semibold text-primary">{title}</h4>
      <p className="text-xs text-rose-300 mt-1">{message}</p>
    </div>
    {onRetry && (
      <Button variant="danger" size="sm" onClick={onRetry}>
        Retry
      </Button>
    )}
  </div>
);

// ==========================================
// 10. CONFIRM DIALOG
// ==========================================
export const ConfirmDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}> = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger' }) => {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="flex flex-col gap-3 text-center items-center">
        <div className={`p-3 rounded-[var(--radius-2xl)] ${variant === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-primary">{title}</h3>
        <p className="text-xs text-tertiary">{message}</p>
        <div className="grid grid-cols-2 gap-3 w-full mt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={variant}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
