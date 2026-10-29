import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, type LucideIcon } from 'lucide-react';
import { cn, initials, PRIORITY_META, STATUS_META } from '../lib/helpers';
import { OrderPriority, OrderStatus } from '../types';

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'outline' | 'subtle' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  iconOnly?: boolean;
  loading?: boolean;
}

export function Button({
  variant = 'subtle',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  iconOnly,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        iconOnly && 'btn-icon',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2} /> : null}
      {children}
      {IconRight ? <IconRight size={size === 'sm' ? 14 : 16} strokeWidth={2} /> : null}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size, opacity: 0.8 }}
      aria-hidden
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot,
}: {
  tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan';
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn('badge', `badge-${tone}`, className)}>
      {dot ? <span className="dot" style={{ background: 'currentColor' }} /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} dot className={className}>
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: OrderPriority; className?: string }) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge tone={meta.tone === 'neutral' ? 'neutral' : meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  color,
  size = 32,
  className,
  title,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn('avatar', className)}
      title={title || name}
      style={{
        width: size,
        height: size,
        background: color || '#4d8dff',
        fontSize: Math.max(9, Math.round(size * 0.36)),
      }}
    >
      {initials(name)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  interactive,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  as?: React.ElementType;
}) {
  return <Tag className={cn('card', interactive && 'card-interactive', className)}>{children}</Tag>;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
        <h2 className="text-[15px] font-semibold text-[var(--txt)] leading-tight">{title}</h2>
        {subtitle ? <p className="text-[12px] text-[var(--txt-2)] mt-0.5">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* KPI                                                                        */
/* -------------------------------------------------------------------------- */

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'blue',
  footer,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'violet';
  footer?: React.ReactNode;
}) {
  const toneColor: Record<string, string> = {
    blue: 'var(--accent)',
    green: 'var(--ok)',
    amber: 'var(--warn)',
    red: 'var(--danger)',
    violet: 'var(--violet)',
  };
  return (
    <Card className="p-4 relative overflow-hidden">
      <div
        className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-[0.07]"
        style={{ background: toneColor[tone] }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">{label}</div>
          <div className="mt-2 text-[28px] leading-none font-semibold text-[var(--txt)] mono">{value}</div>
          {hint ? <div className="mt-2 text-[11.5px] text-[var(--txt-3)] leading-snug">{hint}</div> : null}
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${toneColor[tone]}18`, color: toneColor[tone] }}
        >
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </Card>
  );
}

export function Progress({
  value,
  tone = 'blue',
  className,
}: {
  value: number;
  tone?: 'blue' | 'green' | 'amber' | 'red';
  className?: string;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('progress', className)} data-tone={tone} role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Forms                                                                      */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('field', className)}>
      {label ? <span className="label">{label}</span> : null}
      {children}
      {error ? <span className="form-error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => <input ref={ref} className={cn('input', className)} {...rest} />,
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => <textarea ref={ref} className={cn('textarea', className)} {...rest} />,
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...rest }, ref) => (
    <select ref={ref} className={cn('select', className)} {...rest}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {label ? <div className="text-[13px] font-medium text-[var(--txt)]">{label}</div> : null}
        {hint ? <div className="hint mt-0.5">{hint}</div> : null}
      </div>
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-on={checked}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-deep)] border border-[var(--line)]">
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2 text-[11.5px]' : 'h-8 px-3 text-[12.5px]',
              active
                ? 'bg-[var(--panel-3)] text-[var(--txt)] shadow-sm'
                : 'text-[var(--txt-3)] hover:text-[var(--txt-2)]',
            )}
          >
            {Icon ? <Icon size={14} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className={cn('modal', size === 'lg' && 'modal-lg')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--line)]">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[var(--txt)]">{title}</h3>
            {subtitle ? <p className="text-[12px] text-[var(--txt-2)] mt-1">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose} aria-label="Cerrar" />
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--line)] bg-[var(--bg-deep)]/40 rounded-b-[14px]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Empty / loading                                                            */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8 px-4' : 'py-16 px-6')}>
      <div className="w-12 h-12 rounded-xl bg-[var(--panel-2)] border border-[var(--line)] flex items-center justify-center text-[var(--txt-3)] mb-3">
        <Icon size={22} strokeWidth={1.6} />
      </div>
      <div className="text-[14px] font-semibold text-[var(--txt)]">{title}</div>
      {description ? <p className="text-[12.5px] text-[var(--txt-2)] mt-1 max-w-sm leading-relaxed">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
