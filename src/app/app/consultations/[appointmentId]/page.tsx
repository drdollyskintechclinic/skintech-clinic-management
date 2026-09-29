"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Appointment = {
  appointmentNumber: string;
  patientNumber: string;
  patientName: string;
  mobile: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  treatment: string;
  status: string;
};

type Consultation = {
  chiefComplaint?: string;
  examination?: string;
  assessment?: string;
  treatmentAdvised?: string;
  procedurePerformed?: string;
  prescription?: string;
  notes?: string;
  followUpDate?: string;
};

export default function ConsultationPage() {
  const params = useParams<{ appointmentId: string }>();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [consultation, setConsultation] = useState<Consultation>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch(`/api/consultations/${params.appointmentId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Unable to load consultation.");
      setLoading(false);
      return;
    }
    setAppointment(data.appointment);
    setConsultation(data.consultation ?? {});
    setLoading(false);
  }

  useEffect(() => { if (params.appointmentId) void load(); }, [params.appointmentId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");

    const response = await fetch(`/api/consultations/${params.appointmentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Unable to save consultation.");
      return;
    }

    setConsultation(data.consultation);
  }

  if (loading) return <><p className="eyebrow">Clinical record</p><h1>Consultation</h1><p className="muted">Loading...</p></>;
  if (!appointment) return <><p className="eyebrow">Clinical record</p><h1>Consultation</h1><p className="error">{error || "Appointment not found."}</p></>;

  return <>
    <p className="eyebrow">Clinical record</p>
    <div className="page-header">
      <div>
        <h1>Consultation</h1>
        <p className="lead">Record the clinical assessment and plan for this appointment.</p>
      </div>
      <a className="secondary-button" href={`/app/appointments?date=${appointment.appointmentDate}`}>Back to appointments</a>
    </div>

    {error && <p className="error">{error}</p>}

    <div className="card patient-summary">
      <div><span>Patient</span><strong>{appointment.patientNumber} · {appointment.patientName}</strong></div>
      <div><span>Mobile</span><strong>{appointment.mobile}</strong></div>
      <div><span>Appointment</span><strong>{appointment.appointmentNumber}</strong></div>
      <div><span>Date & Time</span><strong>{appointment.appointmentDate} · {appointment.appointmentTime}</strong></div>
      <div><span>Doctor</span><strong>{appointment.doctorName}</strong></div>
      <div><span>Purpose</span><strong>{appointment.treatment || appointment.appointmentType}</strong></div>
    </div>

    <form className="card clinical-form" onSubmit={submit}>
      <h2>Clinical consultation</h2>
      <label>Chief complaint / patient's concern
        <textarea name="chiefComplaint" rows={3} defaultValue={consultation.chiefComplaint ?? ""} placeholder="What is the patient concerned about?" />
      </label>
      <label>Examination / clinical findings
        <textarea name="examination" rows={4} defaultValue={consultation.examination ?? ""} placeholder="Record relevant examination findings..." />
      </label>
      <label>Diagnosis / assessment
        <textarea name="assessment" rows={4} defaultValue={consultation.assessment ?? ""} placeholder="Clinical assessment / diagnosis..." />
      </label>
      <label>Treatment advised
        <textarea name="treatmentAdvised" rows={4} defaultValue={consultation.treatmentAdvised ?? ""} placeholder="Treatment plan and advice..." />
      </label>
      <label>Procedure performed
        <textarea name="procedurePerformed" rows={4} defaultValue={consultation.procedurePerformed ?? ""} placeholder="Procedure performed during this visit..." />
      </label>
      <label>Prescription / medicines
        <textarea name="prescription" rows={4} defaultValue={consultation.prescription ?? ""} placeholder="Medicine name, dose, frequency and duration..." />
      </label>
      <label>Doctor's notes
        <textarea name="notes" rows={4} defaultValue={consultation.notes ?? ""} placeholder="Additional clinical notes..." />
      </label>
      <label>Follow-up date
        <input name="followUpDate" type="date" defaultValue={consultation.followUpDate ?? ""} />
      </label>
      <div className="form-actions">
        <button className="button" disabled={saving}>{saving ? "Saving..." : "Save consultation"}</button>
      </div>
    </form>
  </>;
}
