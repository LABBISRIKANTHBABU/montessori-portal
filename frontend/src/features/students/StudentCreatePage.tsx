import { FormEvent, useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleUserRound, FolderOpen, Save, ShieldCheck, UsersRound, FileCheck2, Building2, AlertTriangle } from "lucide-react";
import { api, School } from "../../api";

type Props = { school: School };
type Step = 1 | 2 | 3 | 4 | 5 | 6;

const defaultClasses = ["Pre-K", "LKG", "UKG", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export default function StudentCreatePage({ school }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [academics, setAcademics] = useState({ academicYears: ["2026–27"], boards: ["CBSE", "STATE", "ICSE"], classes: defaultClasses });
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<Record<string, any>>({
    nationality: "Indian",
    academicYear: "2026–27",
    board: "CBSE"
  });

  useEffect(() => { api.academicSetup().then(result => setAcademics(result.data)).catch(() => undefined); }, []);

  // Auto-save to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("student_draft");
    if (saved) {
      try { setFormData(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      localStorage.setItem("student_draft", JSON.stringify(formData));
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [formData]);

  // Duplicate check on admission number
  useEffect(() => {
    if (formData.admissionNo && formData.admissionNo.length >= 3) {
      const timer = setTimeout(() => {
        api.checkDuplicate(formData.admissionNo).then(r => {
          if (r.duplicate) setDuplicateWarning(`Admission number exists: "${r.existing.fullName}" (${r.existing.admissionNo})`);
          else setDuplicateWarning(null);
        }).catch(() => setDuplicateWarning(null));
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.admissionNo]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function nextStep() {
    if (step < 6) setStep((s) => (s + 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prevStep() {
    if (step > 1) setStep((s) => (s - 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 6) {
      nextStep();
      return;
    }
    
    setSaving(true);
    setError("");
    
    try {
      const formPayload = new FormData();
      
      // Map camelCase field names to snake_case for backend
      const fieldMap: Record<string, string> = {
        admissionNo: "admissionNo", studentName: "fullName", studentAadhaar: "studentAadhaarNo",
        penNo: "penNo", aaparId: "apaarId", dateOfBirth: "dateOfBirth", admissionDate: "dateOfAdmission",
        nationality: "nationality", religion: "religion", caste: "caste", subCaste: "subCaste",
        motherTongue: "motherTongue", gender: "gender", academicYear: "academicYear", board: "board",
        previousSchool: "previousSchoolClass", classAdmitted: "classAdmitted", sectionName: "sectionName",
        classLeaving: "classLeaving", dateOfLeaving: "dateOfLeaving", tcNumber: "previousTcNo",
        leavingTcNo: "leavingTcNo", tcTakenDate: "tcTakenDate",
        fatherName: "fatherName", fatherQual: "fatherQualification", fatherOcc: "fatherOccupation",
        fatherAadhaar: "fatherAadhaarNo", fatherMobile: "fatherMobileNumber", fatherEmail: "fatherEmail",
        motherName: "motherName", motherQual: "motherQualification", motherOcc: "motherOccupation",
        motherAadhaar: "motherAadhaarNo", motherMobile: "motherMobileNumber", motherEmail: "motherEmail",
        motherBankAcc: "motherBankAccountNo", bankIfsc: "bankIfscCode",
        residenceAddress: "residenceAddress"
      };
      
      for (const [key, backendKey] of Object.entries(fieldMap)) {
        if (formData[key]) formPayload.append(backendKey, formData[key]);
      }
      
      formPayload.append("confirmed", "on");
      
      // Handle photo file
      if (photoInputRef.current?.files?.[0]) {
        formPayload.append("photo", photoInputRef.current.files[0]);
      }
      
      await api.createStudent(formPayload);
      localStorage.removeItem("student_draft");
      navigate("/students", { state: { notice: "Student record created successfully." } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The student record could not be created.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  const stepsInfo = [
    { num: 1, title: "Student Info", icon: CircleUserRound },
    { num: 2, title: "Academic", icon: BookOpen },
    { num: 3, title: "Father", icon: UsersRound },
    { num: 4, title: "Mother", icon: UsersRound },
    { num: 5, title: "Address & Docs", icon: Building2 },
    { num: 6, title: "Review", icon: FileCheck2 }
  ];

  return (
    <div className="page student-create-page">
      <div className="student-create-heading">
        <button className="back-button" onClick={() => navigate("/students")}><ArrowLeft size={17} /> Student directory</button>
        <div className="page-title">
          <div>
            <span className="eyebrow">NEW STUDENT WIZARD</span>
            <h1>Begin a student journey.</h1>
            <p>Step {step} of 6: {stepsInfo[step-1].title}</p>
          </div>
          <span className="draft-pill"><Save size={14} /> {autoSaved ? "Saved!" : "Draft record"}</span>
        </div>
      </div>

      {error && <div className="form-error form-banner">{error}</div>}

      <div className="wizard-layout">
        <aside className="wizard-progress">
          <nav aria-label="Wizard progress">
            {stepsInfo.map(s => (
              <div key={s.num} className={`wizard-step ${step === s.num ? "active" : step > s.num ? "completed" : ""}`}>
                <span className="step-icon">
                  {step > s.num ? <Check size={14} /> : <s.icon size={15} />}
                </span>
                <strong>{s.title}</strong>
              </div>
            ))}
          </nav>
          <div className="privacy-note"><ShieldCheck size={18} /><p><strong>Protected data</strong>Aadhaar is masked in staff views.</p></div>
        </aside>

        <form onSubmit={submit} className="wizard-form">
          <div className="form-sections">
            
            {step === 1 && (
              <FormSection title="Student Information" description="Identity and demographic identifiers matching the Master Schema.">
                {duplicateWarning && <div className="form-banner warning"><AlertTriangle size={16} /> {duplicateWarning}</div>}
                <Field name="admissionNo" label="Admission No" required value={formData.admissionNo || ""} onChange={handleInput} />
                <Field name="studentName" label="Name of the Pupil" required span="wide" value={formData.studentName || ""} onChange={handleInput} />
                <SelectField name="gender" label="Gender" options={["male", "female", "other"]} placeholder="Select gender" value={formData.gender || ""} onChange={handleInput} />
                <Field name="studentAadhaar" label="Student Aadhaar No" inputMode="numeric" pattern="[0-9]{12}" maxLength={12} value={formData.studentAadhaar || ""} onChange={handleInput} />
                <Field name="penNo" label="PEN No" value={formData.penNo || ""} onChange={handleInput} />
                <Field name="aaparId" label="AAPAR ID" value={formData.aaparId || ""} onChange={handleInput} />
                <Field name="dateOfBirth" label="Date of Birth" type="date" required value={formData.dateOfBirth || ""} onChange={handleInput} />
                <Field name="admissionDate" label="Date of Admission" type="date" required value={formData.admissionDate || ""} onChange={handleInput} />
                <Field name="nationality" label="Nationality" value={formData.nationality || "Indian"} onChange={handleInput} />
                <Field name="religion" label="Religion" value={formData.religion || ""} onChange={handleInput} />
                <Field name="caste" label="Caste" value={formData.caste || ""} onChange={handleInput} />
                <Field name="subCaste" label="Sub Caste" value={formData.subCaste || ""} onChange={handleInput} />
                <Field name="motherTongue" label="Mother Tongue" value={formData.motherTongue || ""} onChange={handleInput} />
              </FormSection>
            )}

            {step === 2 && (
              <FormSection title="Academic" description="Previous schooling and current placement.">
                <SelectField name="academicYear" label="Academic Year" required options={academics.academicYears} placeholder="Select year" value={formData.academicYear || ""} onChange={handleInput} />
                <SelectField name="board" label="Board" required options={academics.boards} placeholder="Select board" value={formData.board || ""} onChange={handleInput} />
                <Field name="previousSchool" label="Previous School & Class" span="wide" value={formData.previousSchool || ""} onChange={handleInput} />
                <SelectField name="classAdmitted" label="Class Admitted" required options={academics.classes} placeholder="Select class" value={formData.classAdmitted || ""} onChange={handleInput} />
                <Field name="sectionName" label="Section" value={formData.sectionName || ""} onChange={handleInput} />
                <SelectField name="classLeaving" label="Class Leaving" options={academics.classes} placeholder="Select class" value={formData.classLeaving || ""} onChange={handleInput} />
                <Field name="dateOfLeaving" label="Date of Leaving" type="date" value={formData.dateOfLeaving || ""} onChange={handleInput} />
                <Field name="tcNumber" label="TC Number" value={formData.tcNumber || ""} onChange={handleInput} />
                <Field name="leavingTcNo" label="Leaving TC No." value={formData.leavingTcNo || ""} onChange={handleInput} />
                <Field name="tcTakenDate" label="TC Taken Date" type="date" value={formData.tcTakenDate || ""} onChange={handleInput} />
              </FormSection>
            )}

            {step === 3 && (
              <FormSection title="Father Information" description="Primary guardian details.">
                <Field name="fatherName" label="Father Name" span="wide" value={formData.fatherName || ""} onChange={handleInput} />
                <Field name="fatherQual" label="Father Qualification" value={formData.fatherQual || ""} onChange={handleInput} />
                <Field name="fatherOcc" label="Father Occupation" value={formData.fatherOcc || ""} onChange={handleInput} />
                <Field name="fatherAadhaar" label="Father Aadhaar No" inputMode="numeric" pattern="[0-9]{12}" maxLength={12} value={formData.fatherAadhaar || ""} onChange={handleInput} />
                <Field name="fatherMobile" label="Father Mobile Number" type="tel" value={formData.fatherMobile || ""} onChange={handleInput} />
                <Field name="fatherEmail" label="Father Mail ID" type="email" value={formData.fatherEmail || ""} onChange={handleInput} />
              </FormSection>
            )}

            {step === 4 && (
              <FormSection title="Mother Information" description="Secondary guardian and financial details.">
                <Field name="motherName" label="Mother Name" span="wide" value={formData.motherName || ""} onChange={handleInput} />
                <Field name="motherQual" label="Mother Qualification" value={formData.motherQual || ""} onChange={handleInput} />
                <Field name="motherOcc" label="Mother Occupation" value={formData.motherOcc || ""} onChange={handleInput} />
                <Field name="motherAadhaar" label="Mother Aadhar No." inputMode="numeric" pattern="[0-9]{12}" maxLength={12} value={formData.motherAadhaar || ""} onChange={handleInput} />
                <Field name="motherMobile" label="Mother Mobile No" type="tel" value={formData.motherMobile || ""} onChange={handleInput} />
                <Field name="motherEmail" label="Mother Mail ID" type="email" value={formData.motherEmail || ""} onChange={handleInput} />
                <Field name="motherBankAcc" label="Mother Bank Account No" value={formData.motherBankAcc || ""} onChange={handleInput} />
                <Field name="bankIfsc" label="Bank IFSC Code" value={formData.bankIfsc || ""} onChange={handleInput} />
              </FormSection>
            )}

            {step === 5 && (
              <FormSection title="Address & Documents" description="Residence and required uploads.">
                <label className="field wide">
                  <span>Residence Address <b>*</b></span>
                  <textarea name="residenceAddress" required rows={3} value={formData.residenceAddress || ""} onChange={handleInput as any} />
                </label>
                <label className="photo-field wide">
                  <span>Photo of Student</span>
                  <input ref={photoInputRef} name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
                  <small>Max 5 MB. JPG, PNG or WebP.</small>
                </label>
              </FormSection>
            )}

            {step === 6 && (
              <FormSection title="Review & Submit" description="Verify the details against the physical admission form.">
                <div className="review-grid">
                  <p><strong>Pupil Name:</strong> {formData.studentName}</p>
                  <p><strong>Admission No:</strong> {formData.admissionNo}</p>
                  <p><strong>Gender:</strong> {formData.gender || "—"}</p>
                  <p><strong>Date of Birth:</strong> {formData.dateOfBirth || "—"}</p>
                  <p><strong>Academic Year:</strong> {formData.academicYear || "—"}</p>
                  <p><strong>Board:</strong> {formData.board || "—"}</p>
                  <p><strong>Class Admitted:</strong> {formData.classAdmitted} {formData.sectionName ? `· ${formData.sectionName}` : ""}</p>
                  <p><strong>Father Name:</strong> {formData.fatherName || "—"}</p>
                  <p><strong>Mother Name:</strong> {formData.motherName || "—"}</p>
                  <p><strong>Address:</strong> {formData.residenceAddress || "—"}</p>
                </div>
                <div className="form-declaration wide">
                  <label><input name="confirmed" type="checkbox" required /><span><strong>I confirm these details match the provided documents.</strong></span></label>
                </div>
              </FormSection>
            )}

            <div className="wizard-footer">
              <button type="button" className="secondary-button" onClick={prevStep} disabled={step === 1}>
                <ArrowLeft size={17} /> Back
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {step === 6 ? (saving ? "Creating…" : "Submit Record") : "Next Step"} 
                {step !== 6 && <ArrowRight size={17} />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="form-card fade-in">
      <div className="form-card-head">
        <div><h2>{title}</h2><p>{description}</p></div>
      </div>
      <div className="form-grid">{children}</div>
    </div>
  );
}

function Field({ label, hint, span, ...props }: any) {
  return <label className={`field ${span || ""}`}><span>{label} {props.required && <b>*</b>}</span><input {...props} />{hint && <small>{hint}</small>}</label>;
}

function SelectField({ name, label, options, placeholder, required, value, onChange }: any) {
  return (
    <label className="field">
      <span>{label} {required && <b>*</b>}</span>
      <select name={name} required={required} value={value} onChange={onChange}>
        <option value="" disabled>{placeholder}</option>
        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <label className="field wide"><span>{label}</span><div className="readonly-field"><Check size={16} /> {value}</div></label>;
}
