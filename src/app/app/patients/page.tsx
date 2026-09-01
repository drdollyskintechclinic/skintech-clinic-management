"use client";

import { FormEvent, useEffect, useState } from "react";

type Patient = { id: string; patientNumber: string; createdAt: string; name: string; mobile: string; email?: string; dateOfBirth?: string; gender?: string; address?: string; emergencyContactName?: string; emergencyContactMobile?: string; notes?: string };
type Duplicate = { id: string; patientNumber: string; name: string; mobile: string; createdAt: string };

const genders = ["", "FEMALE", "MALE", "OTHER", "PREFER_NOT_TO_SAY"];
const genderLabels: Record<string, string> = { "": "Select", FEMALE: "Female", MALE: "Male", OTHER: "Other", PREFER_NOT_TO_SAY: "Prefer not to say" };
const pageSize = 10;

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]), [query, setQuery] = useState(""), [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Patient | null>(null), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<Duplicate[] | null>(null), [pendingData, setPendingData] = useState<Record<string, unknown> | null>(null), [refresh, setRefresh] = useState(0);

  async function load(search = query, currentPage = page) {
    const response = await fetch(`/api/patients?q=${encodeURIComponent(search)}&page=${currentPage}&pageSize=${pageSize}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json(); setPatients(data.patients); setTotal(data.pagination.total);
  }
  useEffect(() => { void load(query, page); }, [query, page, refresh]);

  function startNew() { setEditing(null); setError(""); setDuplicate(null); setPendingData(null); setOpen(true); }
  function startEdit(patient: Patient) { setEditing(patient); setError(""); setDuplicate(null); setPendingData(null); setOpen(true); }

  async function savePatient(data: Record<string, unknown>, formElement: HTMLFormElement, allowDuplicate = false) {
    setSaving(true); setError("");
    const response = await fetch("/api/patients", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { patientId: editing.id, data, allowDuplicate } : { ...data, allowDuplicate }) });
    const result = await response.json(); setSaving(false);
    if (response.status === 409 && Array.isArray(result.duplicates)) { setDuplicate(result.duplicates); setPendingData(data); return; }
    if (!response.ok) { setError(result.error ?? "Unable to save patient."); return; }
    formElement.reset(); setOpen(false); setEditing(null); setDuplicate(null); setPendingData(null); setRefresh((value) => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const data = { name: form.get("name"), mobile: form.get("mobile"), email: form.get("email"), dateOfBirth: form.get("dateOfBirth"), gender: form.get("gender"), address: form.get("address"), emergencyContactName: form.get("emergencyContactName"), emergencyContactMobile: form.get("emergencyContactMobile"), notes: form.get("notes") };
    await savePatient(data, formElement);
  }

  async function remove(patient: Patient) {
    if (!window.confirm(`Delete patient record for ${patient.name}?`)) return;
    const response = await fetch(`/api/patients?id=${encodeURIComponent(patient.id)}`, { method: "DELETE" });
    if (!response.ok) { setError((await response.json()).error ?? "Unable to delete patient."); return; }
    if (patients.length === 1 && page > 1) setPage(page - 1); else setRefresh((value) => value + 1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const date = (value?: string) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return <>
    <p className="eyebrow">Patient management</p>
    <div className="page-header"><div><h1>Patients</h1><p className="lead">Register patients once and keep their core contact details ready for every visit.</p></div><span className="status-pill">{total} patients</span></div>
    <div className="toolbar"><button className="button" onClick={startNew}>+ Register patient</button><input aria-label="Search patients" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search name, mobile or patient ID" /></div>
    {error && <p className="error">{error}</p>}

    {open && <div className="card form-card"><div className="form-header"><div><h2>{editing ? "Edit patient" : "Register patient"}</h2><p className="muted">{editing ? "Update the patient record." : "Create the patient's main clinic record."}</p></div><button className="text-button" type="button" onClick={() => { setOpen(false); setEditing(null); }}>Close</button></div>
      <form className="lead-form" onSubmit={submit}>
        <label>Full name<input name="name" required defaultValue={editing?.name ?? ""} placeholder="Patient full name" /></label>
        <label>Mobile<input name="mobile" required defaultValue={editing?.mobile ?? ""} placeholder="10-digit mobile number" inputMode="tel" /></label>
        <label>Email <span className="optional">optional</span><input name="email" type="email" defaultValue={editing?.email ?? ""} placeholder="name@example.com" /></label>
        <label>Date of birth <span className="optional">optional</span><input name="dateOfBirth" type="date" defaultValue={editing?.dateOfBirth ?? ""} /></label>
        <label>Gender <span className="optional">optional</span><select name="gender" defaultValue={editing?.gender ?? ""}>{genders.map((gender) => <option key={gender} value={gender}>{genderLabels[gender]}</option>)}</select></label>
        <label>Emergency contact name <span className="optional">optional</span><input name="emergencyContactName" defaultValue={editing?.emergencyContactName ?? ""} placeholder="Name" /></label>
        <label>Emergency contact mobile <span className="optional">optional</span><input name="emergencyContactMobile" defaultValue={editing?.emergencyContactMobile ?? ""} placeholder="10-digit mobile number" inputMode="tel" /></label>
        <label className="full">Address <span className="optional">optional</span><input name="address" defaultValue={editing?.address ?? ""} placeholder="Residential address" /></label>
        <label className="full">Notes <span className="optional">optional</span><textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} placeholder="General patient notes, preferences or important information..." /></label>
        <div className="form-actions full"><button className="button" disabled={saving}>{saving ? "Saving..." : editing ? "Update patient" : "Save patient"}</button><button className="secondary-button" type="button" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</button></div>
      </form>
    </div>}

    {duplicate && <div className="card duplicate-warning"><strong>Existing patient found for this mobile number</strong><p className="muted">A mobile number normally identifies an existing patient. If this is genuinely a different person sharing the number, you can continue after reviewing the record.</p><div className="duplicate-list">{duplicate.map((item) => <div key={item.id}><strong>{item.patientNumber} · {item.name}</strong><span>{item.mobile} · Registered {date(item.createdAt)}</span></div>)}</div><div className="form-actions"><button className="button" disabled={saving || !pendingData || !open} onClick={() => { const form = document.querySelector<HTMLFormElement>(".lead-form"); if (form && pendingData) void savePatient(pendingData, form, true); }}>Create patient anyway</button><button className="secondary-button" onClick={() => { setDuplicate(null); setPendingData(null); }}>Go back</button></div></div>}

    <div className="card table-card lead-list">{patients.length === 0 ? <div className="empty-state"><strong>No patients yet</strong><span>Click “Register patient” to create the first patient record.</span></div> : <div className="lead-table patient-table"><div className="lead-row lead-head"><span>Patient ID</span><span>Name</span><span>Mobile</span><span>Gender</span><span>DOB</span><span>Emergency contact</span><span>Notes</span><span>Actions</span></div>{patients.map((patient) => <div className="lead-row" key={patient.id}><strong>{patient.patientNumber}</strong><strong>{patient.name}</strong><span>{patient.mobile}</span><span>{genderLabels[patient.gender ?? ""] || patient.gender || "—"}</span><span>{date(patient.dateOfBirth)}</span><span>{patient.emergencyContactName ? `${patient.emergencyContactName}${patient.emergencyContactMobile ? ` · ${patient.emergencyContactMobile}` : ""}` : "—"}</span><span className="notes-cell" title={patient.notes || "No notes"}>{patient.notes || "—"}</span><span className="row-actions"><button className="text-button" type="button" onClick={() => startEdit(patient)}>Edit</button><button className="danger-button" type="button" onClick={() => void remove(patient)}>Delete</button></span></div>)}</div>}</div>
    {total > 0 && <div className="pagination"><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button className="secondary-button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
  </>;
}
