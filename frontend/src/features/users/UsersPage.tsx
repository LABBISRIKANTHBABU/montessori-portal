import { useState, useEffect, FormEvent } from "react";
import { Plus, Search, UserCog, Shield, X, Power, RotateCcw, Trash2 } from "lucide-react";
import { api } from "../../api";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [resetUser, setResetUser] = useState<any>(null);
  const [error, setError] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.users().then(r => setUsers(r.data)).catch(() => setUsers([])).finally(() => setLoading(false));
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => { api.roles().then(r => setRoles(r.data)).catch(() => setRoles([])); }, []);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  async function handleCreate(name: string, email: string, password: string, roleCode: string) {
    setError("");
    try {
      await api.createUser({ name, email, password, roleCode });
      setShowCreate(false);
      void load();
    } catch (err: any) {
      setError(err.message || "Failed");
      throw err;
    }
  }

  async function handleEdit(id: number, name: string, roleCode: string) {
    setError("");
    try {
      await api.updateUser(id, { name, roleCode });
      setEditUser(null);
      void load();
    } catch (err: any) {
      setError(err.message || "Failed");
      throw err;
    }
  }

  async function handleToggleActive(id: number, isActive: boolean) {
    try {
      if (isActive) await api.deactivateUser(id);
      else await api.activateUser(id);
      void load();
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  async function handleResetPassword(id: number, password: string) {
    try {
      await api.resetPassword(id, password);
      setResetUser(null);
      alert("Password reset successfully");
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  async function handleDeleteUser(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    try {
      await api.deleteUser(id);
      setAuditLogs(null);
      void load();
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  }

  async function viewAuditLog(userId: number) {
    setAuditLoading(true);
    try {
      const r = await api.auditLog(100);
      const userLogs = r.data.filter((log: any) => {
        const meta = log.metadata ? JSON.parse(log.metadata) : {};
        return meta.target_user === userId || log.entityId === userId;
      });
      setAuditLogs(userLogs);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">USER MANAGEMENT</span>
          <h1>Staff & Roles</h1>
          <p>Manage portal users, roles and access.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Add user
          </button>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="table-tools">
          <div className="search-box">
            <Search size={18} />
            <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>Loading users...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>No users found.</td></tr>
              ) : (
                filtered.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="student-cell">
                        <span><UserCog size={18} /></span>
                        <div>
                          <strong>{user.name}</strong>
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td><span className="status-badge">{user.roleName || user.roleCode}</span></td>
                    <td>
                      <span className={`status-badge ${user.isActive !== false ? "active" : "withdrawn"}`}>
                        {user.isActive !== false ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="actions-cell" style={{ display: "flex", gap: 4 }}>
                      <button className="icon-button" title="Edit" onClick={() => setEditUser(user)}>
                        <UserCog size={16} />
                      </button>
                      <button
                        className="icon-button"
                        title={user.isActive !== false ? "Deactivate" : "Activate"}
                        onClick={() => handleToggleActive(user.id, user.isActive !== false)}
                      >
                        <Power size={16} />
                      </button>
                      <button className="icon-button" title="Reset password" onClick={() => setResetUser(user)}>
                        <RotateCcw size={16} />
                      </button>
                      <button className="icon-button" title="Audit log" onClick={() => viewAuditLog(user.id)}>
                        <Shield size={16} />
                      </button>
                      <button className="icon-button" title="Delete user" onClick={() => handleDeleteUser(user.id, user.name)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {auditLogs && (
        <section className="panel" style={{ marginTop: 16, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Audit Log</h3>
            <button className="icon-button" onClick={() => setAuditLogs(null)}><X size={18} /></button>
          </div>
          {auditLoading ? (
            <p style={{ textAlign: "center", padding: "1rem" }}>Loading audit log...</p>
          ) : auditLogs.length === 0 ? (
            <p style={{ textAlign: "center", padding: "1rem" }}>No audit entries found.</p>
          ) : (
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>User</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td>{log.action}</td>
                    <td>{log.userName || "System"}</td>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {showCreate && (
        <CreateUserModal roles={roles} error={error} onClose={() => { setShowCreate(false); setError(""); }} onSubmit={handleCreate} />
      )}

      {editUser && (
        <EditUserModal user={editUser} roles={roles} error={error} onClose={() => { setEditUser(null); setError(""); }} onSubmit={handleEdit} />
      )}

      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} onSubmit={handleResetPassword} />
      )}
    </div>
  );
}

function CreateUserModal({ roles, error, onClose, onSubmit }: { roles: any[]; error: string; onClose: () => void; onSubmit: (n: string, e: string, p: string, r: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleCode, setRoleCode] = useState(roles[0]?.code || "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try { await onSubmit(name, email, password, roleCode); } catch { } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="panel" style={{ maxWidth: 440, margin: "10vh auto", padding: 32 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Add User</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <label>Name<input value={name} onChange={e => setName(e.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required /></label>
          <label>
            Role
            <select value={roleCode} onChange={e => setRoleCode(e.target.value)}>
              {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? "Creating..." : "Create user"}</button>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user, roles, error, onClose, onSubmit }: { user: any; roles: any[]; error: string; onClose: () => void; onSubmit: (id: number, n: string, r: string) => Promise<void> }) {
  const [name, setName] = useState(user.name);
  const [roleCode, setRoleCode] = useState(user.roleCode);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try { await onSubmit(user.id, name, roleCode); } catch { } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="panel" style={{ maxWidth: 440, margin: "10vh auto", padding: 32 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Edit User</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <label>Name<input value={name} onChange={e => setName(e.target.value)} required /></label>
          <label>
            Role
            <select value={roleCode} onChange={e => setRoleCode(e.target.value)}>
              {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? "Saving..." : "Save changes"}</button>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onSubmit }: { user: any; onClose: () => void; onSubmit: (id: number, p: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try { await onSubmit(user.id, password); } catch { } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="panel" style={{ maxWidth: 400, margin: "10vh auto", padding: 32 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Reset Password</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="muted">Set a new password for <strong>{user.name}</strong>.</p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <label>New password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required /></label>
          <button className="primary-button" disabled={loading}>{loading ? "Resetting..." : "Reset password"}</button>
        </form>
      </div>
    </div>
  );
}
