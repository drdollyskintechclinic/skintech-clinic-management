"use client";

import { FormEvent, useEffect, useState } from "react";

type Doctor = {
  id: string; name: string; email: string; isActive: boolean; clinicLocationName: string;
  contactNumber: string; degree: string; speciality: string;
};

const emptyForm = { name: "", email: "", password: "", contactNumber: "", degree: "", speciality: "" };

export default function StaffPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/staff/doctors", { cache: "no-store" });
    if (response.ok) setDoctors((await response.json()).doctors);
  }

  useEffect(() => { void load(); }, []);

  function openAdd() {
    setEditing(null); setForm(emptyForm); setError(""); setOpen(true);
  }

  function openEdit(doctor: Doctor) {
    setEditing(doctor);
    setForm({ name: doctor.name, email: doctor.email, password: "", contactNumber: doctor.contactNumber, degree: doctor.degree, speciality: doctor.speciality });
    setError(""); setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const payload = { ...form, ...(editing ? { doctorId: editing.id } : {}) };
    const response = await fetch("/api/staff/doctors", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setError(result.error ?? "Unable to save doctor."); return; }
    setOpen(false); setForm(emptyForm); setEditing(null); await load();
  }

  async function toggle(doctor: Doctor) {
    const response = await fetch("/api/staff/doctors", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId: doctor.id, isActive: !doctor.isActive })
    });
    if (response.ok) await load();
  }

  return <>
    <p className="eyebrow">Staff management</p>
    <div className="page-header">
      <div><h1>Doctors</h1><p className="lead">Manage doctor profiles, branch assignment and appointment availability.</p></div>
      <button className="button" onClick={openAdd}>+ Add doctor</button>
    </div>

    {error && <p className="error">{error}</p>}

    {open && <div className="card form-card">
      <div className="form-header">
        <div><h2>{editing ? "Edit doctor" : "Add doctor"}</h2><p className="muted">Contact and professional details are stored in the staff profile.</p></div>
        <button className="text-button" type="button" onClick={() => setOpen(false)}>Close</button>
      </div>
      <form className="lead-form" onSubmit={submit}>
        <label>Doctor name<input value={form.name} onChange={e => setForm({...form, name:e.target.value})} required placeholder="Dr. Full Name" /></label>
        <label>Contact number<input value={form.contactNumber} onChange={e => setForm({...form, contactNumber:e.target.value})} placeholder="10 digit mobile number" /></label>
        <label>Degree<input value={form.degree} onChange={e => setForm({...form, degree:e.target.value})} placeholder="BHMS, MBBS, BDS, MD..." /></label>
        <label>Speciality<input value={form.speciality} onChange={e => setForm({...form, speciality:e.target.value})} placeholder="Aesthetic Medicine, Trichology..." /></label>
        <label>Email<input value={form.email} onChange={e => setForm({...form, email:e.target.value})} type="email" required placeholder="doctor@example.com" /></label>
        <label>{editing ? "New login password" : "Login password"}<input value={form.password} onChange={e => setForm({...form, password:e.target.value})} type="password" minLength={12} required={!editing} placeholder={editing ? "Leave blank to keep current password" : "Minimum 12 characters"} /></label>
        <div className="form-actions full"><button className="button" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Add doctor"}</button><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </div>}

    <div className="card table-card lead-list"><div className="lead-table">
      <div className="lead-row lead-head"><span>Doctor</span><span>Contact</span><span>Degree</span><span>Speciality</span><span>Email</span><span>Branch</span><span>Status</span><span>Actions</span></div>
      {doctors.map(doctor => <div className="lead-row" key={doctor.id}>
        <strong>{doctor.name || "Unnamed doctor"}</strong><span>{doctor.contactNumber || "—"}</span><span>{doctor.degree || "—"}</span><span>{doctor.speciality || "—"}</span><span>{doctor.email}</span><span>{doctor.clinicLocationName}</span><span>{doctor.isActive ? "Active" : "Inactive"}</span>
        <span className="row-actions"><button className="text-button" type="button" onClick={() => openEdit(doctor)}>Edit</button><button className={doctor.isActive ? "danger-button" : "text-button"} type="button" onClick={() => void toggle(doctor)}>{doctor.isActive ? "Deactivate" : "Activate"}</button></span>
      </div>)}
      {doctors.length === 0 && <div className="empty-state"><strong>No doctors added</strong><span>Add a doctor to make them available for appointments.</span></div>}
    </div></div>

    <div className="card" style={{ marginTop: "1rem" }}>
      <h2>How staff should be handled</h2>
      <p className="muted">Keep Doctors as a dedicated professional profile because appointments need doctor-specific information. Receptionist/Telecaller and Therapist should be managed in the same Staff Management area with their role, contact number, branch, login access and active/inactive status. Their permissions should come from the selected role rather than being manually assigned.</p>
    </div>
  </>;
}