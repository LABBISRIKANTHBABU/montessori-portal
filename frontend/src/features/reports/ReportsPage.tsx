import { useState, useEffect } from "react";
import {
  BarChart3, Users, Award, WalletCards, Calendar, FolderOpen,
  TrendingUp, ChevronDown, ChevronUp, Download, LayoutDashboard,
  UserCheck, GraduationCap, Heart
} from "lucide-react";
import { api } from "../../api";

const DATE_RANGE_REPORTS = new Set(["enrollment", "status", "fees", "certificates", "events", "documents", "attendance"]);

const REPORT_CARDS = [
  { id: "enrollment", label: "Enrollment Report", icon: Users, hasDateRange: true },
  { id: "status", label: "Status Report", icon: TrendingUp, hasDateRange: true },
  { id: "fees", label: "Fee Collection Report", icon: WalletCards, hasDateRange: true },
  { id: "certificates", label: "Certificates Report", icon: Award, hasDateRange: true },
  { id: "financial", label: "Financial Summary", icon: BarChart3, hasDateRange: false },
  { id: "events", label: "Events Report", icon: Calendar, hasDateRange: true },
  { id: "documents", label: "Documents Report", icon: FolderOpen, hasDateRange: true },
  { id: "attendance", label: "Attendance Report", icon: UserCheck, hasDateRange: true },
  { id: "staff", label: "Staff Report", icon: GraduationCap, hasDateRange: false },
  { id: "parents", label: "Parent Report", icon: Heart, hasDateRange: false },
] as const;

export default function ReportsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [financialData, setFinancialData] = useState<any>(null);
  const [dateRange, setDateRange] = useState<Record<string, { from: string; to: string }>>({});
  const [dashboard, setDashboard] = useState<any>(null);
  const [dashLoading, setDashLoading] = useState(true);

  useEffect(() => {
    api.reportsDashboard().then(r => setDashboard(r.data)).catch(() => {}).finally(() => setDashLoading(false));
  }, []);

  function setReportDate(id: string, field: "from" | "to", value: string) {
    setDateRange(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { from: "", to: "" }), [field]: value }
    }));
  }

  async function loadReport(id: string) {
    if (data[id] || financialData) { setExpanded(expanded === id ? null : id); return; }
    setLoading(l => ({ ...l, [id]: true }));
    try {
      const dr = dateRange[id] || { from: "", to: "" };
      if (id === "financial") {
        const r = await api.financialSummary();
        setFinancialData(r.data);
      } else {
        const fnMap: Record<string, () => Promise<{ data: any[] }>> = {
          enrollment: () => api.enrollmentReport(dr.from, dr.to),
          status: () => api.statusReport(dr.from, dr.to),
          fees: () => api.feeCollectionReport("", dr.from, dr.to),
          certificates: () => api.certificateReport(dr.from, dr.to),
          events: () => api.eventReport(dr.from, dr.to),
          documents: () => api.documentReport(dr.from, dr.to),
          attendance: () => api.attendanceReport(dr.from, dr.to),
          staff: () => api.staffReport(),
          parents: () => api.parentReport(),
        };
        const r = await fnMap[id]();
        setData(d => ({ ...d, [id]: r.data }));
      }
      setExpanded(id);
    } catch {
      setData(d => ({ ...d, [id]: [] }));
      setExpanded(id);
    } finally {
      setLoading(l => ({ ...l, [id]: false }));
    }
  }

  function getExportUrl(id: string): string {
    const dr = dateRange[id] || { from: "", to: "" };
    const urlMap: Record<string, string> = {
      enrollment: api.enrollmentReportExport(dr.from, dr.to),
      status: api.statusReportExport(dr.from, dr.to),
      fees: api.feeCollectionReportExport("", dr.from, dr.to),
      certificates: api.certificateReportExport(dr.from, dr.to),
      financial: api.financialSummaryExport(dr.from, dr.to),
      events: api.eventReportExport(dr.from, dr.to),
      documents: api.documentReportExport(dr.from, dr.to),
      attendance: api.attendanceReportExport(dr.from, dr.to),
      staff: api.staffReportExport(),
      parents: api.parentReportExport(),
    };
    return urlMap[id] || "#";
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">REPORTS</span>
          <h1>Reports</h1>
          <p>View and export detailed reports across all modules.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" disabled>
            <Download size={17} /> Export all
          </button>
        </div>
      </div>

      {/* Dashboard Summary */}
      <section className="panel" style={{ marginBottom: 24 }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
          <LayoutDashboard size={20} style={{ color: "var(--forest)" }} />
          <strong style={{ fontSize: 15 }}>Reports Dashboard</strong>
        </div>
        {dashLoading ? (
          <p style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}>Loading dashboard...</p>
        ) : dashboard ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 0 }}>
            {[
              { label: "Total Students", value: dashboard.totalStudents },
              { label: "Active Students", value: dashboard.activeStudents },
              { label: "Today Collected", value: `₹${Number(dashboard.todayCollected).toLocaleString()}` },
              { label: "Pending Certificates", value: dashboard.pendingCertificates },
              { label: "Upcoming Events", value: dashboard.upcomingEvents },
              { label: "Docs (7 days)", value: dashboard.documentsUploaded },
            ].map((item, i) => (
              <div key={i} style={{
                padding: "16px 20px", borderRight: i < 5 ? "1px solid var(--line)" : "none",
                borderBottom: "1px solid var(--line)"
              }}>
                <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {item.label}
                </small>
                <strong style={{ fontSize: 22, display: "block", marginTop: 4 }}>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}>Could not load dashboard data.</p>
        )}
      </section>

      <section style={{ display: "grid", gap: 16 }}>
        {REPORT_CARDS.map(card => {
          const isLoading = loading[card.id];
          const isExpanded = expanded === card.id;
          const reportData = card.id === "financial" ? financialData : data[card.id];
          const Icon = card.icon;
          const dr = dateRange[card.id] || { from: "", to: "" };

          return (
            <div key={card.id} className="panel" style={{ padding: 0 }}>
              <button
                onClick={() => loadReport(card.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 16,
                  padding: "20px 24px", border: "none", background: "transparent",
                  cursor: "pointer", textAlign: "left", color: "inherit"
                }}
              >
                <span style={{
                  width: 44, height: 44, borderRadius: 10, background: "var(--cream)",
                  display: "grid", placeItems: "center", color: "var(--forest)", flexShrink: 0
                }}>
                  <Icon size={22} />
                </span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 15 }}>{card.label}</strong>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                    {isLoading ? "Loading..." : reportData ? `${Array.isArray(reportData) ? reportData.length : "View"} records` : "Click to load report"}
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {isExpanded && (
                <div style={{ padding: "0 24px 24px", borderTop: "1px solid var(--line)" }}>
                  {card.hasDateRange && (
                    <div style={{ display: "flex", gap: 12, marginTop: 16, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <label style={{ fontSize: 13, fontWeight: 600 }}>From:</label>
                      <input
                        type="date"
                        value={dr.from}
                        onChange={e => setReportDate(card.id, "from", e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                      />
                      <label style={{ fontSize: 13, fontWeight: 600 }}>To:</label>
                      <input
                        type="date"
                        value={dr.to}
                        onChange={e => setReportDate(card.id, "to", e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                      />
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setData(d => {
                            const copy = { ...d };
                            delete copy[card.id];
                            return copy;
                          });
                          setFinancialData(null);
                          loadReport(card.id);
                        }}
                        style={{ fontSize: 13 }}
                      >
                        Apply
                      </button>
                    </div>
                  )}

                  {isLoading ? (
                    <p style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>Loading report data...</p>
                  ) : card.id === "financial" && financialData ? (
                    <FinancialDetail data={financialData} />
                  ) : Array.isArray(reportData) && reportData.length > 0 ? (
                    <ReportTable data={reportData} />
                  ) : (
                    <p style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>No data available.</p>
                  )}
                  <div style={{ marginTop: 12, textAlign: "right" }}>
                    <a
                      href={getExportUrl(card.id)}
                      className="secondary-button"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "inherit" }}
                    >
                      <Download size={16} /> Export CSV
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function ReportTable({ data }: { data: any[] }) {
  if (!data.length) return null;
  const columns = Object.keys(data[0]);
  return (
    <div className="table-scroll" style={{ marginTop: 16 }}>
      <table>
        <thead>
          <tr>
            {columns.map(col => <th key={col} style={{ textTransform: "capitalize" }}>{col.replace(/([A-Z])/g, " $1").trim()}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => <td key={col}>{row[col] ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinancialDetail({ data }: { data: any }) {
  return (
    <div className="form-grid" style={{ gap: 12, marginTop: 16 }}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} style={{ padding: 16, background: "var(--cream)", borderRadius: 8 }}>
          <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
            {key.replace(/([A-Z])/g, " $1").trim()}
          </small>
          <strong style={{ fontSize: 20, display: "block", marginTop: 4 }}>
            {typeof value === "number" ? `₹${value.toLocaleString()}` : String(value)}
          </strong>
        </div>
      ))}
    </div>
  );
}
