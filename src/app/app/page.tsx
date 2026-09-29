import Link from "next/link";

import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

type AppointmentEvent = { id: string; resourceId: string | null; action: string; occurredAt: Date };

function indiaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const cards = [
  ["Leads & Enquiries", "Capture and follow up every enquiry.", "/app/leads"],
  ["Patients", "Register, search and manage patient records.", "/app/patients"],
  ["Appointments", "See today's schedule and check-ins.", "/app/appointments"],
];

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePermission("reception.manage");
  const today = indiaToday();
  const [leadEvents, patientEvents, appointmentEvents] = await Promise.all([
    db.auditEvent.findMany({ where: { organizationId: user.organizationId, resourceType: "LEAD" }, orderBy: { occurredAt: "desc" }, take: 2000, select: { id: true, resourceId: true, action: true, occurredAt: true } }),
    db.auditEvent.findMany({ where: { organizationId: user.organizationId, resourceType: "PATIENT" }, orderBy: { occurredAt: "desc" }, take: 5000, select: { id: true, resourceId: true, action: true } }),
    db.auditEvent.findMany({ where: { organizationId: user.organizationId, resourceType: "APPOINTMENT", metadata: { path: ["appointmentDate"], equals: today } }, orderBy: { occurredAt: "desc" }, take: 5000, select: { id: true, resourceId: true, action: true, occurredAt: true } })
  ]);
  const latestAppointments = new Map<string, AppointmentEvent>();
  for (const event of appointmentEvents as AppointmentEvent[]) {
    const id = event.resourceId ?? event.id;
    if (!latestAppointments.has(id)) latestAppointments.set(id, event);
  }
  const appointmentCount = [...latestAppointments.values()].filter((event) => event.action !== "APPOINTMENT_DELETED").length;

  const seen = new Set<string>(); let newEnquiries = 0;
  for (const event of leadEvents) {
    const id = event.resourceId ?? event.id;
    if (seen.has(id)) continue; seen.add(id);
    if (event.action === "LEAD_CREATED") newEnquiries += 1;
  }

  const seenPatients = new Set<string>();
  let patientCount = 0;
  for (const event of patientEvents) {
    const id = event.resourceId ?? event.id;
    if (seenPatients.has(id)) continue;
    seenPatients.add(id);
    if (event.action !== "PATIENT_DELETED") patientCount += 1;
  }

  return <>
    <div className="page-header"><div><p className="eyebrow">Clinic operations</p><h1>Good morning</h1><p className="lead">Welcome to Skintech Clinic. Your front-office workspace is ready.</p></div><span className="status-pill">● System healthy</span></div>
    <div className="stats">
      <section className="card"><span>Today's appointments</span><strong>{appointmentCount}</strong><small>{appointmentCount ? "Appointments recorded" : "No appointments scheduled"}</small></section>
      <section className="card"><span>New enquiries</span><strong>{newEnquiries}</strong><small>{newEnquiries ? "Awaiting follow-up" : "No new enquiries"}</small></section>
      <section className="card"><span>Patients</span><strong>{patientCount}</strong><small>{patientCount ? "Registered patients" : "No patients registered"}</small></section>
    </div>
    <h2 className="section-title">Quick access</h2>
    <div className="grid">{cards.map(([title, text, href]) => <Link className="card action-card" href={href} key={href}><h2>{title}</h2><p>{text}</p><span>Open →</span></Link>)}</div>
  </>;
}
