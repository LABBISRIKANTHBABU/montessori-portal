import React, { useState, useEffect, FormEvent, memo } from "react";
import {
  WalletCards, BookOpen, Truck, Receipt, BarChart3, Search, Plus, X,
  ArrowDownRight, ArrowUpRight, Calendar, CreditCard, TrendingUp, TrendingDown,
  AlertTriangle, Users, IndianRupee, FileText, Download, Building2, Eye,
  ChevronDown, RefreshCw, Filter, CheckCircle, Clock, Ban, BadgeCheck,
  Banknote, Scale, FileSpreadsheet, FileBarChart, Activity
} from "lucide-react";
import { api, Student } from "../../api";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "fees", label: "Fee Collection", icon: WalletCards },
  { id: "cashbook", label: "Cash Book", icon: BookOpen },
  { id: "bankbook", label: "Bank Book", icon: Building2 },
  { id: "suppliers", label: "Suppliers", icon: Truck },
  { id: "vouchers", label: "Vouchers", icon: Receipt },
  { id: "concessions", label: "Concessions", icon: BadgeCheck },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "audit", label: "Audit Trail", icon: Clock },
];

export default function AccountsPage() {
  const [tab, setTab] = useState("dashboard");
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">ACCOUNTS DEPARTMENT</span>
          <h1>Accounts</h1>
          <p>Fee collection, cash management, vouchers, suppliers and financial reports.</p>
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
        {tab === "dashboard" && <AccountsDashboard />}
        {tab === "fees" && <FeeCollectionTab />}
        {tab === "cashbook" && <CashBookTab />}
        {tab === "bankbook" && <BankBookTab />}
        {tab === "suppliers" && <SuppliersTab />}
        {tab === "vouchers" && <VouchersTab />}
        {tab === "concessions" && <ConcessionsTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "audit" && <AuditTrailTab />}
      </div>
    </div>
  );
}

// ─── Accounts Dashboard ─────────────────────────────────────────────────

function AccountsDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState<any>(null);

  useEffect(() => {
    api.accountsDashboard().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
    api.weeklyReport().then(r => setFlow(r.data)).catch(() => {});
  }, []);

  if (loading) return <section className="panel" style={{ padding: 24 }}>Loading...</section>;
  if (!data) return <section className="panel" style={{ padding: 24 }}>Failed to load dashboard.</section>;

  return (
    <section className="panel" style={{ padding: 24 }}>
      <span className="step-label">TODAY'S OVERVIEW</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 12 }}>
        <DashCard icon={<TrendingUp size={20} />} label="Today's Collection" value={`₹${Number(data.todayCollection || 0).toLocaleString()}`} color="var(--forest)" />
        <DashCard icon={<TrendingDown size={20} />} label="Today's Expenses" value={`₹${Number(data.todayExpenses || 0).toLocaleString()}`} color="var(--coral)" />
        <DashCard icon={<Banknote size={20} />} label="Opening Cash" value={`₹${Number(data.openingBalance || 0).toLocaleString()}`} color="#3b82f6" />
        <DashCard icon={<WalletCards size={20} />} label="Closing Cash" value={`₹${Number(data.closingBalance || 0).toLocaleString()}`} color="var(--forest)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}>
        <DashCard icon={<AlertTriangle size={20} />} label="Pending Fees" value={`₹${Number(data.pendingFees || 0).toLocaleString()}`} color="var(--coral)" />
        <DashCard icon={<Truck size={20} />} label="Outstanding Suppliers" value={`₹${Number(data.outstandingSuppliers || 0).toLocaleString()}`} color="#d97706" />
        <DashCard icon={<Activity size={20} />} label="Cash Flow (Net)" value={`₹${Number(data.cashFlow || 0).toLocaleString()}`} color={data.cashFlow >= 0 ? "var(--forest)" : "var(--coral)"} />
        <DashCard icon={<AlertTriangle size={20} />} label="Fee Defaulters" value={String(data.defaultersCount || 0)} color="var(--coral)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}>
        <DashCard icon={<Users size={20} />} label="Total Active Students" value={String(data.totalStudents || 0)} color="#3b82f6" />
        <DashCard icon={<CheckCircle size={20} />} label="Students Paid" value={String(data.collectedStudents || 0)} color="var(--forest)" />
        <DashCard icon={<TrendingUp size={20} />} label="Total Income (All Time)" value={`₹${Number(data.totalIncome || 0).toLocaleString()}`} color="var(--forest)" />
        <DashCard icon={<TrendingDown size={20} />} label="Total Expenses (All Time)" value={`₹${Number(data.totalExpenses || 0).toLocaleString()}`} color="var(--coral)" />
      </div>
      {flow && (
        <div style={{ marginTop: 20 }}>
          <span className="step-label">THIS WEEK'S CASH FLOW</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
            <div style={{ padding: 14, background: "#ecfdf5", borderRadius: 8 }}>
              <small style={{ color: "var(--forest)", fontSize: 11, fontWeight: 700 }}>INCOME</small>
              <strong style={{ fontSize: 18, display: "block", marginTop: 4, color: "var(--forest)" }}>₹{Number(flow.totalIncome || 0).toLocaleString()}</strong>
            </div>
            <div style={{ padding: 14, background: "#fef2f2", borderRadius: 8 }}>
              <small style={{ color: "var(--coral)", fontSize: 11, fontWeight: 700 }}>EXPENSES</small>
              <strong style={{ fontSize: 18, display: "block", marginTop: 4, color: "var(--coral)" }}>₹{Number(flow.totalExpenses || 0).toLocaleString()}</strong>
            </div>
            <div style={{ padding: 14, background: flow.netCashFlow >= 0 ? "#ecfdf5" : "#fef2f2", borderRadius: 8 }}>
              <small style={{ color: flow.netCashFlow >= 0 ? "var(--forest)" : "var(--coral)", fontSize: 11, fontWeight: 700 }}>NET CASH FLOW</small>
              <strong style={{ fontSize: 18, display: "block", marginTop: 4, color: flow.netCashFlow >= 0 ? "var(--forest)" : "var(--coral)" }}>₹{Number(flow.netCashFlow || 0).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const DashCard = memo(function DashCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="erp-stat-card" style={{ padding: 16, background: "var(--cream)", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ color, marginTop: 2 }}>{icon}</div>
      <div>
        <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{label}</small>
        <strong style={{ fontSize: 22, display: "block", marginTop: 4 }}>{value}</strong>
      </div>
    </div>
  );
});

// ─── Fee Collection ──────────────────────────────────────────────────────

function FeeCollectionTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [feeCategoryId, setFeeCategoryId] = useState<number>(0);
  const [academicYear, setAcademicYear] = useState("2026–27");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [receipt, setReceipt] = useState<{ number: string; id: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.students(studentSearch, "active", 1).then(r => setStudents(r.data)).catch(() => setStudents([]));
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  useEffect(() => {
    api.feeCategories().then(r => { setCategories(r.data); if (r.data.length) setFeeCategoryId(r.data[0].id); }).catch(() => {});
  }, []);

  useEffect(() => {
    api.feeStructures(academicYear).then(r => setStructures(r.data)).catch(() => setStructures([]));
  }, [academicYear]);

  useEffect(() => {
    if (!selectedStudent) return;
    setLoading(true);
    api.feePayments(selectedStudent, academicYear).then(r => setPayments(r.data)).catch(() => setPayments([])).finally(() => setLoading(false));
  }, [selectedStudent, academicYear]);

  useEffect(() => {
    if (selectedStudent && feeCategoryId) {
      const match = structures.find((s: any) => s.feeCategoryId === feeCategoryId || s.categoryName === categories.find((c: any) => c.id === feeCategoryId)?.name);
      if (match) setAmount(String(match.amount));
    }
  }, [selectedStudent, feeCategoryId, structures, categories]);

  async function handleCollect(e: FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !feeCategoryId || !amount) return;
    setError(""); setReceipt(null);
    try {
      const result = await api.collectFee({
        studentId: selectedStudent, feeCategoryId, academicYear,
        amount: Number(amount), paymentMode: mode, paymentDate,
        referenceNumber: referenceNumber || undefined, notes: notes || undefined,
      });
      setReceipt({ number: result.data.receiptNumber, id: result.data.id });
      setAmount(""); setReferenceNumber(""); setNotes("");
      const r = await api.feePayments(selectedStudent, academicYear);
      setPayments(r.data);
    } catch (err: any) { setError(err.message || "Payment failed"); }
  }

  return (
    <section className="panel" style={{ padding: 24 }}>
      <span className="step-label">COLLECT FEE</span>
      {receipt && (
        <div style={{ margin: "12px 0", padding: 12, background: "#ecfdf5", borderRadius: 8, border: "1px solid #86efac", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "var(--forest)", fontWeight: 600 }}>Receipt: <strong>{receipt.number}</strong></span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => void api.receiptPreview(receipt.id)} className="icon-button" title="Preview receipt"><Eye size={14} /></button>
            <button className="icon-button" onClick={() => setReceipt(null)}><X size={14} /></button>
          </div>
        </div>
      )}
      <form onSubmit={handleCollect} className="form-grid" style={{ marginTop: 12 }}>
        <label>
          Student *
          <div style={{ position: "relative" }}>
            <input placeholder="Search students..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 13, width: "100%", marginBottom: 6 }} />
            <select value={selectedStudent ?? ""} onChange={e => { setSelectedStudent(Number(e.target.value) || null); setStudentSearch(""); }} required>
              <option value="">Select student...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.fullName} — {s.admissionNo}</option>)}
            </select>
          </div>
        </label>
        <label>
          Academic Year *
          <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}>
            <option>2026–27</option><option>2025–26</option><option>2024–25</option>
          </select>
        </label>
        <label>
          Fee Category *
          <select value={feeCategoryId} onChange={e => setFeeCategoryId(Number(e.target.value))} required>
            <option value={0}>Select category...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          Amount (₹) *
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" required />
        </label>
        <label>
          Payment Mode *
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="cash">Cash</option><option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option>
            <option value="card">Card</option><option value="other">Other</option>
          </select>
        </label>
        <label>
          Payment Date *
          <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required />
        </label>
        <label>
          Reference Number
          <input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="UPI/Chq/NEFT ref" />
        </label>
        <label>
          Notes
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
        </label>
        {error && <div className="form-error" style={{ gridColumn: "1 / -1" }}>{error}</div>}
        <div style={{ gridColumn: "1 / -1" }}>
          <button className="primary-button" type="submit"><IndianRupee size={16} /> Record payment</button>
        </div>
      </form>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="step-label">PAYMENT HISTORY</span>
          {selectedStudent && <button className="secondary-button" onClick={() => void api.receiptPreview(payments[0]?.id || 0)} disabled={!payments.length}><Download size={14} /> Latest Receipt</button>}
        </div>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Student</th><th>Category</th><th>Amount</th><th>Mode</th><th>Receipt No.</th><th>Recorded By</th><th /></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "1.5rem" }}>No payments found.</td></tr>
              ) : (
                payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "—"}</td>
                    <td>{p.studentName || "—"}</td>
                    <td>{p.categoryName || "—"}</td>
                    <td style={{ fontWeight: 600 }}>₹{Number(p.amount).toLocaleString()}</td>
                    <td><span className="status-badge">{p.paymentMode || "—"}</span></td>
                    <td><strong>{p.receiptNumber || "—"}</strong></td>
                    <td>{p.recordedByName || "—"}</td>
                    <td><button onClick={() => void api.receiptPreview(p.id)} className="icon-button" title="View receipt"><Eye size={14} /></button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── Cash Book ───────────────────────────────────────────────────────────

function CashBookTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entryType, setEntryType] = useState("income");
  const [category, setCategory] = useState("Fee Collection");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.cashbook(date).then(r => setEntries(r.data)).catch(() => setEntries([])).finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, [date]);

  const dayIncome = entries.filter(e => e.entryType === "income").reduce((s, e) => s + e.amount, 0);
  const dayExpenses = entries.filter(e => e.entryType === "expense").reduce((s, e) => s + e.amount, 0);
  const closingBalance = dayIncome - dayExpenses;

  async function handleAdd(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      await api.addCashbookEntry({ entryType, category, description, amount: Number(amount), paymentMode, referenceNumber: referenceNumber || undefined, entryDate: date });
      setAmount(""); setDescription(""); setReferenceNumber(""); setShowForm(false);
      void load();
    } catch (err: any) { setError(err.message || "Failed"); }
  }

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 12, background: "var(--cream)", borderRadius: 8 }}>
          <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>OPENING BALANCE</small>
          <strong style={{ fontSize: 18, display: "block", marginTop: 4 }}>₹0</strong>
        </div>
        <div style={{ padding: 12, background: "#ecfdf5", borderRadius: 8 }}>
          <small style={{ color: "var(--forest)", fontSize: 11, fontWeight: 700 }}>DAY INCOME</small>
          <strong style={{ fontSize: 18, display: "block", marginTop: 4, color: "var(--forest)" }}>₹{dayIncome.toLocaleString()}</strong>
        </div>
        <div style={{ padding: 12, background: "#fef2f2", borderRadius: 8 }}>
          <small style={{ color: "var(--coral)", fontSize: 11, fontWeight: 700 }}>DAY EXPENSES</small>
          <strong style={{ fontSize: 18, display: "block", marginTop: 4, color: "var(--coral)" }}>₹{dayExpenses.toLocaleString()}</strong>
        </div>
        <div style={{ padding: 12, background: "#eef2ff", borderRadius: 8 }}>
          <small style={{ color: "#3b82f6", fontSize: 11, fontWeight: 700 }}>CLOSING BALANCE</small>
          <strong style={{ fontSize: 18, display: "block", marginTop: 4, color: "#3b82f6" }}>₹{closingBalance.toLocaleString()}</strong>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="step-label">DAILY CASH BOOK</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6 }} />
          <button onClick={() => void api.cashbookExport(date)} className="secondary-button"><Download size={14} /> Export</button>
          <button className="primary-button" onClick={() => setShowForm(!showForm)}><Plus size={16} /> Add entry</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="form-grid" style={{ marginBottom: 20, background: "var(--cream)", padding: 16, borderRadius: 8 }}>
          <label>Type *<select value={entryType} onChange={e => setEntryType(e.target.value)}><option value="income">Income</option><option value="expense">Expense</option></select></label>
          <label>Category *<select value={category} onChange={e => setCategory(e.target.value)}>
            <option>Fee Collection</option><option>Donation</option><option>Other Income</option>
            <option>Utilities</option><option>Salaries</option><option>Maintenance</option>
            <option>Supplies</option><option>Transport</option><option>Other Expense</option>
          </select></label>
          <label>Payment Mode *<select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
            <option value="cash">Cash</option><option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option>
          </select></label>
          <label>Amount (₹) *<input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" required /></label>
          <label className="wide">Description *<input value={description} onChange={e => setDescription(e.target.value)} required placeholder="Brief description" /></label>
          <label>Reference No.<input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="UPI/Chq/NEFT ref" /></label>
          {error && <div className="form-error" style={{ gridColumn: "1 / -1" }}>{error}</div>}
          <div style={{ gridColumn: "1 / -1" }}><button className="primary-button" type="submit">Save entry</button></div>
        </form>
      )}

      <div className="table-scroll">
        <table>
          <thead><tr><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Recorded By</th><th>Time</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "1.5rem" }}>No entries for this date.</td></tr>
            ) : (
              entries.map(e => (
                <tr key={e.id}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: e.entryType === "income" ? "var(--forest)" : "var(--coral)" }}>
                      {e.entryType === "income" ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}{e.entryType}
                    </span>
                  </td>
                  <td>{e.category}</td>
                  <td>{e.description}</td>
                  <td style={{ fontWeight: 600 }}>₹{Number(e.amount).toLocaleString()}</td>
                  <td><span className="status-badge">{e.paymentMode || "—"}</span></td>
                  <td>{e.referenceNumber || "—"}</td>
                  <td>{e.recordedByName || "—"}</td>
                  <td>{e.createdAt ? new Date(e.createdAt).toLocaleTimeString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Bank Book ───────────────────────────────────────────────────────────

function BankBookTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.bankBook(month).then(r => setEntries(r.data)).catch(() => setEntries([])).finally(() => setLoading(false));
  }, [month]);

  const totalDebits = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const totalCredits = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="step-label">BANK BOOK</span>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 12, background: "var(--cream)", borderRadius: 8 }}>
          <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>TOTAL TRANSACTIONS</small>
          <strong style={{ fontSize: 18, display: "block", marginTop: 4 }}>{entries.length}</strong>
        </div>
        <div style={{ padding: 12, background: "#ecfdf5", borderRadius: 8 }}>
          <small style={{ color: "var(--forest)", fontSize: 11, fontWeight: 700 }}>TOTAL CREDITS</small>
          <strong style={{ fontSize: 18, display: "block", marginTop: 4, color: "var(--forest)" }}>₹{totalCredits.toLocaleString()}</strong>
        </div>
        <div style={{ padding: 12, background: "#fef2f2", borderRadius: 8 }}>
          <small style={{ color: "var(--coral)", fontSize: 11, fontWeight: 700 }}>TOTAL DEBITS</small>
          <strong style={{ fontSize: 18, display: "block", marginTop: 4, color: "var(--coral)" }}>₹{totalDebits.toLocaleString()}</strong>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th>Reference No.</th><th>Recorded By</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "1.5rem" }}>No bank transactions found.</td></tr>
            ) : (
              entries.map(e => (
                <tr key={e.id}>
                  <td>{e.date ? new Date(e.date).toLocaleDateString() : "—"}</td>
                  <td><span style={{ color: e.type === "income" ? "var(--forest)" : "var(--coral)", fontWeight: 600 }}>{e.type === "income" ? "Credit" : "Debit"}</span></td>
                  <td>{e.category || "—"}</td>
                  <td>{e.description}</td>
                  <td style={{ fontWeight: 600 }}>₹{Number(e.amount).toLocaleString()}</td>
                  <td>{e.referenceNumber || "—"}</td>
                  <td>{e.recordedByName || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Suppliers ───────────────────────────────────────────────────────────

function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showTxForm, setShowTxForm] = useState(false);
  const [txType, setTxType] = useState("purchase");
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [txError, setTxError] = useState("");

  const load = () => {
    setLoading(true);
    api.suppliers().then(r => setSuppliers(r.data)).catch(() => setSuppliers([])).finally(() => setLoading(false));
    api.supplierOutstanding().then(r => setOutstanding(r.data)).catch(() => {});
  };
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!selected) { setTransactions([]); return; }
    api.supplierTransactions(selected).then(r => setTransactions(r.data)).catch(() => setTransactions([]));
  }, [selected]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      await api.createSupplier({ name, contactPerson, phone, email, gstNumber, address });
      setName(""); setContactPerson(""); setPhone(""); setEmail(""); setGstNumber(""); setAddress(""); setShowForm(false);
      void load();
    } catch (err: any) { setError(err.message || "Failed"); }
  }

  async function handleAddTx(e: FormEvent) {
    e.preventDefault(); if (!selected) return; setTxError("");
    try {
      await api.addSupplierTransaction(selected, { transactionType: txType, amount: Number(txAmount), description: txDescription, transactionDate: txDate });
      setTxAmount(""); setTxDescription(""); setShowTxForm(false);
      const r = await api.supplierTransactions(selected);
      setTransactions(r.data);
    } catch (err: any) { setTxError(err.message || "Failed"); }
  }

  const totalOutstanding = outstanding.reduce((s, o) => s + o.outstanding, 0);

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="step-label">SUPPLIERS</span>
        <button className="primary-button" onClick={() => setShowForm(!showForm)}><Plus size={16} /> Add supplier</button>
      </div>
      {outstanding.length > 0 && (
        <div style={{ padding: 12, background: "#fef3c7", borderRadius: 8, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#92400e" }}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> Total outstanding to suppliers: <strong>₹{totalOutstanding.toLocaleString()}</strong></span>
        </div>
      )}
      {showForm && (
        <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 20, background: "var(--cream)", padding: 16, borderRadius: 8 }}>
          <label>Company Name *<input value={name} onChange={e => setName(e.target.value)} required placeholder="Supplier/company name" /></label>
          <label>Contact Person<input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Primary contact" /></label>
          <label>Phone<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXXXXXXX" /></label>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="supplier@example.com" /></label>
          <label>GST Number<input value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="29AABCV1234A1Z5" /></label>
          <label className="wide">Address<input value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" /></label>
          {error && <div className="form-error" style={{ gridColumn: "1 / -1" }}>{error}</div>}
          <div style={{ gridColumn: "1 / -1" }}><button className="primary-button" type="submit">Create supplier</button></div>
        </form>
      )}
      <div className="table-scroll">
        <table>
          <thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th>GST</th><th>Outstanding</th><th /></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "1.5rem" }}>No suppliers found.</td></tr>
            ) : (
              suppliers.map(s => {
                const out = outstanding.find((o: any) => o.supplierId === s.id);
                return (
                  <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => setSelected(selected === s.id ? null : s.id)}>
                    <td><div className="student-cell"><span><Truck size={18} /></span><div><strong>{s.name}</strong><small>{s.contactPerson || "—"}</small></div></div></td>
                    <td>{s.email || "—"}</td>
                    <td>{s.phone || "—"}</td>
                    <td>{s.gstNumber || "—"}</td>
                    <td style={{ fontWeight: 600, color: out && out.outstanding > 0 ? "var(--coral)" : "var(--forest)" }}>
                      {out ? `₹${out.outstanding.toLocaleString()}` : "—"}
                    </td>
                    <td>{selected === s.id ? "▼" : "▶"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="step-label">SUPPLIER LEDGER</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void api.supplierExport(selected)} className="secondary-button"><Download size={14} /> Export</button>
              <button className="primary-button" onClick={() => setShowTxForm(!showTxForm)}><Plus size={16} /> Add transaction</button>
            </div>
          </div>
          {showTxForm && (
            <form onSubmit={handleAddTx} className="form-grid" style={{ margin: "12px 0", padding: 16, background: "var(--cream)", borderRadius: 8 }}>
              <label>Type *<select value={txType} onChange={e => setTxType(e.target.value)}>
                <option value="purchase">Purchase</option><option value="payment">Payment</option>
                <option value="credit">Credit Note</option><option value="debit">Debit Note</option>
              </select></label>
              <label>Amount (₹) *<input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} min="1" required /></label>
              <label>Date *<input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} required /></label>
              <label className="wide">Description<input value={txDescription} onChange={e => setTxDescription(e.target.value)} placeholder="Invoice/ref details" /></label>
              {txError && <div className="form-error" style={{ gridColumn: "1 / -1" }}>{txError}</div>}
              <div style={{ gridColumn: "1 / -1" }}><button className="primary-button" type="submit">Record transaction</button></div>
            </form>
          )}
          <div className="table-scroll" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Reference</th><th>Amount</th></tr></thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "1.5rem" }}>No transactions yet.</td></tr>
                ) : (
                  transactions.map(t => (
                    <tr key={t.id}>
                      <td>{t.transactionDate ? new Date(t.transactionDate).toLocaleDateString() : "—"}</td>
                      <td><span className={`status-badge ${t.type === "purchase" ? "" : "withdrawn"}`}>{t.type}</span></td>
                      <td>{t.description || "—"}</td>
                      <td>{t.referenceNumber || "—"}</td>
                      <td style={{ fontWeight: 600, color: t.type === "purchase" ? "var(--coral)" : "var(--forest)" }}>₹{Number(t.amount).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Vouchers ────────────────────────────────────────────────────────────

function VouchersTab() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [voucherType, setVoucherType] = useState("payment");
  const [payeeName, setPayeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.vouchers(typeFilter).then(r => setVouchers(r.data)).catch(() => setVouchers([])).finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, [typeFilter]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      await api.createVoucher({ voucherType, voucherDate, payeeName, amount: Number(amount), description, paymentMode });
      setPayeeName(""); setAmount(""); setDescription(""); setShowForm(false);
      void load();
    } catch (err: any) { setError(err.message || "Failed"); }
  }

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="step-label">VOUCHERS</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6 }}>
            <option value="">All types</option>
            <option value="payment">Payment (PV)</option>
            <option value="receipt">Receipt (RV)</option>
            <option value="journal">Journal (JV)</option>
            <option value="expense">Expense (EV)</option>
          </select>
          <button onClick={() => void api.voucherExport(typeFilter)} className="secondary-button"><Download size={14} /> Export</button>
          <button className="primary-button" onClick={() => setShowForm(!showForm)}><Plus size={16} /> Create voucher</button>
        </div>
      </div>
      {showForm && (
        <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 20, background: "var(--cream)", padding: 16, borderRadius: 8 }}>
          <label>Voucher Type *<select value={voucherType} onChange={e => setVoucherType(e.target.value)}>
            <option value="payment">Payment (PV)</option><option value="receipt">Receipt (RV)</option>
            <option value="journal">Journal (JV)</option><option value="expense">Expense (EV)</option>
          </select></label>
          <label>Payee / Payer Name<input value={payeeName} onChange={e => setPayeeName(e.target.value)} placeholder="Name of payee/payer" /></label>
          <label>Amount (₹) *<input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" required /></label>
          <label>Payment Mode<select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option><option value="cheque">Cheque</option>
          </select></label>
          <label>Voucher Date *<input type="date" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} required /></label>
          <label className="wide">Description<input value={description} onChange={e => setDescription(e.target.value)} placeholder="Purpose / narrative" /></label>
          {error && <div className="form-error" style={{ gridColumn: "1 / -1" }}>{error}</div>}
          <div style={{ gridColumn: "1 / -1" }}><button className="primary-button" type="submit">Create voucher</button></div>
        </form>
      )}
      <div className="table-scroll">
        <table>
          <thead><tr><th>Voucher No.</th><th>Type</th><th>Payee</th><th>Description</th><th>Amount</th><th>Mode</th><th>Date</th><th>Status</th><th /></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : vouchers.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: "1.5rem" }}>No vouchers found.</td></tr>
            ) : (
              vouchers.map(v => (
                <tr key={v.id}>
                  <td><strong>{v.number || "—"}</strong></td>
                  <td><span className={`status-badge ${v.type === "payment" ? "withdrawn" : ""}`}>{v.type}</span></td>
                  <td>{v.payeeName || "—"}</td>
                  <td>{v.description || "—"}</td>
                  <td style={{ fontWeight: 600 }}>₹{Number(v.amount).toLocaleString()}</td>
                  <td>{v.paymentMode || "—"}</td>
                  <td>{v.date ? new Date(v.date).toLocaleDateString() : "—"}</td>
                  <td><span className={`status-badge ${v.status === "approved" ? "" : "withdrawn"}`}>{v.status}</span></td>
                  <td><button onClick={() => void api.voucherPreview(v.id)} className="icon-button" title="Preview voucher"><Eye size={14} /></button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Concessions ─────────────────────────────────────────────────────────

function ConcessionsTab() {
  const [concessions, setConcessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [feeCategoryId, setFeeCategoryId] = useState<number>(0);
  const [academicYear, setAcademicYear] = useState("2026–27");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    api.concessions(0, "").then(r => setConcessions(r.data)).catch(() => setConcessions([])).finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.students(studentSearch, "", 1).then(r => setStudents(r.data)).catch(() => setStudents([]));
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  useEffect(() => {
    api.feeCategories().then(r => { setCategories(r.data); if (r.data.length) setFeeCategoryId(r.data[0].id); }).catch(() => {});
  }, []);

  const filtered = concessions.filter(c => !statusFilter || c.status === statusFilter);

  async function handleCreate(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!selectedStudent || !feeCategoryId || !amount || !reason) return;
    try {
      await api.createConcession({ studentId: selectedStudent, feeCategoryId, academicYear, amount: Number(amount), reason });
      setShowForm(false); setAmount(""); setReason(""); setSelectedStudent(null); setStudentSearch("");
      void load();
    } catch (err: any) { setError(err.message || "Failed"); }
  }

  async function handleApprove(id: number) {
    try { await api.approveConcession(id); void load(); } catch { alert("Failed"); }
  }
  async function handleReject(id: number) {
    try { await api.rejectConcession(id); void load(); } catch { alert("Failed"); }
  }

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="step-label">FEE CONCESSIONS</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6 }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="primary-button" onClick={() => setShowForm(!showForm)}><Plus size={16} /> New concession</button>
        </div>
      </div>
      {showForm && (
        <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 20, background: "var(--cream)", padding: 16, borderRadius: 8 }}>
          <label>Student *<select value={selectedStudent ?? ""} onChange={e => { setSelectedStudent(Number(e.target.value) || null); setStudentSearch(""); }} required>
            <option value="">Select student...</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.fullName} — {s.admissionNo}</option>)}
          </select>
          <input placeholder="Search students..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} style={{ marginTop: 6, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, width: "100%" }} />
          </label>
          <label>Fee Category *<select value={feeCategoryId} onChange={e => setFeeCategoryId(Number(e.target.value))} required>
            <option value={0}>Select...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label>Academic Year *<input value={academicYear} onChange={e => setAcademicYear(e.target.value)} /></label>
          <label>Amount (₹) *<input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" required /></label>
          <label className="wide">Reason *<input value={reason} onChange={e => setReason(e.target.value)} required placeholder="Reason for concession" /></label>
          {error && <div className="form-error" style={{ gridColumn: "1 / -1" }}>{error}</div>}
          <div style={{ gridColumn: "1 / -1" }}><button className="primary-button" type="submit">Submit for approval</button></div>
        </form>
      )}
      <div className="table-scroll">
        <table>
          <thead><tr><th>Student</th><th>Class</th><th>Category</th><th>Amount</th><th>Reason</th><th>Status</th><th>Approved By</th><th /></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "1.5rem" }}>No concessions found.</td></tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.studentName}</strong><br /><small>{c.admissionNo}</small></td>
                  <td>{c.className}</td>
                  <td>{c.categoryName}</td>
                  <td style={{ fontWeight: 600 }}>₹{Number(c.amount).toLocaleString()}</td>
                  <td>{c.reason}</td>
                  <td><span className={`status-badge ${c.status === "approved" ? "" : c.status === "rejected" ? "withdrawn" : ""}`}>{c.status}</span></td>
                  <td>{c.approvedByName || "—"}</td>
                  <td>
                    {c.status === "pending" && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="icon-button" style={{ color: "var(--forest)" }} title="Approve" onClick={() => handleApprove(c.id)}><CheckCircle size={14} /></button>
                        <button className="icon-button danger" title="Reject" onClick={() => handleReject(c.id)}><Ban size={14} /></button>
                      </div>
                    )}
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

// ─── Reports ─────────────────────────────────────────────────────────────

function ReportsTab() {
  const [reportTab, setReportTab] = useState("daily");
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split("T")[0]);
  const [dailyData, setDailyData] = useState<any>(null);
  const [defaultersYear, setDefaultersYear] = useState("2026–27");
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [cashFlow, setCashFlow] = useState<any>(null);
  const [cfStart, setCfStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [cfEnd, setCfEnd] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.dailyCollection(dailyDate).then(r => setDailyData(r.data)).catch(() => setDailyData(null)).finally(() => setLoading(false));
  }, [dailyDate]);

  useEffect(() => {
    api.feeDefaulters(defaultersYear).then(r => setDefaulters(r.data)).catch(() => setDefaulters([]));
  }, [defaultersYear]);

  useEffect(() => {
    api.monthlyCollection(month).then(r => setMonthlyData(r.data)).catch(() => setMonthlyData(null));
    api.expenseReport(month).then(r => setExpenseData(r.data)).catch(() => setExpenseData(null));
  }, [month]);

  useEffect(() => {
    api.cashFlow(cfStart, cfEnd).then(r => setCashFlow(r.data)).catch(() => setCashFlow(null));
  }, [cfStart, cfEnd]);

  const reportTabs = [
    { id: "daily", label: "Daily Collection" },
    { id: "monthly", label: "Monthly Collection" },
    { id: "expense", label: "Expense Report" },
    { id: "cashflow", label: "Cash Flow" },
    { id: "defaulters", label: "Fee Defaulters" },
  ];

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {reportTabs.map(rt => (
          <button key={rt.id} className={`tab-pill ${reportTab === rt.id ? "active" : ""}`} onClick={() => setReportTab(rt.id)}>{rt.label}</button>
        ))}
      </div>

      {reportTab === "daily" && (
        <div>
          <span className="step-label">DAILY COLLECTION SUMMARY</span>
          <div style={{ margin: "12px 0", display: "flex", gap: 12, alignItems: "center" }}>
            <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6 }} />
          </div>
          {loading ? <p>Loading...</p> : dailyData ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 16, background: "var(--cream)", borderRadius: 8 }}>
                  <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>TOTAL COLLECTION</small>
                  <strong style={{ fontSize: 24, display: "block", marginTop: 4 }}>₹{Number(dailyData.totalCollected || 0).toLocaleString()}</strong>
                </div>
                <div style={{ padding: 16, background: "var(--cream)", borderRadius: 8 }}>
                  <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>CATEGORIES</small>
                  <strong style={{ fontSize: 24, display: "block", marginTop: 4 }}>{(dailyData.categories || []).length}</strong>
                </div>
              </div>
              {dailyData.categories?.length > 0 && (
                <div className="table-scroll">
                  <table><thead><tr><th>Category</th><th>Transactions</th><th>Total Collected</th></tr></thead>
                    <tbody>{dailyData.categories.map((c: any, i: number) => (
                      <tr key={i}><td>{c.categoryName}</td><td>{c.transactionCount}</td><td style={{ fontWeight: 600 }}>₹{Number(c.totalCollected).toLocaleString()}</td></tr>
                    ))}</tbody></table>
                </div>
              )}
            </div>
          ) : <p className="muted">Select a date to view collection summary.</p>}
        </div>
      )}

      {reportTab === "monthly" && (
        <div>
          <span className="step-label">MONTHLY COLLECTION REPORT</span>
          <div style={{ margin: "12px 0" }}><input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6 }} /></div>
          {monthlyData ? (
            <div>
              <div style={{ padding: 16, background: "var(--cream)", borderRadius: 8, marginBottom: 16 }}>
                <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>TOTAL COLLECTION</small>
                <strong style={{ fontSize: 24, display: "block", marginTop: 4 }}>₹{Number(monthlyData.total || 0).toLocaleString()}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><span className="step-label">BY CATEGORY</span>
                  <div className="table-scroll" style={{ marginTop: 8 }}><table><thead><tr><th>Category</th><th>Amount</th></tr></thead>
                    <tbody>{(monthlyData.byCategory || []).map((c: any, i: number) => (
                      <tr key={i}><td>{c.categoryName || c.name}</td><td>₹{Number(c.amount || c.total).toLocaleString()}</td></tr>
                    ))}</tbody></table></div>
                </div>
                <div><span className="step-label">BY PAYMENT MODE</span>
                  <div className="table-scroll" style={{ marginTop: 8 }}><table><thead><tr><th>Mode</th><th>Amount</th></tr></thead>
                    <tbody>{(monthlyData.byMode || []).map((m: any, i: number) => (
                      <tr key={i}><td><span className="status-badge">{m.mode}</span></td><td>₹{Number(m.amount).toLocaleString()}</td></tr>
                    ))}</tbody></table></div>
                </div>
              </div>
            </div>
          ) : <p className="muted">Select a month to view the report.</p>}
        </div>
      )}

      {reportTab === "expense" && (
        <div>
          <span className="step-label">EXPENSE REPORT</span>
          <div style={{ margin: "12px 0" }}><input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6 }} /></div>
          {expenseData ? (
            <div>
              <div style={{ padding: 16, background: "#fef2f2", borderRadius: 8, marginBottom: 16 }}>
                <small style={{ color: "var(--coral)", fontSize: 11, fontWeight: 700 }}>TOTAL EXPENSES</small>
                <strong style={{ fontSize: 24, display: "block", marginTop: 4, color: "var(--coral)" }}>₹{Number(expenseData.total || 0).toLocaleString()}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><span className="step-label">BY CATEGORY</span>
                  <div className="table-scroll" style={{ marginTop: 8 }}><table><thead><tr><th>Category</th><th>Amount</th></tr></thead>
                    <tbody>{(expenseData.byCategory || []).map((c: any, i: number) => (
                      <tr key={i}><td>{c.name || c.category}</td><td>₹{Number(c.amount || c.total).toLocaleString()}</td></tr>
                    ))}</tbody></table></div>
                </div>
                <div><span className="step-label">BY PAYMENT MODE</span>
                  <div className="table-scroll" style={{ marginTop: 8 }}><table><thead><tr><th>Mode</th><th>Amount</th></tr></thead>
                    <tbody>{(expenseData.byMode || []).map((m: any, i: number) => (
                      <tr key={i}><td><span className="status-badge">{m.mode}</span></td><td>₹{Number(m.amount).toLocaleString()}</td></tr>
                    ))}</tbody></table></div>
                </div>
              </div>
            </div>
          ) : <p className="muted">Select a month to view expenses.</p>}
        </div>
      )}

      {reportTab === "cashflow" && (
        <div>
          <span className="step-label">CASH FLOW STATEMENT</span>
          <div style={{ margin: "12px 0", display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ fontSize: 12 }}>From <input type="date" value={cfStart} onChange={e => setCfStart(e.target.value)} style={{ padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 6, marginLeft: 4 }} /></label>
            <label style={{ fontSize: 12 }}>To <input type="date" value={cfEnd} onChange={e => setCfEnd(e.target.value)} style={{ padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 6, marginLeft: 4 }} /></label>
          </div>
          {cashFlow ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 14, background: "#ecfdf5", borderRadius: 8 }}>
                  <small style={{ color: "var(--forest)", fontSize: 11, fontWeight: 700 }}>TOTAL INCOME</small>
                  <strong style={{ fontSize: 20, display: "block", marginTop: 4, color: "var(--forest)" }}>₹{Number(cashFlow.totalIncome || 0).toLocaleString()}</strong>
                </div>
                <div style={{ padding: 14, background: "#fef2f2", borderRadius: 8 }}>
                  <small style={{ color: "var(--coral)", fontSize: 11, fontWeight: 700 }}>TOTAL EXPENSES</small>
                  <strong style={{ fontSize: 20, display: "block", marginTop: 4, color: "var(--coral)" }}>₹{Number(cashFlow.totalExpenses || 0).toLocaleString()}</strong>
                </div>
                <div style={{ padding: 14, background: cashFlow.netCashFlow >= 0 ? "#ecfdf5" : "#fef2f2", borderRadius: 8 }}>
                  <small style={{ color: cashFlow.netCashFlow >= 0 ? "var(--forest)" : "var(--coral)", fontSize: 11, fontWeight: 700 }}>NET CASH FLOW</small>
                  <strong style={{ fontSize: 20, display: "block", marginTop: 4, color: cashFlow.netCashFlow >= 0 ? "var(--forest)" : "var(--coral)" }}>₹{Number(cashFlow.netCashFlow || 0).toLocaleString()}</strong>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><span className="step-label">INCOME BY CATEGORY</span>
                  <div className="table-scroll" style={{ marginTop: 8 }}><table><thead><tr><th>Category</th><th>Amount</th></tr></thead>
                    <tbody>{(cashFlow.incomeByCategory || []).map((c: any, i: number) => (
                      <tr key={i}><td>{c.category}</td><td style={{ color: "var(--forest)", fontWeight: 600 }}>₹{Number(c.amount).toLocaleString()}</td></tr>
                    ))}</tbody></table></div>
                </div>
                <div><span className="step-label">EXPENSES BY CATEGORY</span>
                  <div className="table-scroll" style={{ marginTop: 8 }}><table><thead><tr><th>Category</th><th>Amount</th></tr></thead>
                    <tbody>{(cashFlow.expensesByCategory || []).map((c: any, i: number) => (
                      <tr key={i}><td>{c.category}</td><td style={{ color: "var(--coral)", fontWeight: 600 }}>₹{Number(c.amount).toLocaleString()}</td></tr>
                    ))}</tbody></table></div>
                </div>
              </div>
            </div>
          ) : <p className="muted">Select a date range to view cash flow.</p>}
        </div>
      )}

      {reportTab === "defaulters" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="step-label">FEE DEFAULTERS</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={defaultersYear} onChange={e => setDefaultersYear(e.target.value)} placeholder="Academic year" style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6, width: 150 }} />
              <button onClick={() => void api.feeDefaultersExport(defaultersYear)} className="secondary-button"><Download size={14} /> Export</button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Student</th><th>Admission No.</th><th>Class</th><th>Total Fee</th><th>Paid</th><th>Pending</th><th>Status</th></tr></thead>
              <tbody>
                {defaulters.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "1.5rem" }}>No defaulters found.</td></tr>
                ) : (
                  defaulters.map(d => (
                    <tr key={d.id}>
                      <td><strong>{d.studentName || "—"}</strong></td>
                      <td>{d.admissionNo || "—"}</td>
                      <td>{d.className || "—"}</td>
                      <td>₹{Number(d.totalFee || 0).toLocaleString()}</td>
                      <td style={{ color: "var(--forest)" }}>₹{Number(d.paid || 0).toLocaleString()}</td>
                      <td style={{ color: "var(--coral)", fontWeight: 600 }}>₹{Number(d.pending || 0).toLocaleString()}</td>
                      <td><span className="status-badge withdrawn">defaulter</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Audit Trail ─────────────────────────────────────────────────────────

function AuditTrailTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    api.auditTrail(entityFilter, 100).then(r => setLogs(r.data)).catch(() => setLogs([])).finally(() => setLoading(false));
  }, [entityFilter]);

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="step-label">AUDIT TRAIL</span>
        <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6 }}>
          <option value="">All activity</option>
          <option value="fee_payment">Fee Payments</option>
          <option value="cashbook">Cash Book</option>
          <option value="voucher">Vouchers</option>
          <option value="supplier">Suppliers</option>
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "1.5rem" }}>Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "1.5rem" }}>No audit logs found.</td></tr>
            ) : (
              logs.map((log: any) => (
                <tr key={log.id}>
                  <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</td>
                  <td>{log.userName || "System"}</td>
                  <td><span className="status-badge">{log.action}</span></td>
                  <td>{log.entityType} #{log.entityId}</td>
                  <td><small style={{ color: "var(--muted)" }}>{typeof log.metadata === "string" ? log.metadata : JSON.stringify(log.metadata)}</small></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
