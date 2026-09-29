"use client";

import { useEffect, useState } from "react";

type Appointment = {
  id: string;
  appointmentNumber: string;
  patientNumber: string;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  treatment?: string;
  status: string;
};

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}-${month}-${year}` : value;
}

const statuses: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  IN_CONSULTATION: "In Consultation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show"
};

export default function UpcomingAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const response = await fetch(`/api/appointments?upcoming=true&page=${page}&pageSize=10`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setAppointments(data.upcomingAppointments);
        setTotal(data.upcomingTotal);
        setTotalPages(data.upcomingTotalPages);
      }
      setLoading(false);
    }
    void load();
  }, [page]);

  async function removeScheduledAppointment(appointment: Appointment) {
    if (appointment.status !== "SCHEDULED") return;
    if (!window.confirm(`Delete appointment ${appointment.appointmentNumber}?`)) return;
    setError("");
    const response = await fetch("/api/appointments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentId: appointment.id }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Unable to delete appointment."); return; }
    const refreshed = await fetch(`/api/appointments?upcoming=true&page=${page}&pageSize=10`, { cache: "no-store" });
    if (refreshed.ok) {
      const data = await refreshed.json();
      setAppointments(data.upcomingAppointments);
      setTotal(data.upcomingTotal);
      setTotalPages(data.upcomingTotalPages);
      if (page > data.upcomingTotalPages) setPage(data.upcomingTotalPages);
    }
  }

  return <>
    <p className="eyebrow">Appointment planning</p>
    <div className="page-header">
      <div>
        <h1>Future Appointments</h1>
        <p className="lead">View all upcoming appointments sorted by date and time.</p>
      </div>
      <a className="secondary-button" href="/app/appointments">← Back to Appointments</a>
    </div>

    {error && <p className="error">{error}</p>}

    <div className="stats">
      <section className="card"><span>Future appointments</span><strong>{total}</strong><small>scheduled ahead</small></section>
    </div>

    <div className="card table-card lead-list">
      {loading ? <div className="empty-state"><strong>Loading appointments...</strong></div> :
        appointments.length === 0 ? <div className="empty-state"><strong>No upcoming appointments</strong><span>Future appointments will appear here when they are scheduled.</span></div> :
        <div className="lead-table appointment-table">
          <div className="lead-row lead-head"><span>Date</span><span>Time</span><span>Appointment</span><span>Patient</span><span>Doctor</span><span>Treatment</span><span>Status</span><span>Actions</span></div>
          {appointments.map((appointment) => <div className="lead-row" key={appointment.id}>
            <strong>{displayDate(appointment.appointmentDate)}</strong>
            <strong>{appointment.appointmentTime}</strong>
            <strong>{appointment.appointmentNumber}</strong>
            <span><strong>{appointment.patientNumber}</strong><br />{appointment.patientName}</span>
            <span>{appointment.doctorName}</span>
            <span>{appointment.treatment || "—"}</span>
            <span>{statuses[appointment.status] || appointment.status}</span><span className="row-actions"><a className="text-button" href={`/app/appointments?edit=${encodeURIComponent(appointment.id)}&date=${encodeURIComponent(appointment.appointmentDate)}`}>Edit</a>{appointment.status === "SCHEDULED" && <button className="danger-button" type="button" onClick={() => void removeScheduledAppointment(appointment)}>Delete</button>}</span>
          </div>)}
        </div>}
    </div>

    {totalPages > 1 && <div className="form-actions">
      <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
      <span className="muted">Page {page} of {totalPages}</span>
      <button className="secondary-button" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
    </div>}
  </>;
}
