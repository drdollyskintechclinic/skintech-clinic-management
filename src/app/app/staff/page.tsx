"use client";

import { FormEvent, useEffect, useState } from "react";

type Doctor = { id: string; name: string; email: string; isActive: boolean; clinicLocationName: string };

export default function StaffPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/staff/doctors", { cache: "no-store" });
    if (response.ok) setDoctors((await response.json()).doctors);
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = event.currentTarget;
    const response = await fetch("/api/staff/doctors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setError(result.error ?? "Unable to add doctor."); return; }
    form.reset(); setOpen(false); await load();
  }

  async function toggle(doctor: Doctor) {
    const response = await fetch("/api/staff/doctors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doctorId: doctor.id, isActive: !doctor.isActive }) });
    if (response.ok) await load();
  }

  return <>
    <p className="eyebrow">Staff management</p>
    <div className="page-header"><div><h1>Doctors</h1><p className="lead">Manage active doctors available for appointment scheduling.</p></div><button className="button" onClick={() => { setOpen(true); setError(""); }}>+ Add doctor</button></div>
    {error && <p className="error">{error}</p>}
    {open && <div className="card form-card"><div className="form-header"><div><h2>Add doctor</h2><p className="muted">The doctor will be assigned to your current clinic branch.</p></div><button className="text-button" type="button" onClick={() => setOpen(false)}>Close</button></div>
      <form className="lead-form" onSubmit={submit}>
        <label>Doctor name<input name="name" required placeholder="Doctor full name" /></label>
        <label>Email<input name="email" type="email" required placeholder="doctor@example.com" /></label>
        <label>Login password<input name="password" type="password" minLength={12} required placeholder="Minimum 12 characters" /></label>
        <div className="form-actions full"><button className="button" disabled={saving}>{saving ? "Saving..." : "Add doctor"}</button><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </div>}
    <div className="card table-card lead-list"><div className="lead-table">
      <div className="lead-row lead-head"><span>Doctor</span><span>Email</span><span>Branch</span><span>Status</span><span>Actions</span></div>
      {doctors.map((doctor) => <div className="lead-row" key={doctor.id}><strong>{doctor.name || "Unnamed doctor"}</strong><span>{doctor.email}</span><span>{doctor.clinicLocationName}</span><span>{doctor.isActive ? "Active" : "Inactive"}</span><span><button className={doctor.isActive ? "danger-button" : "text-button"} type="button" onClick={() => void toggle(doctor)}>{doctor.isActive ? "Deactivate" : "Activate"}</button></span></div>)}
      {doctors.length === 0 && <div className="empty-state"><strong>No doctors added</strong><span>Add a doctor to make them available for appointments.</span></div>}
    </div></div>
  </>;
}