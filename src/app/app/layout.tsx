import Link from "next/link";

import { requireAuth } from "@/server/auth/authorization";

const navigation = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/leads", label: "Leads & Enquiries" },
  { href: "/app/patients", label: "Patients" },
  { href: "/app/appointments", label: "Appointments" },
  { href: "/app/staff", label: "Doctors & Staff" },
  { href: "/app/consultation-templates", label: "Consultation Templates" },
  { href: "/app/treatments", label: "Treatments & Packages" },
  { href: "/app/billing", label: "Billing & Payments" },
  { href: "/app/treatment-sessions", label: "Treatment & Sessions" },
  { href: "/app/follow-ups", label: "Follow-ups" },
];

export default async function ApplicationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Skintech Clinic<small>Clinic Management</small></div>
        <nav className="nav" aria-label="Application navigation">
          {navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>
        <div className="sidebar-footer"><small>Signed in as</small><strong>{user.email}</strong></div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
