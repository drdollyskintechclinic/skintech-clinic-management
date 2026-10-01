"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Patient = { id: string; patientNumber: string; name: string; mobile: string };
type Doctor = { id: string; name: string };
type Appointment = {
  id: string; appointmentNumber: string; patientId: string; patientNumber: string; patientName: string; mobile: string;
  leadId?: string; followUpId?: string; doctorUserId: string; doctorName: string; appointmentDate: string; appointmentTime: string;
  appointmentType: string; treatment?: string; notes?: string; status: string;
};

const statuses: Record<string, string> = {
  SCHEDULED: "Scheduled", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  IN_CONSULTATION: "In Consultation", COMPLETED: "Completed", CANCELLED: "Cancelled", NO_SHOW: "No Show"
};
const appointmentTypes = ["Consultation", "Treatment", "Follow-up", "Procedure", "Other"];

const timeSlots = Array.from({ length: 53 }, (_, index) => {
  const minutes = 9 * 60 + index * 15;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

function formatTime(value: string) {
  const [hourString, minute] = value.split(":");
  const hour = Number(hourString);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

const treatmentOptions = [
  "Consultation",
  "Follow-up",
  "Hydrafacial",
  "Advanced Hydrafacial",
  "Glow MediFacial",
  "MediFacial",
  "Carbon Laser Facial",
  "CO2 Fractional Laser",
  "Q-Switched Nd:YAG Laser",
  "Pico Laser",
  "Laser Hair Reduction",
  "Electrolysis",
  "Tattoo Removal",
  "Hair PRP",
  "Hair GFC",
  "Hair Patch Restoration",
  "MNRF",
  "HIFU",
  "IV Glutathione Therapy",
  "Botox",
  "Dermal Fillers",
  "Thread Lift",
  "Eyebrow Microblading",
  "Ombre Brows",
  "Powder Brows",
  "Lip Blush",
  "Scalp Micropigmentation",
  "Earlobe Repair",
  "Gunshot Ear Piercing",
  "Skin Tag Removal",
  "Wart Removal",
  "Mole Removal",
  "Chemical Peel",
  "Dermaplaning",
  "Microdermabrasion",
  "Photofacial",
  "Skin Brightening",
  "BB Glow Facial",
  "CC Glow Facial",
  "Other"
];

function todayIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function AppointmentsPage() {
  const searchParams = useSearchParams();
  const editAppointmentId = searchParams.get("edit");
  const requestedDate = searchParams.get("date");
  const bookFromFollowUp = searchParams.get("book") === "1";
  const requestedPatientId = searchParams.get("patientId");
  const requestedFollowUpId = searchParams.get("followUpId");
  const requestedLeadId = searchParams.get("leadId");
  const bookFromLead = searchParams.get("bookFromLead") === "1";
  const [date, setDate] = useState(requestedDate || todayIndia);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [treatmentQuery, setTreatmentQuery] = useState("");
  const [selectedTreatment, setSelectedTreatment] = useState("");
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [bookingFromFollowUp, setBookingFromFollowUp] = useState(false);
  const [bookingFromLead, setBookingFromLead] = useState(false);
  const [leadName, setLeadName] = useState("");
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

  useEffect(() => { setAppointmentPage(1); void load(); }, [date]);

  useEffect(() => {
    if (!bookFromFollowUp || !requestedPatientId) return;
    let cancelled = false;
    async function prepareFollowUpBooking() {
      const response = await fetch(`/api/patients?id=${encodeURIComponent(requestedPatientId)}`, { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const data = await response.json();
      const patient = data.patients?.[0];
      if (!patient || cancelled) return;
      setEditing(null);
      setSelectedPatient(patient);
      setPatientQuery("");
      setPatientResults([]);
      setTreatmentQuery("");
      setSelectedTreatment("Follow-up");
      setTreatmentOpen(false);
      setBookingFromFollowUp(true);
      setError("");
      setOpen(true);
    }
    void prepareFollowUpBooking();
    return () => { cancelled = true; };
  }, [bookFromFollowUp, requestedPatientId]);

  useEffect(() => {
    if (!bookFromLead || !requestedLeadId) return;
    let cancelled = false;
    async function prepareLeadBooking() {
      const response = await fetch(`/api/leads?id=${encodeURIComponent(requestedLeadId)}`, { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const data = await response.json();
      const lead = data.leads?.[0];
      if (!lead || cancelled) return;
      setEditing(null); setBookingFromLead(true); setBookingFromFollowUp(false); setBookingFromLead(false); setLeadName(""); setLeadName(lead.name);
      setPatientQuery(""); setPatientResults([]); setSelectedPatient(null);
      setSelectedTreatment(lead.interestedTreatment || ""); setTreatmentQuery(""); setTreatmentOpen(false); setError(""); setOpen(true);
    }
    void prepareLeadBooking();
    return () => { cancelled = true; };
  }, [bookFromLead, requestedLeadId]);

  useEffect(() => {
    if (!editAppointmentId || !appointments.length) return;
    const appointment = appointments.find((item) => item.id === editAppointmentId);
    if (appointment) openEdit(appointment);
  }, [editAppointmentId, appointments]);

  useEffect(() => {
    async function loadUpcomingCount() {
      const response = await fetch("/api/appointments?upcoming=true&page=1&pageSize=1", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        const element = document.getElementById("upcoming-count");
        if (element) element.textContent = String(data.upcomingTotal);
      }
    }
    void loadUpcomingCount();
  }, []);

  const appointmentPageSize = 20; const [appointmentPage,setAppointmentPage]=useState(1); const sortedAppointments=useMemo(()=>appointments.slice().sort((a,b)=>a.appointmentTime.localeCompare(b.appointmentTime)),[appointments]); const appointmentTotalPages=Math.max(1,Math.ceil(sortedAppointments.length/appointmentPageSize)); const safeAppointmentPage=Math.min(appointmentPage,appointmentTotalPages); const pagedAppointments=sortedAppointments.slice((safeAppointmentPage-1)*appointmentPageSize,safeAppointmentPage*appointmentPageSize);

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
    setTreatmentQuery("");
    setSelectedTreatment("");
    setTreatmentOpen(false);
  }

  function openEdit(appointment: Appointment) {
    setEditing(appointment);
    setOpen(true); setError(""); setPatientQuery(""); setPatientResults([]);
    setSelectedPatient({ id: appointment.patientId, patientNumber: appointment.patientNumber, name: appointment.patientName, mobile: appointment.mobile });
    setTreatmentQuery("");
    setSelectedTreatment(appointment.treatment?.split(",")[0]?.trim() ?? "");
    setTreatmentOpen(false);
  }

  function closeForm() {
    setOpen(false); setEditing(null); setError(""); setPatientQuery(""); setPatientResults([]); setSelectedPatient(null); setTreatmentQuery(""); setSelectedTreatment(""); setTreatmentOpen(false); setBookingFromFollowUp(false);
  }

  async function deleteAppointment(appointment: Appointment) {
    if (appointment.status !== "SCHEDULED") return;
    if (!window.confirm(`Delete appointment ${appointment.appointmentNumber}?`)) return;
    setError("");
    const response = await fetch("/api/appointments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentId: appointment.id }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Unable to delete appointment."); return; }
    await load();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient && !bookingFromLead) {
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
    if (!editing && bookingFromFollowUp && requestedFollowUpId) data.followUpId = requestedFollowUpId;
    if (!editing && bookingFromLead && requestedLeadId) data.leadId = requestedLeadId;

    const response = await fetch("/api/appointments", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { ...data, patientId: selectedPatient?.id, appointmentId: editing.id } : { ...data, ...(selectedPatient ? { patientId: selectedPatient.id } : {}) })
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
    <div className="appointments-header">
      <div className="appointments-title"><h1>Appointments</h1><p className="lead">Schedule visits, manage today's queue and track appointment status.</p></div>
      <div className="appointments-header-actions">
        <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <button className="button" onClick={openNew}>+ New appointment</button>
      </div>
    </div>
    {error && <p className="error">{error}</p>}

    {open && <div className="clinic-modal-backdrop" role="dialog" aria-modal="true" aria-label={editing ? "Edit appointment" : "New appointment"}><div className="card form-card clinic-modal">
      <div className="form-header"><div><h2>{editing ? "Edit appointment" : "New appointment"}</h2><p className="muted">{editing ? `Appointment ${editing.appointmentNumber}` : bookingFromLead ? `Booking from enquiry: ${leadName}` : "Search the existing patient and select a database-managed doctor."}</p></div><button className="text-button" type="button" onClick={closeForm}>Close</button></div>
      <form className="lead-form" onSubmit={submit}>
        <label className="full"><span className="field-label-text">Patient<span className="field-asterisk" aria-hidden="true">*</span></span>
          {selectedPatient ? <div className="card selected-patient"><strong>{selectedPatient.patientNumber} · {selectedPatient.name}</strong><span>{selectedPatient.mobile}</span><button className="text-button" type="button" onClick={() => { setSelectedPatient(null); setPatientQuery(""); }}>Change</button></div> : <>
            <input value={patientQuery} onChange={(event) => void searchPatients(event.target.value)} placeholder="Search name, mobile or Patient ID" autoComplete="off" />
            {patientQuery.trim().length >= 2 && <div className="card search-results">{patientResults.length ? patientResults.map((patient) => <button type="button" className="search-result" key={patient.id} onClick={() => { setSelectedPatient(patient); setPatientResults([]); }}>{patient.patientNumber} · {patient.name}<small>{patient.mobile}</small></button>) : <span className="muted">No matching patients found.</span>}</div>}
          </>}
            {bookingFromLead && !selectedPatient && <div className="muted" style={{ marginTop: ".4rem" }}>A patient record will be created automatically from this enquiry if one does not already exist.</div>}
        </label>
        <label><span className="field-label-text">Doctor<span className="field-asterisk" aria-hidden="true">*</span></span><select name="doctorUserId" required defaultValue={editing?.doctorUserId ?? ""}><option value="" disabled>Select doctor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
        <div className="appointment-datetime">
          <label><span className="field-label-text">Date<span className="field-asterisk" aria-hidden="true">*</span></span><input name="appointmentDate" type="date" required defaultValue={editing?.appointmentDate ?? date} /></label>
          <label><span className="field-label-text">Time<span className="field-asterisk" aria-hidden="true">*</span></span><select name="appointmentTime" required defaultValue={editing?.appointmentTime ?? ""}><option value="" disabled>Select time</option>{timeSlots.map((time) => <option key={time} value={time}>{formatTime(time)}</option>)}</select></label>
        </div>
        <label><span className="field-label-text">Appointment type<span className="field-asterisk" aria-hidden="true">*</span></span><select name="appointmentType" required defaultValue={editing?.appointmentType ?? (bookingFromFollowUp ? "Follow-up" : "Consultation")}>{appointmentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Treatment / purpose
          <select name="treatment" value={selectedTreatment} onChange={(event) => setSelectedTreatment(event.target.value)}>
            <option value="">Select procedure</option>
            {treatmentOptions.map((treatment) => <option key={treatment} value={treatment}>{treatment}</option>)}
          </select>
        </label>
        <label className="full">Notes<textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} placeholder="Additional appointment notes..." /></label>
        {editing && <label>Status<select name="status" defaultValue={editing.status}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <div className="form-actions full"><button className="button" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create appointment"}</button><button className="secondary-button" type="button" onClick={closeForm}>Cancel</button></div>
      </form>
    </div></div>}

    <div className="stats">
      <section className="card"><span>Today</span><strong>{counts.today}</strong><small>appointments</small></section>
      <section className="card"><span>Waiting</span><strong>{counts.waiting}</strong><small>checked in</small></section>
      <a className="card" href="/app/appointments/upcoming"><span>Upcoming</span><strong id="upcoming-count">Loading…</strong><small>future appointments</small></a>
    </div>

    <div className="card table-card lead-list">
      {appointments.length === 0 ? <div className="empty-state"><strong>No appointments for this date</strong><span>Create an appointment to build the clinic schedule.</span></div> : <div className="lead-table appointment-table">
        <div className="lead-row lead-head"><span>Appointment</span><span>Time</span><span>Patient</span><span>Mobile</span><span>Doctor</span><span>Type</span><span>Treatment</span><span>Status</span></div>
        {pagedAppointments.map((appointment) => <div className="lead-row" key={appointment.id}>
          <strong>{appointment.appointmentNumber}</strong><strong>{appointment.appointmentTime}</strong><span><strong>{appointment.patientNumber}</strong><br />{appointment.patientName}</span><span>{appointment.mobile}</span><span>{appointment.doctorName}</span><span>{appointment.appointmentType}</span><span>{appointment.treatment || "—"}</span><span>{statuses[appointment.status] || appointment.status}</span><span className="row-actions"><button className="text-button" type="button" onClick={() => openEdit(appointment)}>Edit</button>{!["CANCELLED", "NO_SHOW"].includes(appointment.status) && <Link className="text-button" href={`/app/appointments/${appointment.id}/consultation`}>Consultation</Link>}{appointment.status === "SCHEDULED" && <button className="danger-button" type="button" onClick={() => void deleteAppointment(appointment)}>Delete</button>}</span>
        </div>)}
      </div>}
    </div>
  </>;
}
