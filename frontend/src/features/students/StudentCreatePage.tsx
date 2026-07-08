import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  Camera,
  Check,
  CircleUserRound,
  FileCheck2,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { api, School } from "../../api";

type Props = { school: School };
type Step = 1 | 2 | 3 | 4 | 5 | 6;

const defaultClasses = ["Pre-K", "LKG", "UKG", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export default function StudentCreatePage({ school }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [academics, setAcademics] = useState({ academicYears: ["2026-27"], boards: ["CBSE", "STATE", "ICSE"], classes: defaultClasses });
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoObjectPosition, setPhotoObjectPosition] = useState(50);
  const [photoZoom, setPhotoZoom] = useState(1);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Record<string, any>>({
    nationality: "Indian",
    country: "India",
    academicYear: "2026-27",
    board: "CBSE",
  });

  useEffect(() => { api.academicSetup().then(result => setAcademics(result.data)).catch(() => undefined); }, []);

  useEffect(() => {
    const saved = localStorage.getItem("student_draft");
    if (saved) {
      try { setFormData(prev => ({ ...prev, ...JSON.parse(saved) })); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      localStorage.setItem("student_draft", JSON.stringify(formData));
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 1800);
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [formData]);

  useEffect(() => {
    if (formData.admissionNo && formData.admissionNo.length >= 3) {
      const timer = setTimeout(() => {
        api.checkDuplicate(formData.admissionNo).then(result => {
          if (result.duplicate) setDuplicateWarning(`Admission number exists: "${result.existing.fullName}" (${result.existing.admissionNo})`);
          else setDuplicateWarning(null);
        }).catch(() => setDuplicateWarning(null));
      }, 500);
      return () => clearTimeout(timer);
    }
    setDuplicateWarning(null);
  }, [formData.admissionNo]);

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  function handleInput(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setFormData(prev => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoObjectPosition(50);
    setPhotoZoom(1);
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview("");
    setPhotoObjectPosition(50);
    setPhotoZoom(1);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function nextStep() {
    if (step < 6) setStep(value => (value + 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prevStep() {
    if (step > 1) setStep(value => (value - 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function structuredAddress() {
    return [
      formData.addressLine,
      formData.city,
      formData.district,
      formData.state,
      formData.country,
      formData.pin ? `PIN ${formData.pin}` : "",
    ].filter(Boolean).join(", ");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 6) return nextStep();

    setSaving(true);
    setError("");
    try {
      const payloadData: Record<string, any> = { ...formData, residenceAddress: formData.residenceAddress || structuredAddress() };
      const formPayload = new FormData();
      const fieldMap: Record<string, string> = {
        admissionNo: "admissionNo",
        studentName: "fullName",
        studentAadhaar: "studentAadhaarNo",
        penNo: "penNo",
        aaparId: "apaarId",
        dateOfBirth: "dateOfBirth",
        admissionDate: "dateOfAdmission",
        nationality: "nationality",
        religion: "religion",
        caste: "caste",
        subCaste: "subCaste",
        motherTongue: "motherTongue",
        gender: "gender",
        academicYear: "academicYear",
        board: "board",
        previousSchool: "previousSchoolClass",
        classAdmitted: "classAdmitted",
        sectionName: "sectionName",
        classLeaving: "classLeaving",
        dateOfLeaving: "dateOfLeaving",
        tcNumber: "previousTcNo",
        leavingTcNo: "leavingTcNo",
        tcTakenDate: "tcTakenDate",
        fatherName: "fatherName",
        fatherQual: "fatherQualification",
        fatherOcc: "fatherOccupation",
        fatherAadhaar: "fatherAadhaarNo",
        fatherMobile: "fatherMobileNumber",
        fatherEmail: "fatherEmail",
        motherName: "motherName",
        motherQual: "motherQualification",
        motherOcc: "motherOccupation",
        motherAadhaar: "motherAadhaarNo",
        motherMobile: "motherMobileNumber",
        motherEmail: "motherEmail",
        guardianName: "guardianName",
        guardianMobile: "guardianMobileNumber",
        guardianEmail: "guardianEmail",
        guardianRelation: "guardianRelation",
        motherBankAcc: "motherBankAccountNo",
        bankIfsc: "bankIfscCode",
        residenceAddress: "residenceAddress",
      };

      for (const [key, backendKey] of Object.entries(fieldMap)) {
        if (payloadData[key]) formPayload.append(backendKey, payloadData[key]);
      }
      formPayload.append("confirmed", "on");
      if (photoInputRef.current?.files?.[0]) formPayload.append("photo", photoInputRef.current.files[0]);

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
    { num: 1, title: "Student", icon: CircleUserRound },
    { num: 2, title: "Parents", icon: UsersRound },
    { num: 3, title: "Address", icon: Building2 },
    { num: 4, title: "Admission", icon: BookOpen },
    { num: 5, title: "Photo", icon: Camera },
    { num: 6, title: "Preview", icon: FileCheck2 },
  ];

  return (
    <div className="page student-create-page">
      <div className="student-create-heading">
        <button className="back-button" onClick={() => navigate("/students")}><ArrowLeft size={17} /> Student directory</button>
        <div className="page-title">
          <div>
            <span className="eyebrow">NEW STUDENT WIZARD</span>
            <h1>Begin a student journey.</h1>
            <p>{school.name} · Step {step} of 6: {stepsInfo[step - 1].title}</p>
          </div>
          <span className="draft-pill"><Save size={14} /> {autoSaved ? "Saved!" : "Draft record"}</span>
        </div>
      </div>

      {error && <div className="form-error form-banner">{error}</div>}

      <div className="wizard-layout">
        <aside className="wizard-progress">
          <nav aria-label="Wizard progress">
            {stepsInfo.map(item => (
              <div key={item.num} className={`wizard-step ${step === item.num ? "active" : step > item.num ? "completed" : ""}`}>
                <span className="step-icon">{step > item.num ? <Check size={14} /> : <item.icon size={15} />}</span>
                <strong>{item.title}</strong>
              </div>
            ))}
          </nav>
          <div className="privacy-note"><ShieldCheck size={18} /><p><strong>Protected data</strong>Aadhaar is masked in staff views.</p></div>
        </aside>

        <form onSubmit={submit} className="wizard-form">
          <div className="form-sections">
            {step === 1 && (
              <FormSection title="Student" description="Core student identity and demographic details.">
                <Field name="studentName" label="Name of the Pupil" required span="wide" value={formData.studentName || ""} onChange={handleInput} />
                <SelectField name="gender" label="Gender" options={["male", "female", "other"]} placeholder="Select gender" value={formData.gender || ""} onChange={handleInput} />
                <Field name="dateOfBirth" label="Date of Birth" type="date" required value={formData.dateOfBirth || ""} onChange={handleInput} />
                <Field name="studentAadhaar" label="Student Aadhaar No" inputMode="numeric" pattern="[0-9]{12}" maxLength={12} value={formData.studentAadhaar || ""} onChange={handleInput} />
                <Field name="penNo" label="PEN No" value={formData.penNo || ""} onChange={handleInput} />
                <Field name="aaparId" label="AAPAR ID" value={formData.aaparId || ""} onChange={handleInput} />
                <Field name="nationality" label="Nationality" value={formData.nationality || "Indian"} onChange={handleInput} />
                <Field name="religion" label="Religion" value={formData.religion || ""} onChange={handleInput} />
                <Field name="caste" label="Caste" value={formData.caste || ""} onChange={handleInput} />
                <Field name="subCaste" label="Sub Caste" value={formData.subCaste || ""} onChange={handleInput} />
                <Field name="motherTongue" label="Mother Tongue" value={formData.motherTongue || ""} onChange={handleInput} />
              </FormSection>
            )}

            {step === 2 && (
              <FormSection title="Parents" description="Father, mother and guardian details inside one protected card.">
                <Subsection title="Father" />
                <Field name="fatherName" label="Father Name" value={formData.fatherName || ""} onChange={handleInput} />
                <Field name="fatherQual" label="Father Qualification" value={formData.fatherQual || ""} onChange={handleInput} />
                <Field name="fatherOcc" label="Father Occupation" value={formData.fatherOcc || ""} onChange={handleInput} />
                <Field name="fatherAadhaar" label="Father Aadhaar No" inputMode="numeric" maxLength={12} value={formData.fatherAadhaar || ""} onChange={handleInput} />
                <Field name="fatherMobile" label="Father Mobile Number" type="tel" value={formData.fatherMobile || ""} onChange={handleInput} />
                <Field name="fatherEmail" label="Father Mail ID" type="email" value={formData.fatherEmail || ""} onChange={handleInput} />
                <Subsection title="Mother" />
                <Field name="motherName" label="Mother Name" value={formData.motherName || ""} onChange={handleInput} />
                <Field name="motherQual" label="Mother Qualification" value={formData.motherQual || ""} onChange={handleInput} />
                <Field name="motherOcc" label="Mother Occupation" value={formData.motherOcc || ""} onChange={handleInput} />
                <Field name="motherAadhaar" label="Mother Aadhaar No" inputMode="numeric" maxLength={12} value={formData.motherAadhaar || ""} onChange={handleInput} />
                <Field name="motherMobile" label="Mother Mobile No" type="tel" value={formData.motherMobile || ""} onChange={handleInput} />
                <Field name="motherEmail" label="Mother Mail ID" type="email" value={formData.motherEmail || ""} onChange={handleInput} />
                <Field name="motherBankAcc" label="Mother Bank Account No" value={formData.motherBankAcc || ""} onChange={handleInput} />
                <Field name="bankIfsc" label="Bank IFSC Code" value={formData.bankIfsc || ""} onChange={handleInput} />
                <Subsection title="Guardian / Emergency Contact" />
                <Field name="guardianName" label="Guardian Name" value={formData.guardianName || ""} onChange={handleInput} />
                <Field name="guardianRelation" label="Guardian Relation" value={formData.guardianRelation || ""} onChange={handleInput} />
                <Field name="guardianMobile" label="Guardian Mobile" type="tel" value={formData.guardianMobile || ""} onChange={handleInput} />
                <Field name="guardianEmail" label="Guardian Email" type="email" value={formData.guardianEmail || ""} onChange={handleInput} />
              </FormSection>
            )}

            {step === 3 && (
              <FormSection title="Address" description="Structured residence details used to build the official address.">
                <Field name="country" label="Country" value={formData.country || "India"} onChange={handleInput} />
                <Field name="state" label="State" value={formData.state || ""} onChange={handleInput} />
                <Field name="district" label="District" value={formData.district || ""} onChange={handleInput} />
                <Field name="city" label="City" value={formData.city || ""} onChange={handleInput} />
                <Field name="pin" label="PIN" inputMode="numeric" maxLength={6} value={formData.pin || ""} onChange={handleInput} />
                <Field name="addressLine" label="House / Street / Area" span="wide" value={formData.addressLine || ""} onChange={handleInput} />
                <label className="field wide">
                  <span>Full Address Override</span>
                  <textarea name="residenceAddress" rows={3} value={formData.residenceAddress || ""} onChange={handleInput} placeholder="Optional: use this if the formatted address needs manual wording." />
                </label>
              </FormSection>
            )}

            {step === 4 && (
              <FormSection title="Admission" description="Academic year, class placement and transfer certificate details.">
                {duplicateWarning && <div className="form-banner warning"><AlertTriangle size={16} /> {duplicateWarning}</div>}
                <Field name="admissionNo" label="Admission No" required value={formData.admissionNo || ""} onChange={handleInput} />
                <Field name="admissionDate" label="Date of Admission" type="date" required value={formData.admissionDate || ""} onChange={handleInput} />
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

            {step === 5 && (
              <FormSection title="Photo" description="Upload, preview, replace, delete and adjust the student photo framing.">
                <div className="photo-editor wide">
                  <div className="photo-preview-frame">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Student preview" style={{ objectPosition: `50% ${photoObjectPosition}%`, transform: `scale(${photoZoom})` }} />
                    ) : (
                      <div className="photo-placeholder"><Camera size={38} /><span>No photo selected</span></div>
                    )}
                  </div>
                  <div className="photo-editor-controls">
                    <input ref={photoInputRef} name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
                    <small>Max 5 MB. JPG, PNG or WebP.</small>
                    <label>Vertical crop position<input type="range" min="0" max="100" value={photoObjectPosition} onChange={event => setPhotoObjectPosition(Number(event.target.value))} /></label>
                    <label>Preview zoom<input type="range" min="1" max="1.8" step="0.05" value={photoZoom} onChange={event => setPhotoZoom(Number(event.target.value))} /></label>
                    <div className="photo-actions">
                      <button type="button" className="secondary-button" onClick={() => photoInputRef.current?.click()}><RotateCcw size={15} /> Replace</button>
                      <button type="button" className="danger-button" onClick={clearPhoto}><Trash2 size={15} /> Delete</button>
                    </div>
                  </div>
                </div>
              </FormSection>
            )}

            {step === 6 && (
              <FormSection title="Preview" description="Verify the details against the physical admission form before saving.">
                <div className="review-grid">
                  <p><strong>Pupil Name:</strong> {formData.studentName || "—"}</p>
                  <p><strong>Admission No:</strong> {formData.admissionNo || "—"}</p>
                  <p><strong>Gender:</strong> {formData.gender || "—"}</p>
                  <p><strong>Date of Birth:</strong> {formData.dateOfBirth || "—"}</p>
                  <p><strong>Academic Year:</strong> {formData.academicYear || "—"}</p>
                  <p><strong>Board:</strong> {formData.board || "—"}</p>
                  <p><strong>Class Admitted:</strong> {formData.classAdmitted || "—"} {formData.sectionName ? `· ${formData.sectionName}` : ""}</p>
                  <p><strong>Father:</strong> {formData.fatherName || "—"}</p>
                  <p><strong>Mother:</strong> {formData.motherName || "—"}</p>
                  <p><strong>Guardian:</strong> {formData.guardianName || "—"}</p>
                  <p><strong>Address:</strong> {formData.residenceAddress || structuredAddress() || "—"}</p>
                  <p><strong>Photo:</strong> {photoPreview ? "Selected" : "Not uploaded"}</p>
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
              <button type="submit" className="primary-button" disabled={saving || Boolean(duplicateWarning)}>
                {step === 6 ? (saving ? "Creating..." : "Submit Record") : "Next Step"}
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

function Subsection({ title }: { title: string }) {
  return <div className="form-subsection wide"><strong>{title}</strong></div>;
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
        {options.map((option: string) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
