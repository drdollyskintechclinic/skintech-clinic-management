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

  return <>
    <p className="eyebrow">Appointment planning</p>
    <div className="page-header">
      <div>
        <h1>Future Appointments</h1>
        <p className="lead">View all upcoming appointments sorted by date and time.</p>
      </div>
      <a className="secondary-button" href="/app/appointments">← Back to Appointments</a>
    </div>

    <div className="stats">
      <section className="card"><span>Future appointments</span><strong>{total}</strong><small>scheduled ahead</small></section>
    </div>

    <div className="card table-card lead-list">
      {loading ? <div className="empty-state"><strong>Loading appointments...</strong></div> :
        appointments.length === 0 ? <div className="empty-state"><strong>No upcoming appointments</strong><span>Future appointments will appear here when they are scheduled.</span></div> :
        <div className="lead-table appointment-table">
          <div className="lead-row lead-head"><span>Date</span><span>Time</span><span>Appointment</span><span>Patient</span><span>Doctor</span><span>Treatment</span><span>Status</span></div>
          {appointments.map((appointment) => <div className="lead-row" key={appointment.id}>
            <strong>{appointment.appointmentDate}</strong>
            <strong>{appointment.appointmentTime}</strong>
            <strong>{appointment.appointmentNumber}</strong>
            <span><strong>{appointment.patientNumber}</strong><br />{appointment.patientName}</span>
            <span>{appointment.doctorName}</span>
            <span>{appointment.treatment || "—"}</span>
            <span>{statuses[appointment.status] || appointment.status}</span>
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
