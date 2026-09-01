const cards = [
  ["Leads & Enquiries", "Capture and follow up every enquiry.", "/app/leads"],
  ["Patients", "Register, search and manage patient records.", "/app/patients"],
  ["Appointments", "See today's schedule and check-ins.", "/app/appointments"],
];

export default function DashboardPage() {
  return <>
    <div className="page-header"><div><p className="eyebrow">Clinic operations</p><h1>Good morning</h1><p className="lead">Welcome to Skintech Clinic. Your front-office workspace is ready.</p></div><span className="status-pill">● System healthy</span></div>
    <div className="stats">
      <section className="card"><span>Today's appointments</span><strong>0</strong><small>No appointments scheduled</small></section>
      <section className="card"><span>New enquiries</span><strong>0</strong><small>Awaiting follow-up</small></section>
      <section className="card"><span>Patients</span><strong>0</strong><small>Registered in system</small></section>
    </div>
    <h2 className="section-title">Quick access</h2>
    <div className="grid">{cards.map(([title, text, href]) => <a className="card action-card" href={href} key={href}><h2>{title}</h2><p>{text}</p><span>Open →</span></a>)}</div>
  </>;
}
