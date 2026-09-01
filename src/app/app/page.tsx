import Link from "next/link";

import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

const cards = [
  ["Leads & Enquiries", "Capture and follow up every enquiry.", "/app/leads"],
  ["Patients", "Register, search and manage patient records.", "/app/patients"],
  ["Appointments", "See today's schedule and check-ins.", "/app/appointments"],
];

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePermission("reception.manage");
  const [leadEvents, patientCount, appointmentCount] = await Promise.all([
    db.auditEvent.findMany({ where: { organizationId: user.organizationId, resourceType: "LEAD" }, orderBy: { occurredAt: "desc" }, take: 2000, select: { id: true, resourceId: true, action: true, occurredAt: true } }),
    db.auditEvent.count({ where: { organizationId: user.organizationId, resourceType: "PATIENT" } }),
    db.auditEvent.count({ where: { organizationId: user.organizationId, resourceType: "APPOINTMENT" } })
  ]);
  const seen = new Set<string>(); let newEnquiries = 0;
  for (const event of leadEvents) {
    const id = event.resourceId ?? event.id;
    if (seen.has(id)) continue; seen.add(id);
    if (event.action === "LEAD_CREATED") newEnquiries += 1;
  }

  return <>
    <div className="page-header"><div><p className="eyebrow">Clinic operations</p><h1>Good morning</h1><p className="lead">Welcome to Skintech Clinic. Your front-office workspace is ready.</p></div><span className="status-pill">● System healthy</span></div>
    <div className="stats">
      <section className="card"><span>Today's appointments</span><strong>{appointmentCount}</strong><small>{appointmentCount ? "Appointments recorded" : "No appointments scheduled"}</small></section>
      <section className="card"><span>New enquiries</span><strong>{newEnquiries}</strong><small>{newEnquiries ? "Awaiting follow-up" : "No new enquiries"}</small></section>
      <section className="card"><span>Patients</span><strong>{patientCount}</strong><small>{patientCount ? "Patient activity recorded" : "No patients registered"}</small></section>
    </div>
    <h2 className="section-title">Quick access</h2>
    <div className="grid">{cards.map(([title, text, href]) => <Link className="card action-card" href={href} key={href}><h2>{title}</h2><p>{text}</p><span>Open →</span></Link>)}</div>
  </>;
}
