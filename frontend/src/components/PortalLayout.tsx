import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, CircleHelp, LogOut, Menu, Moon, Search, Settings, X, Users,
  Calendar, FileBadge2, WalletCards, FileText
} from "lucide-react";
import { api, Notification, School, SearchResult, schoolScope } from "../api";
import { Brand } from "../App";

const GROUP_LOGO = "/montessori-golden-jubilee-logo.jpeg";

const moduleIcons: Record<string, typeof Users> = {
  students: Users, events: Calendar, certificates: FileBadge2,
  fees: WalletCards, documents: FileText, users: Users
};

const typeColors: Record<string, string> = {
  student: "#002147", event: "#2e8b57", certificate: "#e6a700",
  receipt: "#3a7bd5", supplier: "#d9534f", user: "#002147"
};

interface PortalLayoutProps {
  children: React.ReactNode;
  session: { user: { name: string; role: string }; school: School };
  isSuperAdmin: boolean;
  activeSchool: School;
  availableSchools: School[];
  academicYears: string[];
  activeAcademicYear: string;
  onSelectCampus: (school: School) => void;
  onSelectAcademicYear: (year: string) => void;
  onLogout: () => void;
  currentModule: string;
  navItems: [string, string, typeof Users, string][];
}

export function PortalLayout({
  children,
  session,
  isSuperAdmin,
  activeSchool,
  availableSchools,
  academicYears,
  activeAcademicYear,
  onSelectCampus,
  onSelectAcademicYear,
  onLogout,
  currentModule,
  navItems,
}: PortalLayoutProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Notifications
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
  }, [currentModule, activeSchool.id]);

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

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-logo">
              <img src={GROUP_LOGO} alt="" aria-hidden="true" />
            </div>
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-name">Montessori</div>
              <div className="sidebar-brand-role">{isSuperAdmin ? "Platform Admin" : session.user.role}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm mobile-menu-btn" onClick={() => setMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-label">Workspace</div>
            {navItems.map(([path, label, Icon]) => (
              <button
                key={path}
                className={`sidebar-link ${currentModule === path ? "active" : ""}`}
                onClick={() => { navigate(`/${path}`); setMenuOpen(false); }}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={onLogout}>
            <div className="sidebar-user-avatar">
              {session.user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{session.user.name}</div>
              <div className="sidebar-user-email">{session.user.role}</div>
            </div>
            <LogOut size={16} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* Backdrop */}
      <div
        className={`sidebar-backdrop ${menuOpen ? "visible" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Workspace */}
      <main className="workspace">
        <header className="workspace-header">
          <div className="workspace-header-left">
            <button className="btn btn-ghost btn-icon mobile-menu-btn" onClick={() => setMenuOpen(true)}>
              <Menu size={18} />
            </button>
            <div className="school-context">
              <img src={GROUP_LOGO} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: "cover" }} />
              <span className="school-context-name">{activeSchool.name}</span>
            </div>
          </div>

          <div className="workspace-header-center">
            <div className="header-search search-box" ref={searchRef}>
              <Search size={15} />
              <input
                placeholder="Search students, events, certificates..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
              />
              {searchOpen && (
                <div className="dropdown" style={{ left: 0, right: 0, width: "100%", maxHeight: 360, overflowY: "auto" }}>
                  {searchLoading ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-tertiary)" }}>
                      <div className="spinner" style={{ margin: "0 auto 8px" }} /> Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-tertiary)" }}>No results found</div>
                  ) : (
                    Object.entries(searchResults.reduce((acc, r) => { (acc[r.type] = acc[r.type] || []).push(r); return acc; }, {} as Record<string, SearchResult[]>)).map(([type, items]) => (
                      <div key={type}>
                        <div style={{ padding: "8px 16px", fontSize: 10, fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{type}s</div>
                        {items.map(item => (
                          <button key={`${item.type}-${item.id}`} className="dropdown-item" onClick={() => { navigate(`/${item.module}`); setSearchOpen(false); setSearchQuery(""); }}>
                            <span style={{ width: 28, height: 28, borderRadius: 8, background: `${typeColors[item.type] || "#002147"}15`, color: typeColors[item.type] || "#002147", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {(() => { const Ic = moduleIcons[item.module] || Users; return <Ic size={14} />; })()}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="workspace-header-right">
            {isSuperAdmin && (
              <select
                className="input select"
                style={{ maxWidth: 180, minHeight: 36, fontSize: 13, borderRadius: "var(--radius-md)" }}
                aria-label="Academic year"
                value={activeAcademicYear}
                onChange={e => onSelectAcademicYear(e.target.value)}
              >
                <option value="">All years</option>
                {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            )}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button className="header-icon-btn" aria-label="Notifications" onClick={() => setNotifOpen(o => !o)}>
                <Bell size={18} />
                {unreadCount > 0 && <span className="notification-dot" />}
              </button>
              {notifOpen && (
                <div className="dropdown" style={{ width: 340, maxHeight: 400, overflowY: "auto", right: 0 }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        className="dropdown-item"
                        style={{ flexDirection: "column", alignItems: "flex-start", opacity: n.read ? 0.6 : 1 }}
                        onClick={() => { if (n.module) navigate(`/${n.module}`); setNotifOpen(false); }}
                      >
                        <span style={{ fontWeight: n.read ? 400 : 600 }}>{n.title}</span>
                        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{n.message}</span>
                        <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{new Date(n.createdAt).toLocaleString()}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button className="header-icon-btn" aria-label="Settings" title="Settings" onClick={() => navigate("/settings")}>
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="workspace-content">
          {children}
        </div>
      </main>
    </div>
  );
}
