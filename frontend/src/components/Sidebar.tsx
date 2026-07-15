import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, GraduationCap, Calendar, FileBadge2, WalletCards,
  FileText, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight,
  Shield, Search, BookOpen, ClipboardList, Award, CreditCard,
  Bell, MessageSquare, HelpCircle, PanelLeftClose, PanelLeft
} from "lucide-react";
import type { School } from "../api";

const GROUP_LOGO = "/montessori-golden-jubilee-logo.jpeg";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  permission: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function getNavGroups(isSuperAdmin: boolean): NavGroup[] {
  if (isSuperAdmin) {
    return [
      {
        label: "Overview",
        items: [
          { path: "dashboard", label: "Platform Overview", icon: <LayoutDashboard size={18} />, permission: "dashboard.view" },
        ],
      },
      {
        label: "Administration",
        items: [
          { path: "schools", label: "Campuses", icon: <GraduationCap size={18} />, permission: "dashboard.view" },
          { path: "users", label: "Staff & Roles", icon: <Users size={18} />, permission: "user.manage" },
        ],
      },
      {
        label: "Academics",
        items: [
          { path: "students", label: "Students", icon: <Users size={18} />, permission: "student.view" },
          { path: "certificates", label: "Certificates", icon: <FileBadge2 size={18} />, permission: "certificate.view" },
        ],
      },
      {
        label: "Finance",
        items: [
          { path: "fees", label: "Fees & Accounts", icon: <WalletCards size={18} />, permission: "account.view" },
        ],
      },
      {
        label: "Communication",
        items: [
          { path: "events", label: "Events", icon: <Calendar size={18} />, permission: "event.view" },
          { path: "documents", label: "Documents", icon: <FileText size={18} />, permission: "student.document.upload" },
        ],
      },
      {
        label: "Reports",
        items: [
          { path: "reports", label: "Global Reports", icon: <BarChart3 size={18} />, permission: "report.view" },
        ],
      },
      {
        label: "System",
        items: [
          { path: "settings", label: "Settings", icon: <Settings size={18} />, permission: "settings.view" },
        ],
      },
    ];
  }

  return [
    {
      label: "Overview",
      items: [
        { path: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} />, permission: "dashboard.view" },
      ],
    },
    {
      label: "Academics",
      items: [
        { path: "students", label: "Students", icon: <Users size={18} />, permission: "student.view" },
        { path: "certificates", label: "Certificates", icon: <FileBadge2 size={18} />, permission: "certificate.view" },
      ],
    },
    {
      label: "Finance",
      items: [
        { path: "fees", label: "Fees & Accounts", icon: <WalletCards size={18} />, permission: "account.view" },
      ],
    },
    {
      label: "Communication",
      items: [
        { path: "events", label: "Events", icon: <Calendar size={18} />, permission: "event.view" },
        { path: "documents", label: "Documents", icon: <FileText size={18} />, permission: "student.document.upload" },
      ],
    },
    {
      label: "Reports",
      items: [
        { path: "reports", label: "Reports", icon: <BarChart3 size={18} />, permission: "report.view" },
      ],
    },
    {
      label: "Administration",
      items: [
        { path: "users", label: "Staff & Roles", icon: <Users size={18} />, permission: "user.manage" },
        { path: "settings", label: "Settings", icon: <Settings size={18} />, permission: "settings.view" },
      ],
    },
  ];
}

interface SidebarProps {
  session: { user: { name: string; role: string; permissions?: string[] }; school: School };
  isSuperAdmin: boolean;
  activeSchool: School;
  availableSchools: School[];
  currentModule: string;
  onSelectCampus: (school: School) => void;
  onLogout: () => void;
  open: boolean;
  onToggle: () => void;
}

export function Sidebar({
  session,
  isSuperAdmin,
  activeSchool,
  availableSchools,
  currentModule,
  onSelectCampus,
  onLogout,
  open,
  onToggle,
}: SidebarProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const navGroups = getNavGroups(isSuperAdmin);
  const permissions = new Set(session.user.permissions || []);

  const userInitials = session.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Backdrop for mobile */}
      {open && <div className="sidebar-backdrop visible" onClick={onToggle} />}

      <aside className={`sidebar ${open ? "open" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}>
        {/* Brand */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-logo">
              <img src={GROUP_LOGO} alt="" aria-hidden="true" />
            </div>
            {!collapsed && (
              <div className="sidebar-brand-text">
                <div className="sidebar-brand-name">Montessori</div>
                <div className="sidebar-brand-role">{isSuperAdmin ? "Platform Admin" : activeSchool.name}</div>
              </div>
            )}
          </div>
          <button
            className="btn btn-ghost btn-icon btn-sm sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => permissions.has(item.permission));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="sidebar-section">
                {!collapsed && <div className="sidebar-section-label">{group.label}</div>}
                {visibleItems.map((item) => (
                  <button
                    key={item.path}
                    className={`sidebar-link ${currentModule === item.path ? "active" : ""}`}
                    onClick={() => { navigate(`/${item.path}`); onToggle(); }}
                    title={collapsed ? item.label : undefined}
                  >
                    {item.icon}
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Footer / Profile */}
        <div className="sidebar-footer">
          {!collapsed && isSuperAdmin && availableSchools.length > 1 && (
            <div className="sidebar-school-select">
              <select
                value={activeSchool.id}
                onChange={(e) => {
                  const school = availableSchools.find((s) => s.id === Number(e.target.value));
                  if (school) onSelectCampus(school);
                }}
              >
                {availableSchools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="sidebar-user" onClick={onLogout} title="Sign out">
            <div className="sidebar-user-avatar">{userInitials}</div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{session.user.name}</div>
                <div className="sidebar-user-email">{session.user.role}</div>
              </div>
            )}
            {!collapsed && <LogOut size={15} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />}
          </div>
        </div>
      </aside>
    </>
  );
}
