import React from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   MONTESSORI PORTAL — UI PRIMITIVES
   Reusable Components following Design System
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Button ──────────────────────────────────────────────────────────────
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const classes = [
    "btn",
    `btn-${variant}`,
    size !== "md" ? `btn-${size}` : "",
    loading ? "btn-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading ? <span className="spinner" /> : icon}
      {children}
    </button>
  );
}

// ─── Input ───────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, className = "", ...props }, ref) => {
    return (
      <div className="field">
        {label && <label className="field-label">{label}</label>}
        <div className="search-box" style={{ position: "relative" }}>
          {icon && (
            <span style={{ position: "absolute", left: 14, color: "var(--color-text-tertiary)", display: "grid", placeItems: "center" }}>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={`input ${error ? "input-error" : ""} ${icon ? "input-with-icon" : ""}`}
            style={icon ? { paddingLeft: 40 } : undefined}
            {...props}
          />
        </div>
        {hint && !error && <p className="field-hint">{hint}</p>}
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  }
);

// ─── Select ──────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
  options: { value: string | number; label: string }[];
}

export function Select({ label, error, options, placeholder, ...props }: SelectProps) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      <select className={`input select ${error ? "input-error" : ""}`} {...props}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

// ─── Textarea ────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, ...props }, ref) => {
    return (
      <div className="field">
        {label && <label className="field-label">{label}</label>}
        <textarea ref={ref} className={`input textarea ${error ? "input-error" : ""}`} {...props} />
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  }
);

// ─── Card ────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = "", interactive, padding = true, onClick }: CardProps) {
  return (
    <div
      className={`card ${interactive ? "card-interactive" : ""} ${!padding ? "card-no-padding" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-header ${className}`}>{children}</div>;
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-footer ${className}`}>{children}</div>;
}

// ─── Badge ───────────────────────────────────────────────────────────────
type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>;
}

// ─── Avatar ──────────────────────────────────────────────────────────────
type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className={`avatar ${size !== "md" ? `avatar-${size}` : ""} ${className}`}>
      {src ? <img src={src} alt={name || ""} /> : initials}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  change?: { value: number; label?: string };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, change, icon, className = "" }: StatCardProps) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {icon && <span style={{ color: "var(--color-text-tertiary)" }}>{icon}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {change && (
        <span className={`stat-change ${change.value >= 0 ? "stat-change-positive" : "stat-change-negative"}`}>
          {change.value >= 0 ? "+" : ""}
          {change.value}%
          {change.label && <span style={{ color: "var(--color-text-tertiary)", marginLeft: 4 }}>{change.label}</span>}
        </span>
      )}
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────
interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className = "" }: TabsProps) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          className={`tab ${active === tab.key ? "tab-active" : ""}`}
          onClick={() => onChange(tab.key)}
          aria-selected={active === tab.key}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const maxWidth = size === "sm" ? 440 : size === "lg" ? 800 : 600;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <h3 className="heading-5">{title}</h3>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {action}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────
interface SpinnerProps {
  size?: "sm" | "lg";
  className?: string;
}

export function Spinner({ size, className = "" }: SpinnerProps) {
  return <div className={`spinner ${size === "lg" ? "spinner-lg" : ""} ${className}`} />;
}

// ─── Loading Page ────────────────────────────────────────────────────────
export function LoadingPage() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <span className="body-sm">Loading...</span>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────
interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = "skeleton-text", count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${className}`} />
      ))}
    </>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────
type AlertVariant = "success" | "danger" | "warning" | "info";

interface AlertProps {
  variant: AlertVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Alert({ variant, children, icon }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

// ─── Progress ────────────────────────────────────────────────────────────
interface ProgressProps {
  value: number;
  max?: number;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function Progress({ value, max = 100, variant = "default", className = "" }: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`progress ${variant !== "default" ? `progress-${variant}` : ""} ${className}`}>
      <div className="progress-bar" style={{ width: `${percent}%` }} />
    </div>
  );
}

// ─── Dropdown ────────────────────────────────────────────────────────────
interface DropdownItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className="dropdown" style={align === "left" ? { left: 0, right: "auto" } : undefined}>
          {items.map((item) => (
            <React.Fragment key={item.key}>
              {item.key === "divider" ? (
                <div className="dropdown-divider" />
              ) : (
                <button
                  className="dropdown-item"
                  style={item.danger ? { color: "var(--color-danger)" } : undefined}
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
