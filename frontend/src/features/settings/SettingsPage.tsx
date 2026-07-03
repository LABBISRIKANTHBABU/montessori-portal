import { useState, useEffect, FormEvent } from "react";
import {
  Settings, GraduationCap, BookOpen, Shield, FileText, Activity,
  Upload, Save, Plus, X, ChevronDown, ChevronUp, Pencil, Trash2, Database
} from "lucide-react";
import { api } from "../../api";

const TABS = [
  { id: "school", label: "School Settings", icon: Settings },
  { id: "academic", label: "Academic Years", icon: GraduationCap },
  { id: "boards", label: "Boards", icon: BookOpen },
  { id: "classes", label: "Classes", icon: BookOpen },
  { id: "audit", label: "Audit Log", icon: Shield },
  { id: "system", label: "System Logs", icon: Activity }
];

export default function SettingsPage() {
  const [tab, setTab] = useState("school");
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">SETTINGS</span>
          <h1>Settings</h1>
          <p>Configure school, academic setup and view system logs.</p>
        </div>
      </div>
      <nav className="page-tabs">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </nav>
      <div className="profile-content">
        {tab === "school" && <SchoolSettingsTab />}
        {tab === "academic" && <AcademicYearsTab />}
        {tab === "boards" && <BoardsTab />}
        {tab === "classes" && <ClassesTab />}
        {tab === "audit" && <AuditLogTab />}
        {tab === "system" && <SystemLogsTab />}
      </div>
    </div>
  );
}

function SchoolSettingsTab() {
  const [settings, setSettings] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [secSigFile, setSecSigFile] = useState<File | null>(null);
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.settings().then(r => setSettings(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave(key: string, value: string) {
    setSaving(true);
    try {
      await api.updateSetting(key, value);
      setSettings(s => ({ ...s, [key]: value }));
      setMsg("Setting saved");
      setTimeout(() => setMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload() {
    if (!logoFile) return;
    const form = new FormData();
    form.append("file", logoFile);
    try {
      await api.uploadLogo(form);
      setLogoFile(null);
      setMsg("Logo uploaded");
      setTimeout(() => setMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    }
  }

  async function handleSigUpload() {
    if (!sigFile) return;
    const form = new FormData();
    form.append("file", sigFile);
    try {
      await api.uploadSignature(form);
      setSigFile(null);
      setMsg("Signature uploaded");
      setTimeout(() => setMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    }
  }

  async function handleSecSigUpload() {
    if (!secSigFile) return;
    const form = new FormData();
    form.append("file", secSigFile);
    try {
      await api.uploadSecretarySignature(form);
      setSecSigFile(null);
      setMsg("Secretary signature uploaded");
      setTimeout(() => setMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    }
  }

  async function handleStampUpload() {
    if (!stampFile) return;
    const form = new FormData();
    form.append("file", stampFile);
    try {
      await api.uploadStamp(form);
      setStampFile(null);
      setMsg("School stamp uploaded");
      setTimeout(() => setMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    }
  }

  async function handleBackup() {
    setBackingUp(true);
    try {
      const result = await api.backupDatabase();
      setMsg(`Backup initiated: ${result.data.backupId}`);
      setTimeout(() => setMsg(""), 5000);
    } catch (err: any) {
      alert(err.message || "Backup failed");
    } finally {
      setBackingUp(false);
    }
  }

  if (loading) return <p>Loading settings...</p>;

  return (
    <section className="panel" style={{ padding: 24 }}>
      <span className="step-label">SCHOOL CONFIGURATION</span>
      {msg && <div style={{ padding: "8px 12px", background: "#e8f5e9", borderRadius: 6, marginTop: 8, fontSize: 13, color: "var(--forest)" }}>{msg}</div>}

      <div className="form-grid" style={{ marginTop: 16 }}>
        <label>
          School Name
          <div style={{ display: "flex", gap: 8 }}>
            <input
              defaultValue={settings.school_name || ""}
              onBlur={e => handleSave("school_name", e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        </label>
        <label>
          School Code
          <input
            defaultValue={settings.school_code || ""}
            onBlur={e => handleSave("school_code", e.target.value)}
          />
        </label>
        <label className="wide">
          Address
          <textarea
            defaultValue={settings.address || ""}
            onBlur={e => handleSave("address", e.target.value)}
            style={{ width: "100%", minHeight: 80, marginTop: 8, border: "1px solid var(--line)", borderRadius: 5, padding: 12 }}
          />
        </label>
        <label>
          Phone
          <input
            defaultValue={settings.phone || ""}
            onBlur={e => handleSave("phone", e.target.value)}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            defaultValue={settings.email || ""}
            onBlur={e => handleSave("email", e.target.value)}
          />
        </label>
      </div>

      <div style={{ marginTop: 24 }}>
        <span className="step-label">REGIONAL & DISPLAY</span>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label>
            Timezone
            <select
              defaultValue={settings.timezone || "Asia/Kolkata"}
              onBlur={e => handleSave("timezone", e.target.value)}
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
            </select>
          </label>
          <label>
            Date Format
            <select
              defaultValue={settings.date_format || "DD/MM/YYYY"}
              onBlur={e => handleSave("date_format", e.target.value)}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </label>
          <label>
            Currency
            <select
              defaultValue={settings.currency || "INR"}
              onBlur={e => handleSave("currency", e.target.value)}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="SGD">SGD (S$)</option>
            </select>
          </label>
          <label>
            Currency Symbol
            <input
              defaultValue={settings.currency_symbol || "₹"}
              onBlur={e => handleSave("currency_symbol", e.target.value)}
              style={{ width: 80 }}
            />
          </label>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <span className="step-label">UPLOADS</span>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label>
            School Logo
            {settings.school_logo_path && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={`/${String(settings.school_logo_path).replace(/\\/g, "/").split("/").slice(-2).join("/")}`}
                  alt="School Logo"
                  style={{ maxHeight: 80, maxWidth: 200, borderRadius: 6, border: "1px solid var(--line)", objectFit: "contain" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
              <button className="primary-button" onClick={handleLogoUpload} disabled={!logoFile}>
                <Upload size={16} /> Upload
              </button>
            </div>
          </label>
          <label>
            Principal Signature
            {settings.principal_signature_path && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={`/${String(settings.principal_signature_path).replace(/\\/g, "/").split("/").slice(-2).join("/")}`}
                  alt="Principal Signature"
                  style={{ maxHeight: 60, maxWidth: 160, borderRadius: 6, border: "1px solid var(--line)", objectFit: "contain" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="file" accept="image/*" onChange={e => setSigFile(e.target.files?.[0] || null)} />
              <button className="primary-button" onClick={handleSigUpload} disabled={!sigFile}>
                <Upload size={16} /> Upload
              </button>
            </div>
          </label>
          <label>
            Secretary Signature
            {settings.secretary_signature_path && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={`/${String(settings.secretary_signature_path).replace(/\\/g, "/").split("/").slice(-2).join("/")}`}
                  alt="Secretary Signature"
                  style={{ maxHeight: 60, maxWidth: 160, borderRadius: 6, border: "1px solid var(--line)", objectFit: "contain" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="file" accept="image/*" onChange={e => setSecSigFile(e.target.files?.[0] || null)} />
              <button className="primary-button" onClick={handleSecSigUpload} disabled={!secSigFile}>
                <Upload size={16} /> Upload
              </button>
            </div>
          </label>
          <label>
            School Stamp
            {settings.school_stamp_path && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={`/${String(settings.school_stamp_path).replace(/\\/g, "/").split("/").slice(-2).join("/")}`}
                  alt="School Stamp"
                  style={{ maxHeight: 80, maxWidth: 80, borderRadius: 6, border: "1px solid var(--line)", objectFit: "contain" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="file" accept="image/*" onChange={e => setStampFile(e.target.files?.[0] || null)} />
              <button className="primary-button" onClick={handleStampUpload} disabled={!stampFile}>
                <Upload size={16} /> Upload
              </button>
            </div>
          </label>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <span className="step-label">SMTP SETTINGS</span>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label>
            SMTP Host
            <input
              defaultValue={settings.smtp_host || ""}
              onBlur={e => handleSave("smtp_host", e.target.value)}
              placeholder="smtp.gmail.com"
            />
          </label>
          <label>
            SMTP Port
            <input
              defaultValue={settings.smtp_port || "587"}
              onBlur={e => handleSave("smtp_port", e.target.value)}
              placeholder="587"
            />
          </label>
          <label>
            SMTP Username
            <input
              defaultValue={settings.smtp_username || ""}
              onBlur={e => handleSave("smtp_username", e.target.value)}
              placeholder="your-email@gmail.com"
            />
          </label>
          <label>
            SMTP Password
            <input
              type="password"
              defaultValue={settings.smtp_password || ""}
              onBlur={e => handleSave("smtp_password", e.target.value)}
              placeholder="App password"
            />
          </label>
          <label>
            From Email
            <input
              type="email"
              defaultValue={settings.smtp_from_email || ""}
              onBlur={e => handleSave("smtp_from_email", e.target.value)}
              placeholder="noreply@school.com"
            />
          </label>
          <label>
            From Name
            <input
              defaultValue={settings.smtp_from_name || ""}
              onBlur={e => handleSave("smtp_from_name", e.target.value)}
              placeholder="School Name"
            />
          </label>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <span className="step-label">SMS SETTINGS</span>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label>
            SMS Provider
            <select
              defaultValue={settings.sms_provider || ""}
              onBlur={e => handleSave("sms_provider", e.target.value)}
            >
              <option value="">None</option>
              <option value="twilio">Twilio</option>
              <option value="nexmo">Nexmo</option>
              <option value="textlocal">TextLocal</option>
              <option value="custom">Custom API</option>
            </select>
          </label>
          <label>
            SMS API Key
            <input
              defaultValue={settings.sms_api_key || ""}
              onBlur={e => handleSave("sms_api_key", e.target.value)}
              placeholder="API key"
            />
          </label>
          <label>
            SMS API Secret
            <input
              type="password"
              defaultValue={settings.sms_api_secret || ""}
              onBlur={e => handleSave("sms_api_secret", e.target.value)}
              placeholder="API secret"
            />
          </label>
          <label>
            SMS Sender ID
            <input
              defaultValue={settings.sms_sender_id || ""}
              onBlur={e => handleSave("sms_sender_id", e.target.value)}
              placeholder="SCHOOL"
            />
          </label>
          <label>
            SMS API URL (Custom)
            <input
              defaultValue={settings.sms_api_url || ""}
              onBlur={e => handleSave("sms_api_url", e.target.value)}
              placeholder="https://api.example.com/sms"
            />
          </label>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <span className="step-label">BACKUP & RESTORE</span>
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
          <button className="primary-button" onClick={handleBackup} disabled={backingUp}>
            <Database size={16} /> {backingUp ? "Backing up..." : "Backup Now"}
          </button>
          <span style={{ fontSize: 13, color: "var(--muted, #6b7280)" }}>
            Last backup: {settings.last_backup_time || "Never"}
          </span>
        </div>
      </div>
    </section>
  );
}

function AcademicYearsTab() {
  const [years, setYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [yearName, setYearName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const load = () => {
    setLoading(true);
    api.academicYears().then(r => setYears(r.data)).catch(() => setYears([])).finally(() => setLoading(false));
  };

  useEffect(() => { void load(); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createAcademicYear({ name: yearName, startDate, endDate });
      setYearName(""); setStartDate(""); setEndDate(""); setShowForm(false);
      void load();
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  function startEdit(y: any) {
    setEditingId(y.id);
    setEditName(y.name);
    setEditStartDate(y.startDate ? y.startDate.split("T")[0] : "");
    setEditEndDate(y.endDate ? y.endDate.split("T")[0] : "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditStartDate("");
    setEditEndDate("");
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    try {
      await api.updateAcademicYear(editingId, { name: editName, startDate: editStartDate, endDate: editEndDate });
      cancelEdit();
      void load();
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this academic year?")) return;
    try {
      await api.deleteAcademicYear(id);
      void load();
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  async function handleSetCurrent(id: number) {
    try {
      await api.updateAcademicYear(id, { isCurrent: true });
      void load();
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="step-label">ACADEMIC YEARS</span>
        <button className="primary-button" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Add year
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 20, background: "var(--cream)", padding: 16, borderRadius: 8 }}>
          <label>
            Year name
            <input value={yearName} onChange={e => setYearName(e.target.value)} placeholder="e.g. 2026-27" required />
          </label>
          <label>
            Start date
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </label>
          <label>
            End date
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="primary-button" type="submit">Create year</button>
          </div>
        </form>
      )}

      {editingId !== null && (
        <form onSubmit={handleUpdate} className="form-grid" style={{ marginBottom: 20, background: "#e8f0fe", padding: 16, borderRadius: 8 }}>
          <label>
            Year name
            <input value={editName} onChange={e => setEditName(e.target.value)} required />
          </label>
          <label>
            Start date
            <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} required />
          </label>
          <label>
            End date
            <input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} required />
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button className="primary-button" type="submit">Save changes</button>
            <button className="secondary-button" type="button" onClick={cancelEdit}>Cancel</button>
          </div>
        </form>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : years.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "1.5rem" }}>No academic years found.</td></tr>
            ) : (
              years.map((y: any) => (
                <tr key={y.id}>
                  <td><strong>{y.name}</strong></td>
                  <td>{y.startDate ? new Date(y.startDate).toLocaleDateString() : "—"}</td>
                  <td>{y.endDate ? new Date(y.endDate).toLocaleDateString() : "—"}</td>
                  <td><span className={`status-badge ${y.isActive ? "active" : "withdrawn"}`}>{y.isActive ? "current" : "archived"}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {!y.isActive && (
                        <button className="secondary-button" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleSetCurrent(y.id)}>
                          Set current
                        </button>
                      )}
                      <button className="icon-button" onClick={() => startEdit(y)} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button className="icon-button" style={{ color: "var(--error, #c0392b)" }} onClick={() => handleDelete(y.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BoardsTab() {
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.boards().then(r => setBoards(r.data)).catch(() => setBoards([])).finally(() => setLoading(false));
  }, []);

  return (
    <section className="panel" style={{ padding: 24 }}>
      <span className="step-label">BOARDS</span>
      <div className="table-scroll" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : boards.length === 0 ? (
              <tr><td colSpan={2} style={{ textAlign: "center", padding: "1.5rem" }}>No boards configured.</td></tr>
            ) : (
              boards.map((b: any) => (
                <tr key={b.id}>
                  <td><strong>{b.name}</strong></td>
                  <td>{b.code || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClassesTab() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.classes().then(r => setClasses(r.data)).catch(() => setClasses([])).finally(() => setLoading(false));
  }, []);

  return (
    <section className="panel" style={{ padding: 24 }}>
      <span className="step-label">CLASSES</span>
      <div className="table-scroll" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Sections</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : classes.length === 0 ? (
              <tr><td colSpan={2} style={{ textAlign: "center", padding: "1.5rem" }}>No classes configured.</td></tr>
            ) : (
              classes.map((c: any) => (
                <tr key={c.id || c.name}>
                  <td><strong>{c.name || c.className}</strong></td>
                  <td>{c.sections?.join(", ") || c.sectionCount || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditLogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  const load = () => {
    setLoading(true);
    api.auditLog(limit).then(r => setLogs(r.data)).catch(() => setLogs([])).finally(() => setLoading(false));
  };

  useEffect(() => { void load(); }, [limit]);

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="step-label">AUDIT LOG</span>
        <div className="select-wrap small">
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
            <option value={25}>Last 25</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
          </select>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "1.5rem" }}>No audit entries found.</td></tr>
            ) : (
              logs.map((log, i) => (
                <tr key={log.id || i}>
                  <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</td>
                  <td>{log.userName || log.user || "—"}</td>
                  <td><span className="status-badge">{log.actionName || log.action}</span></td>
                  <td>{log.entityType || log.entity || "—"}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.metadata || log.details || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SystemLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  const load = () => {
    setLoading(true);
    api.systemLogs(limit).then(r => setLogs(r.data)).catch(() => setLogs([])).finally(() => setLoading(false));
  };

  useEffect(() => { void load(); }, [limit]);

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="step-label">SYSTEM LOGS</span>
        <div className="select-wrap small">
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
            <option value={25}>Last 25</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
          </select>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Level</th>
              <th>Message</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "1.5rem" }}>No system logs found.</td></tr>
            ) : (
              logs.map((log, i) => (
                <tr key={log.id || i}>
                  <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</td>
                  <td><span className={`status-badge ${log.level === "error" ? "withdrawn" : log.level === "warn" ? "inactive" : "active"}`}>{log.level || "info"}</span></td>
                  <td style={{ maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.message || "—"}
                  </td>
                  <td>{log.source || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
