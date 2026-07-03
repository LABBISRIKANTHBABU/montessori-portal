import { useState, useEffect, FormEvent } from "react";
import { WalletCards, Plus, CheckCircle, Eye } from "lucide-react";
import { api, Student } from "../../api";

interface FeeCollectionProps {
  studentId: number;
  studentName?: string;
}

export default function FeeCollection({ studentId, studentName }: FeeCollectionProps) {
  const [fees, setFees] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feeCategoryId, setFeeCategoryId] = useState<number>(0);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("cash");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.studentFees(studentId),
      api.feePayments(studentId),
      api.feeCategories()
    ])
      .then(([feesRes, paymentsRes, catsRes]) => {
        setFees(feesRes.data);
        setPayments(paymentsRes.data);
        setCategories(catsRes.data);
        if (catsRes.data.length) setFeeCategoryId(catsRes.data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  async function handleCollect(e: FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!feeCategoryId || !amount) return;
    try {
      await api.collectFee({
        studentId,
        feeCategoryId,
        academicYear: "2026–27",
        amount: Number(amount),
        paymentMode: mode,
        paymentDate: new Date().toISOString().split("T")[0],
      });
      setAmount("");
      setShowForm(false);
      setSuccess("Payment collected successfully");
      setTimeout(() => setSuccess(""), 3000);
      const [feesRes, paymentsRes] = await Promise.all([api.studentFees(studentId), api.feePayments(studentId)]);
      setFees(feesRes.data);
      setPayments(paymentsRes.data);
    } catch (err: any) {
      setError(err.message || "Payment failed");
    }
  }

  if (loading) return <div className="panel" style={{ padding: 24 }}>Loading fee data...</div>;

  const totalFee = fees?.summary?.reduce((s: number, f: any) => s + f.total, 0) || 0;
  const paid = fees?.summary?.reduce((s: number, f: any) => s + f.paid, 0) || 0;
  const pending = fees?.totalPending || 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="step-label">FEE SUMMARY</span>
        <button className="primary-button" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Collect fee
        </button>
      </div>

      {fees && (
        <div className="form-grid" style={{ gap: 12, marginBottom: 24 }}>
          <div style={{ padding: 16, background: "var(--cream)", borderRadius: 8 }}>
            <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>TOTAL FEE</small>
            <strong style={{ fontSize: 22, display: "block", marginTop: 4 }}>₹{totalFee.toLocaleString()}</strong>
          </div>
          <div style={{ padding: 16, background: "var(--cream)", borderRadius: 8 }}>
            <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>PAID</small>
            <strong style={{ fontSize: 22, display: "block", marginTop: 4, color: "var(--forest)" }}>₹{paid.toLocaleString()}</strong>
          </div>
          <div style={{ padding: 16, background: "var(--cream)", borderRadius: 8 }}>
            <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>PENDING</small>
            <strong style={{ fontSize: 22, display: "block", marginTop: 4, color: pending > 0 ? "var(--coral)" : "var(--forest)" }}>
              ₹{pending.toLocaleString()}
            </strong>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCollect} className="form-grid" style={{ marginBottom: 24, background: "var(--cream)", padding: 16, borderRadius: 8 }}>
          <label>
            Fee Category
            <select value={feeCategoryId} onChange={e => setFeeCategoryId(Number(e.target.value))}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            Amount (₹)
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" required />
          </label>
          <label>
            Payment mode
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </label>
          {error && <div className="form-error" style={{ gridColumn: "1 / -1" }}>{error}</div>}
          {success && (
            <div style={{ gridColumn: "1 / -1", padding: "8px 12px", background: "#e8f5e9", borderRadius: 6, fontSize: 13, color: "var(--forest)", display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle size={16} /> {success}
            </div>
          )}
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="primary-button" type="submit">Collect payment</button>
          </div>
        </form>
      )}

      <span className="step-label">PAYMENT HISTORY</span>
      <div className="table-scroll" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Mode</th>
              <th>Receipt</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "1.5rem" }}>No payments recorded.</td></tr>
            ) : (
              payments.map(p => (
                <tr key={p.id}>
                  <td>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "—"}</td>
                  <td>{p.categoryName || "—"}</td>
                  <td>₹{Number(p.amount).toLocaleString()}</td>
                  <td>{p.paymentMode || "—"}</td>
                  <td><strong>{p.receiptNumber || "—"}</strong></td>
                  <td><a href={api.receiptPreview(p.id)} target="_blank" rel="noreferrer" className="icon-button" title="View receipt"><Eye size={14} /></a></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
