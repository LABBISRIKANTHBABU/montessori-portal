import React, { Component, FormEvent, ReactNode, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight, Award, BarChart3, Bell, Calendar, ChevronDown, CircleHelp, FileBadge2,
  GraduationCap, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, Sparkles,
  Upload, UserRound, Users, WalletCards, X, Shield, Building2, CheckCircle2,
  AlertTriangle, Clock, CreditCard, FileText, Moon
} from "lucide-react";
import { api, apiConfigurationError, DashboardData, GroupOverview, School, SearchResult, Notification, schoolScope, token } from "./api";
import { ToastProvider } from "./components/Toast";

const StudentCreatePage = React.lazy(() => import("./features/students/StudentCreatePage"));
const StudentsPage = React.lazy(() => import("./features/students/StudentsPage"));
const StudentProfilePage = React.lazy(() => import("./features/students/StudentProfilePage"));
const ImportPage = React.lazy(() => import("./features/students/ImportPage"));
const DocumentsPage = React.lazy(() => import("./features/documents/DocumentsPage"));
const CertificatesPage = React.lazy(() => import("./features/certificates/CertificatesPage"));
const AccountsPage = React.lazy(() => import("./features/accounts/AccountsPage"));
const EventsPage = React.lazy(() => import("./features/events/EventsPage"));
const ReportsPage = React.lazy(() => import("./features/reports/ReportsPage"));
const UsersPageFull = React.lazy(() => import("./features/users/UsersPage"));
const SettingsPage = React.lazy(() => import("./features/settings/SettingsPage"));

const GROUP_LOGO = "/montessori-golden-jubilee-logo.jpeg";

type Session = {
  user: { name: string; role: string; roleCode: string; permissions: string[] };
  school: School;
} | null;

// ─── Error Boundary ─────────────────────────────────────────────────────

interface ErrorBoundaryState { hasError: boolean; error: Error | null }
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("[ErrorBoundary]", error, info.componentStack); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", background: "#0f1117", color: "#e2e4e9" }}>
          <div style={{ textAlign: "center", maxWidth: 480, padding: "2rem" }}>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
            <p style={{ color: "#8b8fa3", marginBottom: "1.5rem" }}>An unexpected error occurred. Please refresh the page or contact support if the issue persists.</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ padding: "0.6rem 1.5rem", background: "#6c5ce7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Loading Skeleton ───────────────────────────────────────────────────

export function Skeleton({ width = "100%", height = 20, borderRadius = 6, style }: { width?: string | number; height?: number | string; borderRadius?: number; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width, height, borderRadius,
        background: "linear-gradient(90deg, #e8eee9 25%, #dcd8cc 50%, #e8eee9 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

export function TextSkeleton({ lines = 3, style }: { lines?: number; style?: React.CSSProperties }) {
  return (
    <div className="skeleton-text" style={style} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-text-line" />
      ))}
    </div>
  );
}

export function CardSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="skeleton-card" style={style} aria-hidden="true">
      <div className="skeleton-card-header">
        <div className="skeleton-avatar" />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height={14} borderRadius={4} />
          <Skeleton width="40%" height={10} borderRadius={4} style={{ marginTop: 8 }} />
        </div>
      </div>
      <div className="skeleton-card-body">
        <Skeleton height={10} borderRadius={4} />
        <Skeleton height={10} borderRadius={4} />
        <Skeleton width="70%" height={10} borderRadius={4} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5, style }: { rows?: number; cols?: number; style?: React.CSSProperties }) {
  return (
    <div style={style} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-table-row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={14} borderRadius={4} />
          ))}
        </div>
      ))}
    </div>
  );
}

const skeletonStyles = document.createElement("style");
skeletonStyles.textContent = `@keyframes skeleton-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`;
if (!document.getElementById("skeleton-keyframes")) { skeletonStyles.id = "skeleton-keyframes"; document.head.appendChild(skeletonStyles); }

function App() {
  const [session, setSession] = useState<Session>(() => {
    const raw = localStorage.getItem("monte_session");
    return raw ? JSON.parse(raw) : null;
  });
  useEffect(() => {
    if (!session || (session.user.permissions?.length && session.user.roleCode)) return;
    api.accessModel().then(({ data }) => {
      const upgraded = {
        ...session,
        user: { ...session.user, roleCode: data.role, permissions: data.permissions },
      };
      setSession(upgraded);
      localStorage.setItem("monte_session", JSON.stringify(upgraded));
    }).catch(() => {
      token.clear();
      schoolScope.clear();
      localStorage.removeItem("monte_session");
      setSession(null);
    });
  }, [session]);
  const signIn = (next: NonNullable<Session>) => {
    if (next.user.role === "Group Super Admin") schoolScope.set(next.school.id);
    else schoolScope.clear();
    setSession(next);
    localStorage.setItem("monte_session", JSON.stringify(next));
  };
  const signOut = () => {
    void api.logout().catch(() => undefined);
    token.clear();
    schoolScope.clear();
    localStorage.removeItem("monte_session");
    setSession(null);
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login/:schoolId" element={session ? <Navigate to="/dashboard" /> : <Login onLogin={signIn} isSuperAdmin={false} />} />
            <Route path="/super-admin" element={session ? <Navigate to="/dashboard" /> : <Login onLogin={signIn} isSuperAdmin={true} />} />
            <Route path="/forgot-password" element={session ? <Navigate to="/dashboard" /> : <PasswordRecovery mode="request" />} />
            <Route path="/reset-password" element={session ? <Navigate to="/dashboard" /> : <PasswordRecovery mode="reset" />} />
            <Route path="/*" element={session ? <Portal session={session} onLogout={signOut} /> : <Navigate to="/" />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}

// ─── Landing Page ────────────────────────────────────────────────────────
// School cards, search, super admin card. No login form, no demo stats.

function ApiConnectionStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<"checking" | "online" | "degraded" | "offline">("checking");
  const [message, setMessage] = useState("Checking backend connection...");

  useEffect(() => {
    let cancelled = false;
    api.health()
      .then(result => {
        if (cancelled) return;
        if (result.checks?.database === false || result.database?.ok === false) {
          setState("degraded");
          setMessage(result.message || "Backend is running, but database health is not confirmed.");
          return;
        }
        setState("online");
        setMessage(`Backend connected${result.database?.latencyMs !== undefined ? ` · DB ${result.database.latencyMs}ms` : ""}`);
      })
      .catch(error => {
        if (cancelled) return;
        setState("offline");
        setMessage(error instanceof Error ? error.message : "Backend is not reachable.");
      });
    return () => { cancelled = true; };
  }, []);

  const Icon = state === "online" ? CheckCircle2 : state === "checking" ? Clock : AlertTriangle;
  return (
    <div className={`api-status api-status-${state}${compact ? " compact" : ""}`} role="status" aria-live="polite">
      <Icon size={compact ? 14 : 17} />
      <span>{message}</span>
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState(apiConfigurationError);
  useEffect(() => {
    api.schools().then(r => setSchools(r.data))
      .catch(reason => setLoadError(reason instanceof Error ? reason.message : "Schools could not be loaded."));
  }, []);

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="landing-new">
      <nav className="landing-nav">
        <Brand />
        <button className="text-button super-admin-link" onClick={() => navigate("/super-admin")}>
          <Shield size={16} /> Platform Admin
        </button>
      </nav>

      <section className="landing-header">
        <span className="eyebrow">MONTESSORI GROUP OF SCHOOLS</span>
        <h1>Select your campus</h1>
        <p>Choose your school to sign in to your workspace.</p>
        <ApiConnectionStatus />
        <div className="search-bar-large">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by school name, city, or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </section>

      <section className="school-grid">
        {loadError && <div className="form-error" role="alert">{loadError}</div>}
        {filtered.map(school => (
          <button key={school.id} className="school-card" onClick={() => navigate(`/login/${school.id}`)}>
            <div className="school-icon">
              <img src={GROUP_LOGO} alt="" aria-hidden="true" />
            </div>
            <div className="school-details">
              <strong>{school.name}</strong>
              <small><Building2 size={13} /> {school.city}</small>
            </div>
            <ArrowRight size={20} className="card-arrow" />
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <Search size={32} />
            <p>No schools found matching "{search}"</p>
          </div>
        )}
      </section>

      <div className="landing-foot">
        <span>Montessori Group of Schools</span>
        <span>ERP Platform v1.0</span>
      </div>
    </main>
  );
}

// ─── Login Page ──────────────────────────────────────────────────────────
// School-specific or Super Admin login. No demo hints.

function Login({ onLogin, isSuperAdmin }: { onLogin: (session: NonNullable<Session>) => void; isSuperAdmin: boolean }) {
  const navigate = useNavigate();
  const { schoolId: paramSchoolId } = useParams();
  const [schools, setSchools] = useState<School[]>([]);
  const schoolId = isSuperAdmin ? 0 : Number(paramSchoolId || 1);
  const targetSchool = schools.find(s => s.id === schoolId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.schools().then(r => setSchools(r.data)).catch(() => undefined); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const result = await api.login({ schoolId: isSuperAdmin ? 0 : schoolId, email, password });
      token.set(result.token);
      onLogin({ user: result.user, school: result.school });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please check your credentials.");
    } finally { setLoading(false); }
  }

  return (
    <main className="login-page">
      <button className="back-link" onClick={() => navigate("/")}>
        <ArrowRight size={15} /> Back to schools
      </button>
      <section className="login-intro">
        <Brand light />
        <div>
          <span className="eyebrow light">{isSuperAdmin ? "GLOBAL PLATFORM" : "SECURE ACCESS"}</span>
          <h1>{isSuperAdmin ? "Platform Administration" : targetSchool?.name || "School Portal"}</h1>
          <p>{isSuperAdmin
            ? "Group-wide metrics, campus management, and platform oversight."
            : `${targetSchool?.city || ""} — Sign in with your staff credentials.`
          }</p>
        </div>
        <blockquote>"The education of even a small child does not aim at preparing him for school, but for life."<cite>— Maria Montessori</cite></blockquote>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <span className="step-label">{isSuperAdmin ? "SUPER ADMIN ACCESS" : "STAFF LOGIN"}</span>
          <h2>{isSuperAdmin ? "Platform Admin" : "Sign in"}</h2>
          <p className="muted">Enter your credentials to access the portal.</p>
          <ApiConnectionStatus compact />
          <label>
            Email address
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          <button
            type="button"
            className="text-button"
            onClick={() => navigate(`/forgot-password?schoolId=${schoolId}&email=${encodeURIComponent(email)}`)}
          >
            Forgot password?
          </button>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button wide" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"} <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

function PasswordRecovery({ mode }: { mode: "request" | "reset" }) {
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  const schoolId = Number(params.get("schoolId") || 0);
  const resetToken = params.get("token") || "";
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (mode === "reset" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const result = mode === "request"
        ? await api.forgotPassword({ schoolId, email })
        : await api.resetOwnPassword({ schoolId, token: resetToken, newPassword: password });
      setMessage(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password recovery failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <button className="back-link" onClick={() => navigate(schoolId ? `/login/${schoolId}` : "/super-admin")}>
        <ArrowRight size={15} /> Back to sign in
      </button>
      <section className="login-intro">
        <Brand light />
        <div>
          <span className="eyebrow light">SECURE ACCOUNT RECOVERY</span>
          <h1>{mode === "request" ? "Reset your password" : "Choose a new password"}</h1>
          <p>Recovery links are single-use and expire after 30 minutes.</p>
        </div>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <span className="step-label">PASSWORD RECOVERY</span>
          <h2>{mode === "request" ? "Find your account" : "Create new password"}</h2>
          {mode === "request" ? (
            <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          ) : (
            <>
              <label>New password<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" /></label>
              <label>Confirm password<input type="password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" /></label>
            </>
          )}
          {error && <div className="form-error">{error}</div>}
          {message && <div className="status-message success">{message}</div>}
          <button className="primary-button wide" disabled={loading || (mode === "reset" && !resetToken)}>
            {loading ? "Please wait..." : mode === "request" ? "Send reset link" : "Update password"} <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

// ─── Navigation Config ───────────────────────────────────────────────────

const navItems = [
  ["dashboard", "Overview", LayoutDashboard, "dashboard.view"],
  ["students", "Students", Users, "student.view"],
  ["certificates", "Certificates", FileBadge2, "certificate.view"],
  ["fees", "Fees & Accounts", WalletCards, "account.view"],
  ["documents", "Documents", FileBadge2, "student.document.upload"],
  ["events", "Events", Calendar, "event.view"],
  ["reports", "Reports", BarChart3, "report.view"],
  ["users", "Staff & Roles", Users, "user.manage"],
  ["settings", "Settings", Settings, "settings.view"]
] as const;

const superAdminNavItems = [
  ["dashboard", "Platform Overview", LayoutDashboard, "dashboard.view"],
  ["schools", "Campuses", GraduationCap, "dashboard.view"],
  ["students", "Students", Users, "student.view"],
  ["certificates", "Certificates", FileBadge2, "certificate.view"],
  ["fees", "Fees & Accounts", WalletCards, "account.view"],
  ["documents", "Documents", FileText, "student.document.upload"],
  ["events", "Events", Calendar, "event.view"],
  ["users", "Staff & Roles", Users, "user.manage"],
  ["reports", "Global Reports", BarChart3, "report.view"],
  ["settings", "School Settings", Settings, "settings.view"],
] as const;

// ─── Portal (Main App Shell) ─────────────────────────────────────────────

function Portal({ session, onLogout }: { session: NonNullable<Session>; onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const current = location.pathname.split("/")[1] || "dashboard";
  const creatingStudent = location.pathname === "/students/new";
  const managingImports = location.pathname === "/students/imports";
  const studentId = /^\/students\/(\d+)$/.exec(location.pathname)?.[1];
  const isSuperAdmin = session.user.role === "Group Super Admin";
  const permissions = new Set(session.user.permissions || []);
  const configuredNavItems = isSuperAdmin ? superAdminNavItems : navItems;
  const visibleNavItems = configuredNavItems.filter(([, , , permission]) => permissions.has(permission));
  const currentNavItem = configuredNavItems.find(([path]) => path === current);
  const canOpenCurrentModule = !currentNavItem || permissions.has(currentNavItem[3]);
  const [availableSchools, setAvailableSchools] = useState<School[]>([session.school]);
  const [activeSchool, setActiveSchool] = useState<School>(session.school);
  const scopedSession = { ...session, school: activeSchool };

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.schools().then(({ data }) => {
      setAvailableSchools(data);
      const savedId = Number(schoolScope.get());
      const selected = data.find(school => school.id === savedId) || data.find(school => school.id === session.school.id) || data[0];
      if (selected) {
        schoolScope.set(selected.id);
        setActiveSchool(selected);
      }
    }).catch(() => undefined);
  }, [isSuperAdmin, session.school.id]);

  const selectCampus = (school: School, destination?: string) => {
    schoolScope.set(school.id);
    setActiveSchool(school);
    setSearchQuery("");
    setSearchResults([]);
    if (destination) navigate(destination);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    api.notifications().then(r => {
      setNotifications(r.data.notifications);
      setUnreadCount(r.data.unreadCount);
    }).catch(() => undefined);
  }, [current, activeSchool.id]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    searchTimerRef.current = setTimeout(() => {
      setSearchLoading(true);
      api.search(value).then(r => { setSearchResults(r.data); setSearchOpen(true); }).catch(() => setSearchResults([])).finally(() => setSearchLoading(false));
    }, 300);
  }, []);

  const markAllRead = () => {
    api.markNotificationsRead().then(() => {
      setNotifications(n => n.map(x => ({ ...x, read: true })));
      setUnreadCount(0);
    }).catch(() => undefined);
  };

  const moduleIcons: Record<string, typeof Users> = { students: Users, events: Calendar, certificates: FileBadge2, fees: WalletCards, documents: FileText, users: Users };
  const typeColors: Record<string, string> = { student: "#6c5ce7", event: "#00b894", certificate: "#fdcb6e", receipt: "#0984e3", supplier: "#e17055", user: "#a29bfe" };

  return (
    <div className="portal">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="side-brand">
          <Brand light />
          <button className="icon-button mobile-only" onClick={() => setMenu(false)}><X /></button>
        </div>
        <div className="campus-card">
          <span className="campus-mark">
            <img src={GROUP_LOGO} alt="" aria-hidden="true" />
          </span>
          <div>
            <small>{isSuperAdmin ? "OPERATING CAMPUS" : "ASSIGNED CAMPUS"}</small>
            {isSuperAdmin ? (
              <select
                className="campus-switcher"
                aria-label="Operating campus"
                value={activeSchool.id}
                onChange={event => {
                  const selected = availableSchools.find(school => school.id === Number(event.target.value));
                  if (selected) selectCampus(selected);
                }}
              >
                {availableSchools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
            ) : <strong>{activeSchool.name}</strong>}
          </div>
        </div>
        <nav>
          <span className="nav-label">WORKSPACE</span>
          {visibleNavItems.map(([path, label, Icon]) => (
            <button key={path} className={current === path ? "active" : ""} onClick={() => { navigate(`/${path}`); setMenu(false); }}>
              <Icon size={19} /> {label}
            </button>
          ))}
        </nav>
        <div className="side-user">
          <span>{session.user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div><strong>{session.user.name}</strong><small>{session.user.role}</small></div>
          <button onClick={onLogout} title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <button className="icon-button mobile-only" onClick={() => setMenu(true)}><Menu /></button>
          <div className="header-search" ref={searchRef} style={{ position: "relative" }}>
            <Search size={18} />
            <input
              placeholder="Search students, events, certificates..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
            />
            {searchOpen && (
              <div className="search-dropdown" style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 10,
                maxHeight: 360, overflowY: "auto", zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,.4)"
              }}>
                {searchLoading ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "#8b8fa3" }}>Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "#8b8fa3" }}>No results found</div>
                ) : (
                  <>
                    {Object.entries(searchResults.reduce((acc, r) => { (acc[r.type] = acc[r.type] || []).push(r); return acc; }, {} as Record<string, SearchResult[]>)).map(([type, items]) => (
                      <div key={type}>
                        <div style={{ padding: "0.5rem 1rem", fontSize: 11, fontWeight: 700, color: "#8b8fa3", textTransform: "uppercase", letterSpacing: "0.05em" }}>{type}s</div>
                        {items.map(item => (
                          <button key={`${item.type}-${item.id}`} className="search-result-item" style={{
                            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "0.6rem 1rem",
                            background: "none", border: "none", color: "#e2e4e9", cursor: "pointer", textAlign: "left"
                          }} onClick={() => { navigate(`/${item.module}`); setSearchOpen(false); setSearchQuery(""); }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: `${typeColors[item.type] || "#6c5ce7"}22`, color: typeColors[item.type] || "#6c5ce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {(() => { const Ic = moduleIcons[item.module] || Users; return <Ic size={16} />; })()}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                              <div style={{ fontSize: 11, color: "#8b8fa3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="global-school-context">
            <span className="context-label">Current school</span>
            {isSuperAdmin ? (
              <select
                aria-label="Current school"
                value={activeSchool.id}
                onChange={event => {
                  const selected = availableSchools.find(school => school.id === Number(event.target.value));
                  if (selected) selectCampus(selected);
                }}
              >
                {availableSchools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
            ) : <strong>{activeSchool.name}</strong>}
          </div>
          <div className="academic-context" title="Current academic year">
            <small>Academic year</small>
            <strong>2026–27</strong>
          </div>
          <div className="header-actions">
            <button className="icon-button" aria-label="Help" title="Help"><CircleHelp size={19} /></button>
            <div ref={notifRef} style={{ position: "relative" }}>
              <button className="icon-button alert" aria-label="Notifications" title="Notifications" onClick={() => setNotifOpen(o => !o)} style={{ position: "relative" }}>
                <Bell size={19} />
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%",
                    background: "#e74c3c", color: "#fff", fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </button>
              {notifOpen && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 4, width: 340,
                  background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 10,
                  maxHeight: 400, overflowY: "auto", zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,.4)"
                }}>
                  <div style={{ padding: "0.8rem 1rem", borderBottom: "1px solid #2a2d3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 14 }}>Notifications</strong>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ background: "none", border: "none", color: "#6c5ce7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Mark all read</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "#8b8fa3", fontSize: 13 }}>No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} style={{
                        padding: "0.7rem 1rem", borderBottom: "1px solid #2a2d3e",
                        background: n.read ? "transparent" : "#6c5ce710",
                        opacity: n.read ? 0.6 : 1, cursor: "pointer"
                      }} onClick={() => { if (n.module) navigate(`/${n.module}`); setNotifOpen(false); }}>
                        <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: "#8b8fa3", marginTop: 2 }}>{n.message}</div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <button className="icon-button" aria-label="Settings" title="Settings" onClick={() => navigate("/settings")}><Settings size={19} /></button>
            <button className="icon-button future-control" aria-label="Dark mode coming soon" title="Dark mode coming soon"><Moon size={18} /></button>
            <div className="header-profile" title={`${session.user.name} · ${session.user.role}`}>
              <span>{session.user.name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div><strong>{session.user.name}</strong><small>{session.user.role}</small></div>
            </div>
          </div>
        </header>
        {!canOpenCurrentModule ? (
          <div className="page">
            <div className="form-error" role="alert">You do not have permission to open this module.</div>
          </div>
        ) : <React.Fragment key={`${activeSchool.id}:${current}`}>
          {current === "dashboard" && (isSuperAdmin
            ? <SuperAdminDashboard session={scopedSession} activeSchool={activeSchool} onSelectCampus={selectCampus} />
            : <Dashboard session={scopedSession} />)}
          {current === "students" && (creatingStudent ? <StudentCreatePage school={activeSchool} /> : managingImports ? <ImportPage /> : studentId ? <StudentProfilePage id={Number(studentId)} /> : <StudentsPage />)}
          {current === "schools" && isSuperAdmin && <SchoolsPage activeSchoolId={activeSchool.id} onSelectCampus={selectCampus} />}
          {current === "users" && <UsersPageFull />}
          {current === "certificates" && <CertificatesPage />}
          {current === "fees" && <AccountsPage />}
          {current === "documents" && <DocumentsPage />}
          {current === "events" && <EventsPage />}
          {current === "reports" && <ReportsPage />}
          {current === "settings" && <SettingsPage />}
          {!["dashboard", "students", "schools", "users", "certificates", "fees", "documents", "events", "reports", "settings"].includes(current) && (
            <ModulePlaceholder name={configuredNavItems.find(n => n[0] === current)?.[1] || "Module"} />
          )}
        </React.Fragment>}
      </main>
    </div>
  );
}

// ─── Super Admin Dashboard ───────────────────────────────────────────────
// Loads real data from API. No hardcoded statistics.

function SuperAdminDashboard({
  session, activeSchool, onSelectCampus
}: {
  session: NonNullable<Session>;
  activeSchool: School;
  onSelectCampus: (school: School, destination?: string) => void;
}) {
  const [data, setData] = useState<GroupOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.groupOverview()
      .then(result => setData(result.data))
      .catch(reason => setError(reason instanceof Error ? reason.message : "Group overview could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page super-command">
      <div className="page-title command-title">
        <div>
          <span className="eyebrow">GROUP CONTROL CENTRE</span>
          <h1>Every campus.<br />One clear view.</h1>
          <p>{session.user.name}, you can inspect and operate every active Montessori school.</p>
        </div>
        <div className="scope-seal">
          <Shield size={22} />
          <div><small>OPERATING NOW</small><strong>{activeSchool.name}</strong><span>{activeSchool.city}</span></div>
        </div>
      </div>
      {error ? <div className="form-error" role="alert">{error}</div> : loading ? (
        <section className="metrics"><Metric label="Loading..." value="..." note="Fetching group data" icon={Users} /></section>
      ) : data ? (
        <>
          <section className="metrics">
            <Metric label="Campuses" value={data.totals.schools} note="Active schools" icon={GraduationCap} />
            <Metric label="Students" value={data.totals.students} note="Across the group" icon={Users} />
            <Metric label="Fees collected" value={`₹${data.totals.fees.toLocaleString("en-IN")}`} note="All campuses" icon={WalletCards} />
            <Metric label="Staff accounts" value={data.totals.staff} note="Active users" icon={UserRound} accent />
          </section>
          <AccessResponsibilityPanel role="super" />
          <CampusPortfolio data={data} activeSchoolId={activeSchool.id} onSelectCampus={onSelectCampus} />
        </>
      ) : <div className="empty-state">No active campuses are configured.</div>}
    </div>
  );
}

function SchoolsPage({
  activeSchoolId, onSelectCampus
}: {
  activeSchoolId: number;
  onSelectCampus: (school: School, destination?: string) => void;
}) {
  const [data, setData] = useState<GroupOverview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.groupOverview().then(result => setData(result.data))
      .catch(reason => setError(reason instanceof Error ? reason.message : "Campuses could not be loaded."));
  }, []);
  return (
    <div className="page">
      <div className="page-title">
        <div><span className="eyebrow">CAMPUS DIRECTORY</span><h1>Choose where to work.</h1><p>Selection changes the secure school scope for every module.</p></div>
      </div>
      {error ? <div className="form-error" role="alert">{error}</div> : data
        ? <CampusPortfolio data={data} activeSchoolId={activeSchoolId} onSelectCampus={onSelectCampus} />
        : <section className="metrics"><Metric label="Loading..." value="..." note="Fetching campuses" icon={Building2} /></section>}
    </div>
  );
}

function CampusPortfolio({
  data, activeSchoolId, onSelectCampus
}: {
  data: GroupOverview;
  activeSchoolId: number;
  onSelectCampus: (school: School, destination?: string) => void;
}) {
  return (
    <section className="campus-portfolio">
      <div className="portfolio-heading">
        <div><span className="step-label">CAMPUS OPERATIONS</span><h2>School-by-school command</h2></div>
        <span>{data.schools.length} active campuses</span>
      </div>
      <div className="campus-ops-grid">
        {data.schools.map(school => (
          <article className={`campus-ops-card ${school.id === activeSchoolId ? "selected" : ""}`} key={school.id}>
            <div className="campus-ops-top">
              <span className="campus-index">{String(school.id).padStart(2, "0")}</span>
              {school.id === activeSchoolId && <span className="live-scope">ACTIVE SCOPE</span>}
            </div>
            <h3>{school.name}</h3>
            <p><Building2 size={14} /> {school.city || "Location not configured"}</p>
            <div className="campus-mini-metrics">
              <span><strong>{school.students}</strong>Students</span>
              <span><strong>{school.staff}</strong>Staff</span>
              <span><strong>{school.events}</strong>Events</span>
              <span><strong>₹{school.fees.toLocaleString("en-IN")}</strong>Fees</span>
            </div>
            <div className="campus-card-actions">
              <button className="primary-button" onClick={() => onSelectCampus(school, "/students")}>Manage school <ArrowRight size={15} /></button>
              <button className="secondary-button" onClick={() => onSelectCampus(school, "/dashboard")}>Set scope</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AccessResponsibilityPanel({ role }: { role: "super" | "school" }) {
  const isSuper = role === "super";
  const responsibilities = isSuper
    ? ["Operate every active campus", "Manage all users and school administrators", "Change academics, fees, events, certificates and settings", "Review group-wide reports and audit activity"]
    : ["Operate only the assigned campus", "Manage campus staff without granting Group Super Admin", "Maintain students, academics, fees, events and certificates", "Cannot read or change another school's records"];
  return (
    <section className={`access-contract ${isSuper ? "group" : "school"}`}>
      <div className="access-contract-intro">
        <Shield size={24} />
        <div><span>{isSuper ? "ALL-SCHOOL AUTHORITY" : "SINGLE-SCHOOL AUTHORITY"}</span><h2>{isSuper ? "Group Super Admin" : "School Admin"}</h2></div>
      </div>
      <div className="access-rules">
        {responsibilities.map(rule => <span key={rule}><CheckCircle2 size={16} /> {rule}</span>)}
      </div>
    </section>
  );
}

// ─── School Dashboard ────────────────────────────────────────────────────
// Role-based dashboard with extended widgets.

function Dashboard({ session }: { session: NonNullable<Session> }) {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [extData, setExtData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const role = session.user.role;

  useEffect(() => {
    Promise.allSettled([api.dashboard(), api.dashboardExtended()])
      .then(([base, ext]) => {
        if (base.status === "fulfilled") setData(base.value.data);
        else setLoadError(base.reason instanceof Error ? base.reason.message : "Dashboard data could not be loaded.");
        if (ext.status === "fulfilled") setExtData(ext.value.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const roleWidgets = getRoleWidgets(role);
  const quickActions = getQuickActions(role, navigate);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">{dayName}, {dateStr}</span>
          <h1>Welcome, {session.user.name.split(" ")[0]}.</h1>
          <p>{roleDashboardSubtitle(role)}</p>
        </div>
        {quickActions.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {quickActions.map((action, i) => (
              <button key={i} className="primary-button" onClick={action.onClick} style={{ fontSize: 13 }}>
                <action.icon size={16} /> {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loadError ? (
        <div className="form-error" role="alert">{loadError}</div>
      ) : loading ? (
        <section className="metrics">
          <Metric label="Loading..." value="..." note="Fetching data" icon={Users} />
        </section>
      ) : (
        <>
          <section className="metrics">
            {roleWidgets.map((w, i) => (
              <Metric
                key={i}
                label={w.label}
                value={dashboardMetricValue(w, data, extData)}
                note={w.note}
                icon={w.icon}
                accent={w.accent}
              />
            ))}
          </section>
          {role === "School Admin" && <AccessResponsibilityPanel role="school" />}

          <section className="dashboard-grid">
            {role !== "Parent" && (
              <article className="panel activity-panel">
                <div className="panel-head">
                  <div><span className="step-label">RECENT ACTIVITY</span><h3>Latest actions</h3></div>
                </div>
                <div className="activity-list">
                  {(extData?.recentActivity || data?.recent || []).slice(0, 8).map((item: any, i: number) => (
                    <div className="activity" key={i}>
                      <span className={`activity-icon tone-${i % 3}`}>
                        {item.module === "students" ? <Users size={17} /> :
                         item.module === "certificates" ? <FileBadge2 size={17} /> :
                         item.module === "fees" ? <WalletCards size={17} /> :
                         item.module === "events" ? <Calendar size={17} /> :
                         <FileBadge2 size={17} />}
                      </span>
                      <div>
                        <strong>{item.action || item.title}</strong>
                        <small>{item.detail || item.meta}</small>
                      </div>
                      <time>{item.time}</time>
                    </div>
                  ))}
                  {(!extData?.recentActivity && !data?.recent) && <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>No recent activity.</p>}
                </div>
              </article>
            )}

            {extData?.pendingTasks && extData.pendingTasks.length > 0 && (
              <article className="panel">
                <div className="panel-head">
                  <div><span className="step-label">PENDING TASKS</span><h3>Needs attention</h3></div>
                </div>
                <div style={{ padding: "0.5rem 1rem" }}>
                  {extData.pendingTasks.map((task: any) => (
                    <button key={task.id} style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "0.7rem 0",
                      background: "none", border: "none", borderBottom: "1px solid var(--line)",
                      color: "var(--ink)", cursor: "pointer", textAlign: "left"
                    }} onClick={() => navigate(`/${task.module}`)}>
                      <span style={{
                        width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                        background: task.count > 0 ? "#e74c3c22" : "#00b89422",
                        color: task.count > 0 ? "#e74c3c" : "#00b894", flexShrink: 0
                      }}>
                        {task.count > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{task.task}</div>
                      </div>
                      {task.count > 0 && (
                        <span style={{
                          background: "#e74c3c22", color: "#e74c3c", padding: "2px 8px", borderRadius: 12,
                          fontSize: 11, fontWeight: 700
                        }}>{task.count}</span>
                      )}
                      <ArrowRight size={14} style={{ color: "#8b8fa3" }} />
                    </button>
                  ))}
                </div>
              </article>
            )}

            {data?.enrollmentByClass && data.enrollmentByClass.length > 0 && (
              <article className="panel chart-panel">
                <div className="panel-head">
                  <div><span className="step-label">ENROLMENT</span><h3>Students by class</h3></div>
                  <button className="text-button" onClick={() => navigate("/reports")}>View report <ArrowRight size={15} /></button>
                </div>
                <div className="bar-chart">
                  {data.enrollmentByClass.map((item: any) => {
                    const max = Math.max(...data.enrollmentByClass.map((v: any) => v.value), 1);
                    return (
                      <div className="bar-item" key={item.label}>
                        <span>{item.value}</span>
                        <i style={{ height: `${Math.max(12, item.value / max * 100)}%` }} />
                        <small>{item.label}</small>
                      </div>
                    );
                  })}
                </div>
              </article>
            )}

            <QuickActionsPanel role={role} navigate={navigate} />
          </section>
        </>
      )}
    </div>
  );
}

function roleDashboardSubtitle(role: string): string {
  switch (role) {
    case "School Admin": return "Full overview of your school operations.";
    case "Principal": return "Academic overview and key metrics.";
    case "Office Staff": return "Student and document operations at a glance.";
    case "Teacher": return "Your class activity and events.";
    case "Accountant": return "Financial overview and fee collection status.";
    case "Parent": return "Your children's activity and updates.";
    default: return "Here's the pulse of your school today.";
  }
}

function getRoleWidgets(role: string) {
  switch (role) {
    case "School Admin":
      return [
        { label: "Students", altKey: "students", note: "All enrolled", icon: Users },
        { label: "Events", altKey: "events", note: "All school events", icon: Calendar },
        { label: "Fees", altKey: "fees", note: "Total collected", icon: WalletCards, currency: true },
        { label: "Certificates", altKey: "certificates", note: "All generated", icon: Award, accent: true },
      ];
    case "Principal":
      return [
        { label: "Total students", key: "totalStudents", altKey: "students", note: "Enrolled this year", icon: Users },
        { label: "Active students", key: "activeStudents", altKey: "active", note: "Currently enrolled", icon: UserRound },
        { label: "Pending certificates", key: "pendingCertificates", altKey: "pendingCertificates", note: "Awaiting approval", icon: FileBadge2 },
        { label: "Draft events", key: "draftEvents", note: "Not yet published", icon: Calendar },
      ];
    case "Office Staff":
      return [
        { label: "Total students", key: "totalStudents", altKey: "students", note: "Current year", icon: Users },
        { label: "Pending certificates", key: "pendingCertificates", altKey: "pendingCertificates", note: "To process", icon: FileBadge2 },
        { label: "Fees collected today", key: "feesCollectedToday", note: "Daily collection", icon: WalletCards },
        { label: "Active students", key: "activeStudents", altKey: "active", note: "Currently enrolled", icon: UserRound },
      ];
    case "Teacher":
      return [
        { label: "Active students", key: "activeStudents", altKey: "active", note: "In your classes", icon: Users },
        { label: "Upcoming events", key: "draftEvents", note: "This month", icon: Calendar },
        { label: "Fees collected", key: "feesCollectedToday", note: "Today", icon: WalletCards },
        { label: "Pending tasks", key: "pendingCertificates", altKey: "pendingCertificates", note: "Action needed", icon: Clock },
      ];
    case "Accountant":
      return [
        { label: "Fees collected today", key: "feesCollectedToday", note: "Daily collection", icon: WalletCards },
        { label: "Pending payments", key: "unpaidFees", note: "Students with dues", icon: CreditCard, accent: true },
        { label: "Total students", key: "totalStudents", altKey: "students", note: "All enrolled", icon: Users },
        { label: "Active students", key: "activeStudents", altKey: "active", note: "Currently active", icon: UserRound },
      ];
    case "Parent":
      return [
        { label: "My children", key: "totalStudents", altKey: "students", note: "Enrolled", icon: Users },
        { label: "Fees pending", key: "unpaidFees", note: "Outstanding", icon: WalletCards },
        { label: "Certificates", key: "pendingCertificates", altKey: "pendingCertificates", note: "Available", icon: FileBadge2 },
        { label: "Events", key: "draftEvents", note: "Upcoming", icon: Calendar },
      ];
    default:
      return [
        { label: "Total students", key: "totalStudents", altKey: "students", note: "Across current year", icon: Users },
        { label: "Active students", key: "activeStudents", altKey: "active", note: "Currently enrolled", icon: UserRound },
        { label: "Campuses", key: "schools", altKey: "schools", note: "All systems online", icon: GraduationCap },
        { label: "TC requests", key: "pendingCertificates", altKey: "pendingCertificates", note: "Awaiting approval", icon: Award, accent: true },
      ];
  }
}

function dashboardMetricValue(widget: { key?: string; altKey?: string; currency?: boolean }, data: any, extData: any) {
  const value = (widget.key ? extData?.[widget.key] : undefined)
    ?? (widget.altKey ? data?.totals?.[widget.altKey] : undefined)
    ?? 0;
  return widget.currency ? `₹${Number(value).toLocaleString("en-IN")}` : value;
}

function getQuickActions(role: string, navigate: any) {
  const actions: { label: string; icon: typeof Users; onClick: () => void }[] = [];
  if (["School Admin", "Office Staff", "Principal"].includes(role)) {
    actions.push({ label: "Add Student", icon: Plus, onClick: () => navigate("/students/new") });
  }
  if (["School Admin", "Principal", "Office Staff"].includes(role)) {
    actions.push({ label: "Create Event", icon: Calendar, onClick: () => navigate("/events") });
  }
  if (["School Admin", "Accountant", "Office Staff"].includes(role)) {
    actions.push({ label: "Record Payment", icon: WalletCards, onClick: () => navigate("/fees") });
  }
  if (["School Admin", "Office Staff"].includes(role)) {
    actions.push({ label: "Issue Certificate", icon: FileBadge2, onClick: () => navigate("/certificates") });
  }
  return actions;
}

function QuickActionsPanel({ role, navigate }: { role: string; navigate: any }) {
  const actions: { label: string; desc: string; icon: typeof Users; path: string; color: string }[] = [];

  if (["School Admin", "Office Staff", "Principal"].includes(role)) {
    actions.push({ label: "Add Student", desc: "New admission", icon: Users, path: "/students/new", color: "#6c5ce7" });
  }
  if (["School Admin", "Principal", "Office Staff"].includes(role)) {
    actions.push({ label: "Create Event", desc: "Plan event", icon: Calendar, path: "/events", color: "#00b894" });
  }
  if (["School Admin", "Accountant", "Office Staff"].includes(role)) {
    actions.push({ label: "Record Payment", desc: "Collect fee", icon: WalletCards, path: "/fees", color: "#0984e3" });
  }
  if (["School Admin", "Office Staff"].includes(role)) {
    actions.push({ label: "Issue Certificate", desc: "Generate TC", icon: FileBadge2, path: "/certificates", color: "#fdcb6e" });
  }
  if (["School Admin", "Teacher"].includes(role)) {
    actions.push({ label: "View Reports", desc: "Analytics", icon: BarChart3, path: "/reports", color: "#e17055" });
  }

  if (actions.length === 0) return null;

  return (
    <article className="panel">
      <div className="panel-head">
        <div><span className="step-label">QUICK ACTIONS</span><h3>Shortcuts</h3></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, padding: "0.75rem 1rem" }}>
        {actions.map((a, i) => (
          <button key={i} onClick={() => navigate(a.path)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            padding: "1rem 0.5rem", background: "#1a1d2e", border: "1px solid #2a2d3e",
            borderRadius: 10, cursor: "pointer", color: "#e2e4e9", transition: "border-color 0.15s"
          }} onMouseEnter={e => (e.currentTarget.style.borderColor = a.color)} onMouseLeave={e => (e.currentTarget.style.borderColor = "#2a2d3e")}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: `${a.color}22`, color: a.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <a.icon size={18} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</span>
            <span style={{ fontSize: 10, color: "#8b8fa3" }}>{a.desc}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function Metric({ label, value, note, icon: Icon, accent = false }: { label: string; value: string | number; note: string; icon: typeof Users; accent?: boolean }) {
  return (
    <article className={accent ? "metric accent" : "metric"}>
      <span className="metric-icon"><Icon size={20} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <p><span className="status-dot" /> {note}</p>
    </article>
  );
}

function ModulePlaceholder({ name }: { name: string }) {
  return (
    <div className="page">
      <div className="module-placeholder">
        <span><Sparkles /></span>
        <p className="eyebrow">COMING SOON</p>
        <h1>{name}</h1>
        <p>This module is under development and will be available in a future release.</p>
      </div>
    </div>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={light ? "brand light" : "brand"}>
      <span className="brand-logo-shell">
        <img className="brand-logo" src={GROUP_LOGO} alt="Montessori Golden Jubilee emblem" />
      </span>
      <div><strong>Montessori</strong><small>SCHOOL PORTAL</small></div>
    </div>
  );
}

export default App;
