import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, UserRound, GraduationCap, FolderOpen, WalletCards, Activity, History, Trash2, Power, Printer, Heart, StickyNote, RotateCcw } from "lucide-react";
import { api } from "../../api";

export default function StudentProfilePage({ id }: { id: number }) {
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("general");
  const [documents, setDocuments] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [fees, setFees] = useState<any>(null);
  const [medical, setMedical] = useState<any>(null);
  const [medicalForm, setMedicalForm] = useState<Record<string, string>>({});
  const [medicalSaving, setMedicalSaving] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteForm, setNoteForm] = useState({ noteType: "general", title: "", content: "" });
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteTypeFilter, setNoteTypeFilter] = useState("");
  const [timeline, setTimeline] = useState<any[]>([]);

  const load = () => api.student(id).then(r => setStudent(r.data)).catch(e => setError(e.message));
  useEffect(() => { void load(); }, [id]);

  useEffect(() => {
    if (tab === "documents") api.studentDocuments(id).then(r => setDocuments(r.data)).catch(() => setDocuments([]));
    if (tab === "certificates") api.studentCertificates(id).then(r => setCertificates(r.data)).catch(() => setCertificates([]));
    if (tab === "fees") api.studentFees(id).then(r => setFees(r.data)).catch(() => setFees(null));
    if (tab === "medical") api.studentMedical(id).then(r => { setMedical(r.data); setMedicalForm(r.data || {}); }).catch(() => { setMedical(null); setMedicalForm({}); });
    if (tab === "notes") api.studentNotes(id, noteTypeFilter).then(r => setNotes(r.data)).catch(() => setNotes([]));
    if (tab === "timeline") api.studentTimeline(id).then(r => setTimeline(r.data)).catch(() => setTimeline([]));
  }, [tab, id, noteTypeFilter]);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!student) return <div className="page">Loading student record…</div>;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await api.updateStudent(id, data);
    setEditing(false);
    void load();
  }
  
  async function changeStatus(newStatus: string) {
    const reason = prompt(`Reason for changing status to "${newStatus}":`);
    if (reason === null) return;
    try {
      await api.changeStudentStatus(id, { status: newStatus, reason: reason || undefined });
      void load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleRestore() {
    try {
      await api.restoreStudent(id);
      void load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function saveMedical(e: FormEvent) {
    e.preventDefault();
    setMedicalSaving(true);
    try {
      await api.updateStudentMedical(id, medicalForm);
      setMedicalSaving(false);
    } catch (e: any) {
      alert(e.message);
      setMedicalSaving(false);
    }
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!noteForm.title || !noteForm.content) return;
    setNoteSaving(true);
    try {
      await api.createStudentNote(id, noteForm);
      setNoteForm({ noteType: "general", title: "", content: "" });
      const r = await api.studentNotes(id, noteTypeFilter);
      setNotes(r.data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setNoteSaving(false);
    }
  }

  async function deleteNote(noteId: number) {
    if (!confirm("Delete this note?")) return;
    try {
      await api.deleteStudentNote(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (e: any) {
      alert(e.message);
    }
  }

  function handlePrint() {
    window.print();
  }

  const isInactive = ["inactive", "dropped", "transferred", "alumni"].includes(student.status);

  const tabs = [
    { id: "general", label: "Overview", icon: UserRound },
    { id: "parents", label: "Parents", icon: UserRound },
    { id: "academic", label: "Academics", icon: GraduationCap },
    { id: "documents", label: "Documents", icon: FolderOpen },
    { id: "certificates", label: "Certificates", icon: FolderOpen },
    { id: "fees", label: "Fee History", icon: WalletCards },
    { id: "medical", label: "Medical", icon: Heart },
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "timeline", label: "Timeline", icon: History }
  ];

  return (
    <div className="page profile-page">
      <button className="back-button" onClick={() => navigate("/students")}>
        <ArrowRight size={16} style={{ transform: "rotate(180deg)" }} /> Student directory
      </button>
      
      <div className="profile-header">
        <div className="profile-identity">
          <div className="avatar large">{student.full_name.charAt(0)}</div>
          <div>
            <div className="profile-title">
              <h1>{student.full_name}</h1>
              <span className={`status-badge ${student.status || 'active'}`}>{student.status || 'Active'}</span>
            </div>
            <p>Admission {student.admission_no} · {student.classAdmitted} {student.sectionName || ""}</p>
            <p className="muted">UID: {student.student_uid}</p>
          </div>
        </div>
        
        <div className="header-actions">
          {isInactive && (
            <button className="secondary-button" onClick={handleRestore} title="Restore to active status">
              <RotateCcw size={17} /> Restore
            </button>
          )}
          <button className="secondary-button" onClick={handlePrint} title="Print profile">
            <Printer size={17} /> Print
          </button>
          <button className="secondary-button" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit record"}
          </button>
          <div className="select-wrap outline">
            <select 
              value="" 
              onChange={e => changeStatus(e.target.value)}
              title="Change Status"
            >
              <option value="" disabled>Change Status...</option>
              <option value="active">Set Active</option>
              <option value="inactive">Mark Inactive</option>
              <option value="dropped">Mark Dropped</option>
              <option value="transferred">Mark Transferred</option>
              <option value="alumni">Mark Alumni</option>
            </select>
          </div>
        </div>
      </div>

      <nav className="page-tabs">
        {tabs.map(t => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </nav>

      <div className="profile-content">
        {editing ? (
          <form className="panel profile-form" onSubmit={save}>
            <span className="step-label">EDIT PERSONAL INFO</span>
            <label>Full name<input name="fullName" defaultValue={student.full_name} required /></label>
            <label>Email<input name="studentEmail" type="email" defaultValue={student.student_email || ""} /></label>
            <label>Class<input name="classAdmitted" defaultValue={student.classAdmitted} required /></label>
            <label>Section<input name="sectionName" defaultValue={student.sectionName || ""} /></label>
            <label className="full">Residence address<textarea name="residenceAddress" defaultValue={student.residenceAddress} required /></label>
            <button className="primary-button">Save changes</button>
          </form>
        ) : (
          <section className="profile-grid">
            {tab === "general" && (
              <article className="panel profile-card">
                <span className="step-label">PERSONAL DETAILS</span>
                <p><strong>Date of birth</strong>{student.date_of_birth || "—"}</p>
                <p><strong>Gender</strong>{student.gender || "—"}</p>
                <p><strong>Nationality</strong>{student.nationality || "—"}</p>
                <p><strong>Religion</strong>{student.religion || "—"}</p>
                <p><strong>Residence</strong>{student.residenceAddress || "—"}</p>
              </article>
            )}
            
            {tab === "parents" && (
              <article className="panel profile-card">
                <span className="step-label">GUARDIANS</span>
                {student.guardians?.length ? student.guardians.map((g: any) => (
                  <div key={g.id} className="guardian-block">
                    <p><strong>{g.relationType}</strong>{g.fullName}</p>
                    <p><strong>Contact</strong>{g.mobile || "—"}</p>
                    <p><strong>Occupation</strong>{g.occupation || "—"}</p>
                  </div>
                )) : <p className="muted">No guardians listed.</p>}
              </article>
            )}

            {tab === "timeline" && (
              <article className="panel profile-card full-width">
                <span className="step-label">ACTIVITY TIMELINE</span>
                <div className="timeline">
                  {timeline.length > 0 ? timeline.map((h: any, i: number) => (
                    <div key={i} className="timeline-event">
                      <Activity size={16} className="muted" />
                      <div>
                        <p>{h.actionName}</p>
                        <small>{h.createdAt} by {h.actorName || "System"}</small>
                      </div>
                    </div>
                  )) : student.history?.length ? student.history.map((h: any, i: number) => (
                    <div key={i} className="timeline-event">
                      <Activity size={16} className="muted" />
                      <div>
                        <p>{h.actionName}</p>
                        <small>{h.createdAt} by {h.actorName || "System"}</small>
                      </div>
                    </div>
                  )) : <p className="muted">No recent activity.</p>}
                </div>
              </article>
            )}

            {tab === "documents" && (
              <article className="panel profile-card full-width">
                <span className="step-label">DOCUMENTS</span>
                {documents.length > 0 ? (
                  <div className="document-list">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="document-item">
                        <FolderOpen size={16} />
                        <div>
                          <strong>{doc.originalFilename || doc.title}</strong>
                          <small>{doc.categoryName} · {doc.uploadedByName} · {doc.createdAt}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="muted">No documents uploaded yet.</p>}
              </article>
            )}

            {tab === "certificates" && (
              <article className="panel profile-card full-width">
                <span className="step-label">CERTIFICATES</span>
                {certificates.length > 0 ? (
                  <div className="certificate-list">
                    {certificates.map((cert: any) => (
                      <div key={cert.id} className="certificate-item">
                        <GraduationCap size={16} />
                        <div>
                          <strong>{cert.certificateType} Certificate</strong>
                          <small>Status: {cert.status} · {cert.generatedAt}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="muted">No certificates generated yet.</p>}
              </article>
            )}

            {tab === "fees" && (
              <article className="panel profile-card full-width">
                <span className="step-label">FEE SUMMARY</span>
                {fees?.summary?.length ? (
                  <div className="fee-summary">
                    <div className="fee-grid">
                      {fees.summary.map((f: any, i: number) => (
                        <div key={i} className="fee-item">
                          <strong>{f.categoryName}</strong>
                          <span>Total: ₹{f.total.toLocaleString()}</span>
                          <span>Paid: ₹{f.paid.toLocaleString()}</span>
                          <span className={f.pending > 0 ? "text-danger" : "text-success"}>Pending: ₹{f.pending.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <p className="total-pending"><strong>Total Pending: ₹{fees.totalPending.toLocaleString()}</strong></p>
                  </div>
                ) : <p className="muted">No fee data available.</p>}
              </article>
            )}

            {tab === "academic" && (
              <article className="panel profile-card full-width">
                <span className="step-label">ACADEMIC HISTORY</span>
                <p><strong>Class Admitted:</strong> {student.classAdmitted}</p>
                <p><strong>Section:</strong> {student.sectionName || "—"}</p>
                <p><strong>Board:</strong> {student.board || "—"}</p>
                <p><strong>Academic Year:</strong> {student.academicYear || "—"}</p>
              </article>
            )}

            {tab === "medical" && (
              <article className="panel profile-card full-width">
                <span className="step-label">MEDICAL INFORMATION</span>
                <form onSubmit={saveMedical} className="medical-form">
                  <div className="form-grid">
                    <label className="field">
                      <span>Blood Group</span>
                      <select value={medicalForm.blood_group || ""} onChange={e => setMedicalForm(p => ({ ...p, blood_group: e.target.value }))}>
                        <option value="">Select</option>
                        <option value="A+">A+</option><option value="A-">A-</option>
                        <option value="B+">B+</option><option value="B-">B-</option>
                        <option value="AB+">AB+</option><option value="AB-">AB-</option>
                        <option value="O+">O+</option><option value="O-">O-</option>
                      </select>
                    </label>
                    <label className="field wide">
                      <span>Allergies</span>
                      <textarea rows={2} value={medicalForm.allergies || ""} onChange={e => setMedicalForm(p => ({ ...p, allergies: e.target.value }))} placeholder="List any known allergies" />
                    </label>
                    <label className="field wide">
                      <span>Current Medications</span>
                      <textarea rows={2} value={medicalForm.medications || ""} onChange={e => setMedicalForm(p => ({ ...p, medications: e.target.value }))} placeholder="List current medications" />
                    </label>
                    <label className="field wide">
                      <span>Medical Conditions</span>
                      <textarea rows={2} value={medicalForm.conditions || ""} onChange={e => setMedicalForm(p => ({ ...p, conditions: e.target.value }))} placeholder="Chronic conditions, disabilities, etc." />
                    </label>
                    <label className="field">
                      <span>Emergency Contact Name</span>
                      <input value={medicalForm.emergency_contact_name || ""} onChange={e => setMedicalForm(p => ({ ...p, emergency_contact_name: e.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Emergency Contact Phone</span>
                      <input value={medicalForm.emergency_contact_phone || ""} onChange={e => setMedicalForm(p => ({ ...p, emergency_contact_phone: e.target.value }))} />
                    </label>
                    <label className="field wide">
                      <span>Insurance Information</span>
                      <textarea rows={2} value={medicalForm.insurance_info || ""} onChange={e => setMedicalForm(p => ({ ...p, insurance_info: e.target.value }))} placeholder="Provider, policy number, etc." />
                    </label>
                  </div>
                  <button className="primary-button" type="submit" disabled={medicalSaving}>
                    {medicalSaving ? "Saving…" : "Save Medical Info"}
                  </button>
                </form>
              </article>
            )}

            {tab === "notes" && (
              <article className="panel profile-card full-width">
                <span className="step-label">STUDENT NOTES</span>
                <div className="notes-header">
                  <div className="filter-group">
                    <div className="select-wrap small">
                      <select value={noteTypeFilter} onChange={e => setNoteTypeFilter(e.target.value)}>
                        <option value="">All types</option>
                        <option value="academic">Academic</option>
                        <option value="medical">Medical</option>
                        <option value="behaviour">Behaviour</option>
                        <option value="counselling">Counselling</option>
                        <option value="general">General</option>
                      </select>
                    </div>
                  </div>
                </div>
                <form onSubmit={addNote} className="note-form">
                  <div className="form-grid">
                    <select value={noteForm.noteType} onChange={e => setNoteForm(p => ({ ...p, noteType: e.target.value }))}>
                      <option value="general">General</option>
                      <option value="academic">Academic</option>
                      <option value="medical">Medical</option>
                      <option value="behaviour">Behaviour</option>
                      <option value="counselling">Counselling</option>
                    </select>
                    <input value={noteForm.title} onChange={e => setNoteForm(p => ({ ...p, title: e.target.value }))} placeholder="Note title" required />
                    <textarea value={noteForm.content} onChange={e => setNoteForm(p => ({ ...p, content: e.target.value }))} placeholder="Write your note..." rows={3} required className="wide" />
                  </div>
                  <button className="primary-button" type="submit" disabled={noteSaving}>
                    {noteSaving ? "Adding…" : "Add Note"}
                  </button>
                </form>
                <div className="notes-list">
                  {notes.length > 0 ? notes.map((note: any) => (
                    <div key={note.id} className="note-item">
                      <div className="note-header">
                        <span className={`status-badge ${note.note_type}`}>{note.note_type}</span>
                        <strong>{note.title}</strong>
                        <small>{note.createdByName} · {new Date(note.created_at).toLocaleDateString()}</small>
                        <button className="icon-button text-muted" onClick={() => deleteNote(note.id)} title="Delete note">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p>{note.content}</p>
                    </div>
                  )) : <p className="muted">No notes recorded yet.</p>}
                </div>
              </article>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
