"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Patient = { id: string; patientNumber: string; name: string; mobile: string };
type Doctor = { id: string; name: string };
type Appointment = {
  id: string; appointmentNumber: string; patientId: string; patientNumber: string; patientName: string; mobile: string;
  doctorUserId: string; doctorName: string; appointmentDate: string; appointmentTime: string;
  appointmentType: string; treatment?: string; notes?: string; status: string;
};

const statuses: Record<string, string> = {
  SCHEDULED: "Scheduled", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  IN_CONSULTATION: "In Consultation", COMPLETED: "Completed", CANCELLED: "Cancelled", NO_SHOW: "No Show"
};
const appointmentTypes = ["Consultation", "Treatment", "Follow-up", "Procedure", "Other"];

function todayIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function AppointmentsPage() {
  const [date, setDate] = useState(todayIndia);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Appointment | null>(null);
  async function load() {
    const response = await fetch(`/api/appointments?date=${encodeURIComponent(date)}`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setAppointments(data.appointments);
      setDoctors(data.doctors);
    }
  }

  async function searchPatients(query: string) {
    setPatientQuery(query);
    setSelectedPatient(null);
    if (query.trim().length < 2) { setPatientResults([]); return; }
    const response = await fetch(`/api/patients?q=${encodeURIComponent(query.trim())}&page=1&pageSize=10`, { cache: "no-store" });
    if (response.ok) setPatientResults((await response.json()).patients);
  }

  useEffect(() => { void load(); }, [date]);

  const counts = useMemo(() => ({
    today: appointments.length,
    waiting: appointments.filter((item) => item.status === "CHECKED_IN").length
  }), [appointments]);

  function openNew() {
    setEditing(null);
    setOpen(true);
    setError("");
    setPatientQuery("");
    setPatientResults([]);
    setSelectedPatient(null);
  }

  function openEdit(appointment: Appointment) {
    setEditing(appointment);
    setOpen(true); setError(""); setPatientQuery(""); setPatientResults([]);
    setSelectedPatient({ id: appointment.patientId, patientNumber: appointment.patientNumber, name: appointment.patientName, mobile: appointment.mobile });
  }

  function closeForm() {
    setOpen(false); setEditing(null); setError(""); setPatientQuery(""); setPatientResults([]); setSelectedPatient(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) {
      setError("Please search for and select a patient.");
      return;
    }

    setSaving(true);
    setError("");

    // Keep a stable reference before awaiting the API request.
    // React may clear the event's currentTarget after the await.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const data = Object.fromEntries(form.entries());

    const response = await fetch("/api/appointments", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { ...data, patientId: selectedPatient.id, appointmentId: editing.id } : { ...data, patientId: selectedPatient.id })
    });
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(result.error ?? "Unable to create appointment.");
      return;
    }

    formElement.reset();
    closeForm();
    setPatientQuery("");
    setPatientResults([]);
    setSelectedPatient(null);
    await load();
  }

  return <>
    <p className="eyebrow">Clinic schedule</p>
    <div className="page-header">
      <div><h1>Appointments</h1><p className="lead">Schedule visits, manage today's queue and track appointment status.</p></div>
      <button className="button" onClick={openNew}>+ New appointment</button>
    </div>

    <div className="toolbar"><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
    {error && <p className="error">{error}</p>}

    {open && <div className="card form-card">
      <div className="form-header"><div><h2>{editing ? "Edit appointment" : "New appointment"}</h2><p className="muted">{editing ? `Appointment ${editing.appointmentNumber}` : "Search the existing patient and select a database-managed doctor."}</p></div><button className="text-button" type="button" onClick={closeForm}>Close</button></div>
      <form className="lead-form" onSubmit={submit}>
        <label className="full">Patient
          {selectedPatient ? <div className="card selected-patient"><strong>{selectedPatient.patientNumber} · {selectedPatient.name}</strong><span>{selectedPatient.mobile}</span><button className="text-button" type="button" onClick={() => { setSelectedPatient(null); setPatientQuery(""); }}>Change</button></div> : <>
            <input value={patientQuery} onChange={(event) => void searchPatients(event.target.value)} placeholder="Search name, mobile or Patient ID" autoComplete="off" />
            {patientQuery.trim().length >= 2 && <div className="card search-results">{patientResults.length ? patientResults.map((patient) => <button type="button" className="search-result" key={patient.id} onClick={() => { setSelectedPatient(patient); setPatientResults([]); }}>{patient.patientNumber} · {patient.name}<small>{patient.mobile}</small></button>) : <span className="muted">No matching patients found.</span>}</div>}
          </>}
        </label>
        <label>Doctor<select name="doctorUserId" required defaultValue={editing?.doctorUserId ?? ""}><option value="" disabled>Select doctor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
        <label>Date<input name="appointmentDate" type="date" required defaultValue={editing?.appointmentDate ?? date} /></label>
        <label>Time<input name="appointmentTime" type="time" required defaultValue={editing?.appointmentTime ?? ""} /></label>
        <label>Appointment type<select name="appointmentType" required defaultValue={editing?.appointmentType ?? "Consultation"}>{appointmentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Treatment / purpose <span className="optional">optional</span><input name="treatment" defaultValue={editing?.treatment ?? ""} placeholder="e.g. Hair PRP, Hydrafacial, Consultation" /></label>
        <label className="full">Notes <span className="optional">optional</span><textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} placeholder="Additional appointment notes..." /></label>
        {editing && <label>Status<select name="status" defaultValue={editing.status}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <div className="form-actions full"><button className="button" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create appointment"}</button><button className="secondary-button" type="button" onClick={closeForm}>Cancel</button></div>
      </form>
    </div>}

    <div className="stats">
      <section className="card"><span>Today</span><strong>{counts.today}</strong><small>appointments</small></section>
      <section className="card"><span>Waiting</span><strong>{counts.waiting}</strong><small>checked in</small></section>
      <a className="card" href="/app/appointments/upcoming"><span>Upcoming</span><strong>View</strong><small>future appointments</small></a>
    </div>

    <div className="card table-card lead-list">
      {appointments.length === 0 ? <div className="empty-state"><strong>No appointments for this date</strong><span>Create an appointment to build the clinic schedule.</span></div> : <div className="lead-table appointment-table">
        <div className="lead-row lead-head"><span>Appointment</span><span>Time</span><span>Patient</span><span>Mobile</span><span>Doctor</span><span>Type</span><span>Treatment</span><span>Status</span></div>
        {appointments.slice().sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime)).map((appointment) => <div className="lead-row" key={appointment.id}>
          <strong>{appointment.appointmentNumber}</strong><strong>{appointment.appointmentTime}</strong><span><strong>{appointment.patientNumber}</strong><br />{appointment.patientName}</span><span>{appointment.mobile}</span><span>{appointment.doctorName}</span><span>{appointment.appointmentType}</span><span>{appointment.treatment || "—"}</span><span>{statuses[appointment.status] || appointment.status}</span><span className="row-actions"><button className="text-button" type="button" onClick={() => openEdit(appointment)}>Edit</button></span>
        </div>)}
      </div>}
    </div>
  </>;
}
