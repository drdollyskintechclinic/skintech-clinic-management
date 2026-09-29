"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Appointment = {
  id: string; appointmentNumber: string; patientId: string; patientNumber: string; patientName: string; mobile: string;
  doctorName: string; appointmentDate: string; appointmentTime: string; appointmentType: string; treatment: string; status: string;
};
type Template = { id:string; field:string; name:string; content:string; active:boolean; sortOrder:number };

type Consultation = {
  chiefComplaint?: string; examinationFindings?: string; diagnosis?: string; treatmentAdvised?: string;
  procedurePerformed?: string; prescription?: string; doctorNotes?: string; followUpDate?: string;
};

function displayDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return day + "-" + month + "-" + year;
}

export default function ConsultationPage() {
  const params = useParams<{ appointmentId: string }>();
  const appointmentId = params.appointmentId;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [consultation, setConsultation] = useState<Consultation>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);

  async function load() {
    const response = await fetch("/api/consultations?appointmentId=" + encodeURIComponent(appointmentId), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Unable to load consultation."); setLoading(false); return; }
    setAppointment(data.appointment);
    setConsultation(data.consultation ?? {});
    const templateResponse = await fetch("/api/consultation-templates", { cache: "no-store" });
    if (templateResponse.ok) setTemplates((await templateResponse.json()).templates);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [appointmentId]);

  function applyTemplate(field: keyof Consultation, value: string) {
    setConsultation((current) => ({ ...current, [field]: value }));
  }

  function templateSelect(field: keyof Consultation) {
    const items = templates.filter((template) => template.field === field);
    if (!items.length) return null;
    return <select className="template-select" defaultValue="" onChange={(event) => {
      if (event.target.value) applyTemplate(field, event.target.value);
      event.currentTarget.value = "";
    }}>
      <option value="">Use template…</option>
      {items.map((template) => <option key={template.id} value={template.content}>{template.name}</option>)}
    </select>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setSaved(false); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/consultations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, ...Object.fromEntries(form.entries()) })
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setError(data.error ?? "Unable to save consultation."); return; }
    setConsultation(data.consultation); setSaved(true);
  }

  if (loading) return <p className="muted">Loading consultation…</p>;
  if (!appointment) return <p className="error">{error || "Appointment not found."}</p>;

  return <>
    <p className="eyebrow">Clinical record</p>
    <div className="page-header">
      <div><h1>Consultation</h1><p className="lead">{appointment.appointmentNumber} · {displayDate(appointment.appointmentDate)} · {appointment.appointmentTime}</p></div>
      <Link className="secondary-button" href={"/app/appointments?date=" + encodeURIComponent(appointment.appointmentDate)}>Back to appointments</Link>
    </div>

    {error && <p className="error">{error}</p>}
    {saved && <p className="success">Consultation saved successfully.</p>}

    <div className="card patient-summary">
      <div><span className="eyebrow">Patient</span><strong>{appointment.patientNumber} · {appointment.patientName}</strong><small>{appointment.mobile}</small></div>
      <div><span className="eyebrow">Doctor</span><strong>{appointment.doctorName}</strong><small>{appointment.appointmentType}{appointment.treatment ? " · " + appointment.treatment : ""}</small></div>
      <div><span className="eyebrow">Appointment status</span><strong>{appointment.status.replaceAll("_", " ")}</strong></div>
    </div>

    <div className="card form-card">
      <div className="form-header"><div><h2>Clinical consultation</h2><p className="muted">Record the clinical assessment and plan for this visit.</p></div></div>
      <form className="lead-form" onSubmit={submit}>
        <label className="full">Chief complaint / patient's concern
          {templateSelect("chiefComplaint")}
          <textarea name="chiefComplaint" rows={4} value={consultation.chiefComplaint ?? ""} onChange={(e) => applyTemplate("chiefComplaint", e.target.value)} placeholder="What brings the patient to the clinic?" />
        </label>
        <label className="full">Examination / clinical findings
          {templateSelect("examinationFindings")}
          <textarea name="examinationFindings" rows={5} value={consultation.examinationFindings ?? ""} onChange={(e) => applyTemplate("examinationFindings", e.target.value)} placeholder="Record relevant examination findings." />
        </label>
        <label>Diagnosis / assessment
          {templateSelect("diagnosis")}
          <textarea name="diagnosis" rows={4} value={consultation.diagnosis ?? ""} onChange={(e) => applyTemplate("diagnosis", e.target.value)} placeholder="Clinical assessment / diagnosis" />
        </label>
        <label>Treatment advised
          {templateSelect("treatmentAdvised")}
          <textarea name="treatmentAdvised" rows={4} value={consultation.treatmentAdvised ?? ""} onChange={(e) => applyTemplate("treatmentAdvised", e.target.value)} placeholder="Treatment plan and advice" />
        </label>
        <label>Procedure performed
          {templateSelect("procedurePerformed")}
          <textarea name="procedurePerformed" rows={4} value={consultation.procedurePerformed ?? ""} onChange={(e) => applyTemplate("procedurePerformed", e.target.value)} placeholder="Procedure performed during this visit" />
        </label>
        <label>Prescription / medicines
          {templateSelect("prescription")}
          <textarea name="prescription" rows={4} value={consultation.prescription ?? ""} onChange={(e) => applyTemplate("prescription", e.target.value)} placeholder="Medicine, dose, frequency and duration" />
        </label>
        <label className="full">Doctor's notes
          {templateSelect("doctorNotes")}
          <textarea name="doctorNotes" rows={4} value={consultation.doctorNotes ?? ""} onChange={(e) => applyTemplate("doctorNotes", e.target.value)} placeholder="Additional clinical notes" />
        </label>
        <label>Follow-up date
          <input name="followUpDate" type="date" defaultValue={consultation.followUpDate ?? ""} />
        </label>
        <div className="form-actions full">
          <button className="button" disabled={saving}>{saving ? "Saving..." : "Save consultation"}</button>
          <Link className="secondary-button" href={"/app/appointments?date=" + encodeURIComponent(appointment.appointmentDate)}>Cancel</Link>
        </div>
      </form>
    </div>
  </>;
}
