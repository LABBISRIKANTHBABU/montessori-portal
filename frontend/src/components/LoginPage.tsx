import React, { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileBadge2,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { api, token, School } from "../api";
import { orderVisibleSchools } from "../schools/visibleSchools";

const GROUP_LOGO = "/montessori-golden-jubilee-logo.jpeg";
const REMEMBERED_EMAIL_KEY = "monte_remembered_email";

type HealthState = "checking" | "online" | "degraded" | "offline";

interface LoginPageProps {
  onLogin: (session: { user: { name: string; role: string; roleCode: string; permissions: string[] }; school: School }) => void;
  isSuperAdmin: boolean;
}

function SecurityStatus() {
  const [state, setState] = useState<HealthState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.health()
      .then((result) => {
        if (cancelled) return;
        if (result.checks?.database === false || result.database?.ok === false) {
          setState("degraded");
          setMessage("Database checks degraded");
          return;
        }
        setState("online");
        setMessage(result.database?.latencyMs !== undefined ? `Live backend · DB ${result.database.latencyMs}ms` : "Live backend connected");
      })
      .catch(() => {
        if (cancelled) return;
        setState("offline");
        setMessage("Backend connection unavailable");
      });
    return () => { cancelled = true; };
  }, []);

  const Icon = state === "online" ? CheckCircle2 : state === "checking" ? Clock : AlertTriangle;

  return (
    <div className="enterprise-status-row" aria-label="Security and connection status">
      <div className={`enterprise-status enterprise-status-${state}`} role="status" aria-live="polite">
        <Icon size={14} />
        <span>{message || "Checking secure connection..."}</span>
      </div>
      <div className="enterprise-security-badge">
        <ShieldCheck size={14} />
        <span>Role-based access</span>
      </div>
    </div>
  );
}

function LoginLayout({ children }: { children: ReactNode }) {
  return <main className="enterprise-login-screen">{children}</main>;
}

function FeaturePills({ items }: { items: Array<{ label: string; icon: ReactNode }> }) {
  return (
    <div className="enterprise-feature-pills" aria-label="Platform modules">
      {items.map((item) => (
        <span key={item.label}>
          {item.icon}
          {item.label}
        </span>
      ))}
    </div>
  );
}

function CapabilityGrid({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const capabilities = isSuperAdmin
    ? [
        ["8,000+", "Students managed"],
        ["6", "Campuses connected"],
        ["RBAC", "Secure permissions"],
        ["Audit", "Operational logs"],
      ]
    : [
        ["Live", "Student records"],
        ["Auto", "Certificate workflows"],
        ["Secure", "School-scoped access"],
        ["Daily", "Academic operations"],
      ];

  return (
    <div className="enterprise-capability-grid" aria-label="Platform trust information">
      {capabilities.map(([value, label]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function BrandPanel({ isSuperAdmin, school }: { isSuperAdmin: boolean; school: School | null }) {
  const heading = isSuperAdmin ? "Global Command Centre" : "Unified Campus Operations";
  const eyebrow = isSuperAdmin ? "MONTESSORI GROUP OF SCHOOLS" : school?.name || "MONTESSORI SCHOOL WORKSPACE";
  const description = isSuperAdmin
    ? "One enterprise workspace to govern every campus, student record, certificate, finance workflow, event, and report with calm operational clarity."
    : "A secure campus workspace for admissions, student records, certificates, attendance, events, fees, and school operations.";
  const features = [
    { label: "Student Management", icon: <Users size={14} /> },
    { label: "Certificates", icon: <FileBadge2 size={14} /> },
    { label: "Staff", icon: <BadgeCheck size={14} /> },
    { label: "Finance", icon: <WalletCards size={14} /> },
    { label: "Reports", icon: <BarChart3 size={14} /> },
    { label: "Events", icon: <CalendarDays size={14} /> },
    { label: "Analytics", icon: <Sparkles size={14} /> },
  ];

  return (
    <section className="enterprise-brand-panel" aria-label="Montessori ERP overview">
      <div className="enterprise-brand-shell">
        <div className="enterprise-geometry" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="enterprise-brand-mark">
          <img src={GROUP_LOGO} alt="Montessori logo" />
          <div>
            <strong>Montessori</strong>
            <small>Enterprise ERP</small>
          </div>
        </div>

        <div className="enterprise-brand-copy">
          <span>{eyebrow}</span>
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>

        <FeaturePills items={features} />
        <CapabilityGrid isSuperAdmin={isSuperAdmin} />
      </div>
    </section>
  );
}

function FloatingInput({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  icon,
  trailing,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  icon: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <label className="enterprise-field" htmlFor={id}>
      <span className="enterprise-field-icon">{icon}</span>
      <input
        id={id}
        type={type}
        placeholder=" "
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        autoComplete={autoComplete}
      />
      <span className="enterprise-floating-label">{label}</span>
      {trailing}
    </label>
  );
}

function LoginForm({
  email,
  password,
  showPassword,
  rememberEmail,
  error,
  loading,
  onEmail,
  onPassword,
  onRememberEmail,
  onShowPassword,
  onForgotPassword,
  onSubmit,
}: {
  email: string;
  password: string;
  showPassword: boolean;
  rememberEmail: boolean;
  error: string;
  loading: boolean;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onRememberEmail: (value: boolean) => void;
  onShowPassword: () => void;
  onForgotPassword: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="enterprise-login-form" onSubmit={onSubmit}>
      <FloatingInput
        id="login-email"
        label="Email address"
        type="email"
        value={email}
        onChange={onEmail}
        autoComplete="email"
        icon={<Mail size={18} />}
      />

      <FloatingInput
        id="login-password"
        label="Password"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={onPassword}
        autoComplete="current-password"
        icon={<Lock size={18} />}
        trailing={(
          <button
            type="button"
            className="enterprise-password-toggle"
            onClick={onShowPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      />

      <div className="enterprise-form-options">
        <label className="enterprise-remember">
          <input
            type="checkbox"
            checked={rememberEmail}
            onChange={(event) => onRememberEmail(event.target.checked)}
          />
          <span>Remember this account</span>
        </label>
        <button type="button" className="enterprise-forgot" onClick={onForgotPassword}>
          Forgot password?
        </button>
      </div>

      {error && (
        <div className="enterprise-login-error" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      <button type="submit" className="enterprise-submit" disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" />
            Verifying access...
          </>
        ) : (
          <>
            Continue securely
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </form>
  );
}

function AuthFooter() {
  return (
    <footer className="enterprise-auth-footer">
      <span>AES-ready sensitive data protection</span>
      <span>Audit logs · Daily backup workflow</span>
    </footer>
  );
}

function AuthPanel({
  isSuperAdmin,
  email,
  password,
  showPassword,
  rememberEmail,
  error,
  loading,
  onEmail,
  onPassword,
  onRememberEmail,
  onShowPassword,
  onForgotPassword,
  onSubmit,
}: {
  isSuperAdmin: boolean;
  email: string;
  password: string;
  showPassword: boolean;
  rememberEmail: boolean;
  error: string;
  loading: boolean;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onRememberEmail: (value: boolean) => void;
  onShowPassword: () => void;
  onForgotPassword: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <section className="enterprise-auth-panel" aria-label="Sign in form">
      <div className="enterprise-auth-card">
        <div className="enterprise-auth-header">
          <div className="enterprise-auth-logo">
            <img src={GROUP_LOGO} alt="Montessori logo" />
          </div>
          <span>{isSuperAdmin ? "GLOBAL PLATFORM ACCESS" : "SECURE CAMPUS ACCESS"}</span>
          <h2>Welcome back</h2>
          <p>Continue to your Montessori ERP workspace.</p>
        </div>

        <SecurityStatus />

        <div className="enterprise-session-note">
          <KeyRound size={15} />
          <span>Sessions are protected, school-scoped, and permission-aware.</span>
        </div>

        <LoginForm
          email={email}
          password={password}
          showPassword={showPassword}
          rememberEmail={rememberEmail}
          error={error}
          loading={loading}
          onEmail={onEmail}
          onPassword={onPassword}
          onRememberEmail={onRememberEmail}
          onShowPassword={onShowPassword}
          onForgotPassword={onForgotPassword}
          onSubmit={onSubmit}
        />

        <AuthFooter />
      </div>
    </section>
  );
}

export function LoginPage({ onLogin, isSuperAdmin }: LoginPageProps) {
  const navigate = useNavigate();
  const { schoolId } = useParams();
  const numericSchoolId = Number(schoolId || 0);

  const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [targetSchool, setTargetSchool] = useState<School | null>(null);

  useEffect(() => {
    if (isSuperAdmin) return;
    api.schools()
      .then(({ data }) => {
        const visible = orderVisibleSchools(data);
        setTargetSchool(visible.find((school) => school.id === numericSchoolId) || null);
      })
      .catch(() => undefined);
  }, [isSuperAdmin, numericSchoolId]);

  useEffect(() => {
    if (rememberEmail && email.trim()) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
    if (!rememberEmail) localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }, [email, rememberEmail]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.login({ schoolId: isSuperAdmin ? 0 : numericSchoolId, email, password });
      token.set(result.token);
      onLogin({ user: result.user, school: result.school });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  const handleForgotPassword = () => {
    navigate(`/forgot-password?schoolId=${numericSchoolId}&email=${encodeURIComponent(email)}`);
  };

  return (
    <LoginLayout>
      <button className="enterprise-back-button" onClick={() => navigate("/")}>
        <ArrowRight size={14} />
        Back to campuses
      </button>

      <BrandPanel isSuperAdmin={isSuperAdmin} school={targetSchool} />

      <AuthPanel
        isSuperAdmin={isSuperAdmin}
        email={email}
        password={password}
        showPassword={showPassword}
        rememberEmail={rememberEmail}
        error={error}
        loading={loading}
        onEmail={setEmail}
        onPassword={setPassword}
        onRememberEmail={setRememberEmail}
        onShowPassword={() => setShowPassword((value) => !value)}
        onForgotPassword={handleForgotPassword}
        onSubmit={handleSubmit}
      />
    </LoginLayout>
  );
}
