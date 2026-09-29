"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Patient = { id: string; patientNumber: string; name: string; mobile: string };
type Doctor = { id: string; name: string };
type Appointment = {
  id: string; appointmentNumber: string; patientNumber: string; patientName: string; mobile: string;
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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [appointmentResponse, patientResponse] = await Promise.all([
      fetch(`/api/appointments?date=${encodeURIComponent(date)}`, { cache: "no-store" }),
      fetch("/api/patients?page=1&pageSize=50", { cache: "no-store" })
    ]);
    if (appointmentResponse.ok) {
      const data = await appointmentResponse.json();
      setAppointments(data.appointments);
      setDoctors(data.doctors);
    }
    if (patientResponse.ok) setPatients((await patientResponse.json()).patients);
  }

  useEffect(() => { void load(); }, [date]);

  const counts = useMemo(() => ({
    today: appointments.length,
    waiting: appointments.filter((item) => item.status === "CHECKED_IN").length
  }), [appointments]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setError(result.error ?? "Unable to create appointment."); return; }
    setOpen(false);
    event.currentTarget.reset();
    await load();
  }

  return <>
    <p className="eyebrow">Clinic schedule</p>
    <div className="page-header">
      <div><h1>Appointments</h1><p className="lead">Schedule visits, manage today's queue and track appointment status.</p></div>
      <button className="button" onClick={() => { setOpen(true); setError(""); }}>+ New appointment</button>
    </div>

    <div className="toolbar">
      <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    </div>

    {error && <p className="error">{error}</p>}

    {open && <div className="card form-card">
      <div className="form-header"><div><h2>New appointment</h2><p className="muted">Link the visit to an existing patient and doctor.</p></div><button className="text-button" type="button" onClick={() => setOpen(false)}>Close</button></div>
      <form className="lead-form" onSubmit={submit}>
        <label>Patient<select name="patientId" required defaultValue=""><option value="" disabled>Select patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.patientNumber} · {patient.name} · {patient.mobile}</option>)}</select></label>
        <label>Doctor<select name="doctorUserId" required defaultValue=""><option value="" disabled>Select doctor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
        <label>Date<input name="appointmentDate" type="date" required defaultValue={date} /></label>
        <label>Time<input name="appointmentTime" type="time" required /></label>
        <label>Appointment type<select name="appointmentType" required defaultValue="Consultation">{appointmentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Treatment / purpose <span className="optional">optional</span><input name="treatment" placeholder="e.g. Hair PRP, Hydrafacial, Consultation" /></label>
        <label className="full">Notes <span className="optional">optional</span><textarea name="notes" rows={3} placeholder="Additional appointment notes..." /></label>
        <div className="form-actions full"><button className="button" disabled={saving}>{saving ? "Saving..." : "Create appointment"}</button><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </div>}

    <div className="stats">
      <section className="card"><span>Today</span><strong>{counts.today}</strong><small>appointments</small></section>
      <section className="card"><span>Waiting</span><strong>{counts.waiting}</strong><small>checked in</small></section>
      <section className="card"><span>Upcoming</span><strong>—</strong><small>next 7 days</small></section>
    </div>

    <div className="card table-card lead-list">
      {appointments.length === 0 ? <div className="empty-state"><strong>No appointments for this date</strong><span>Create an appointment to build the clinic schedule.</span></div> : <div className="lead-table appointment-table">
        <div className="lead-row lead-head"><span>Time</span><span>Patient</span><span>Mobile</span><span>Doctor</span><span>Type</span><span>Treatment</span><span>Status</span></div>
        {appointments.sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime)).map((appointment) => <div className="lead-row" key={appointment.id}>
          <strong>{appointment.appointmentTime}</strong><span><strong>{appointment.patientNumber}</strong><br />{appointment.patientName}</span><span>{appointment.mobile}</span><span>{appointment.doctorName}</span><span>{appointment.appointmentType}</span><span>{appointment.treatment || "—"}</span><span>{statuses[appointment.status] || appointment.status}</span>
        </div>)}
      </div>}
    </div>
  </>;
}
