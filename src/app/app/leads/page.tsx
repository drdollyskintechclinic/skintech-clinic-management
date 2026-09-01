"use client";

import { FormEvent, useEffect, useState } from "react";

type Owner = { id: string; name: string | null; email: string };
type Lead = { id: string; createdAt: string; name: string; mobile: string; email?: string; source: string; interestedTreatment: string; followUpAt?: string | null; notes?: string; status?: string; ownerUserId?: string };
type Duplicate = { id: string; name: string; mobile: string; interestedTreatment: string; createdAt: string };
const sources = ["Instagram", "Facebook", "WhatsApp", "Google", "Walk-in", "Referral", "Other"];
const pageSize = 10;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]), [owners, setOwners] = useState<Owner[]>([]), [query, setQuery] = useState(""), [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Lead | null>(null), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<Duplicate[] | null>(null), [pendingData, setPendingData] = useState<Record<string, unknown> | null>(null);
  const [refresh, setRefresh] = useState(0);

  async function load(search = query, currentPage = page) {
    const response = await fetch(`/api/leads?q=${encodeURIComponent(search)}&page=${currentPage}&pageSize=${pageSize}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json(); setLeads(data.leads); setOwners(data.owners); setTotal(data.pagination.total);
  }
  useEffect(() => { void load(query, page); }, [query, page, refresh]);

  function startNew() { setEditing(null); setError(""); setDuplicate(null); setPendingData(null); setOpen(true); }
  function startEdit(lead: Lead) { setEditing(lead); setError(""); setDuplicate(null); setPendingData(null); setOpen(true); }

  async function saveLead(data: Record<string, unknown>, formElement: HTMLFormElement, allowDuplicate = false) {
    setSaving(true); setError("");
    const payload = editing ? { leadId: editing.id, data } : { data, allowDuplicate };
    const response = await fetch("/api/leads", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? payload : { ...data, allowDuplicate }) });
    const result = await response.json(); setSaving(false);
    if (response.status === 409 && Array.isArray(result.duplicates)) { setDuplicate(result.duplicates); setPendingData(data); return; }
    if (!response.ok) { setError(result.error ?? "Unable to save enquiry."); return; }
    formElement.reset(); setOpen(false); setEditing(null); setDuplicate(null); setPendingData(null); setRefresh((value) => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const followUp = String(form.get("followUpAt") || "");
    const data = { name: form.get("name"), mobile: form.get("mobile"), email: form.get("email"), source: form.get("source"), interestedTreatment: form.get("interestedTreatment"), followUpAt: followUp ? new Date(followUp).toISOString() : "", notes: form.get("notes"), ownerUserId: form.get("ownerUserId") };
    await saveLead(data, formElement);
  }

  async function assign(leadId: string, ownerUserId: string) {
    const response = await fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", leadId, ownerUserId }) });
    if (!response.ok) { setError((await response.json()).error ?? "Unable to assign enquiry."); return; } setRefresh((value) => value + 1);
  }

  async function remove(lead: Lead) {
    if (!window.confirm(`Delete enquiry for ${lead.name}?`)) return;
    const response = await fetch(`/api/leads?id=${encodeURIComponent(lead.id)}`, { method: "DELETE" });
    if (!response.ok) { setError((await response.json()).error ?? "Unable to delete enquiry."); return; }
    if (leads.length === 1 && page > 1) setPage(page - 1); else setRefresh((value) => value + 1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const localDate = (value?: string | null) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

  return <>
    <p className="eyebrow">Front office</p>
    <div className="page-header"><div><h1>Leads & Enquiries</h1><p className="lead">Capture enquiries, assign ownership, and keep every follow-up visible.</p></div><span className="status-pill">{total} enquiries</span></div>
    <div className="toolbar"><button className="button" onClick={startNew}>+ New enquiry</button><input aria-label="Search leads" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search name or mobile" /></div>
    {error && <p className="error">{error}</p>}
    {open && <div className="card form-card"><div className="form-header"><div><h2>{editing ? "Edit enquiry" : "New enquiry"}</h2><p className="muted">{editing ? "Update the enquiry details." : "Record the lead while the enquiry is fresh."}</p></div><button className="text-button" type="button" onClick={() => { setOpen(false); setEditing(null); }}>Close</button></div>
      <form className="lead-form" onSubmit={submit}>
        <label>Name<input name="name" required defaultValue={editing?.name ?? ""} placeholder="Patient / enquiry name" /></label>
        <label>Mobile<input name="mobile" required defaultValue={editing?.mobile ?? ""} placeholder="10-digit mobile number" inputMode="tel" /></label>
        <label>Email <span className="optional">optional</span><input name="email" type="email" defaultValue={editing?.email ?? ""} placeholder="name@example.com" /></label>
        <label>Source<select name="source" defaultValue={editing?.source ?? "Instagram"}>{sources.map((source) => <option key={source}>{source}</option>)}</select></label>
        <label>Interested treatment<input name="interestedTreatment" required defaultValue={editing?.interestedTreatment ?? ""} placeholder="e.g. Hydrafacial, PRP, Laser Hair Reduction" /></label>
        <label>Owner<select name="ownerUserId" defaultValue={editing?.ownerUserId ?? ""}><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name || owner.email}</option>)}</select></label>
        <label>Next follow-up <span className="optional">optional</span><input name="followUpAt" type="datetime-local" defaultValue={editing?.followUpAt ? new Date(editing.followUpAt).toISOString().slice(0,16) : ""} /></label>
        <label className="full">Notes <span className="optional">optional</span><textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""} placeholder="Enquiry details, concerns, preferred timing..." /></label>
        <div className="form-actions full"><button className="button" disabled={saving}>{saving ? "Saving..." : editing ? "Update enquiry" : "Save enquiry"}</button><button className="secondary-button" type="button" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</button></div>
      </form>
    </div>}
    {duplicate && <div className="card duplicate-warning"><strong>Existing enquiry found for this mobile number</strong><p className="muted">The same patient may contact the clinic more than once, so we will not block the new enquiry. Please review the existing record before continuing.</p><div className="duplicate-list">{duplicate.map((item) => <div key={item.id}><strong>{item.name}</strong><span>{item.mobile} · {item.interestedTreatment} · {localDate(item.createdAt)}</span></div>)}</div><div className="form-actions"><button className="button" disabled={saving || !pendingData || !open} onClick={() => { const form = document.querySelector<HTMLFormElement>(".lead-form"); if (form && pendingData) void saveLead(pendingData, form, true); }}>Create new enquiry anyway</button><button className="secondary-button" onClick={() => { setDuplicate(null); setPendingData(null); }}>Go back</button></div></div>}
    <div className="card table-card lead-list">{leads.length === 0 ? <div className="empty-state"><strong>No enquiries yet</strong><span>Click “New enquiry” to capture your first lead.</span></div> : <div className="lead-table"><div className="lead-row lead-head"><span>Name</span><span>Mobile</span><span>Source</span><span>Treatment</span><span>Owner</span><span>Status</span><span>Follow-up</span><span>Actions</span></div>{leads.map((lead) => <div className="lead-row" key={lead.id}><strong>{lead.name}</strong><span>{lead.mobile}</span><span>{lead.source}</span><span>{lead.interestedTreatment}</span><select aria-label={`Assign ${lead.name}`} value={lead.ownerUserId ?? ""} onChange={(e) => void assign(lead.id, e.target.value)}><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name || owner.email}</option>)}</select><span><b className="badge">{lead.status ?? "NEW"}</b></span><span>{localDate(lead.followUpAt)}</span><span className="row-actions"><button className="text-button" type="button" onClick={() => startEdit(lead)}>Edit</button><button className="danger-button" type="button" onClick={() => void remove(lead)}>Delete</button></span></div>)}</div>}</div>
    {total > 0 && <div className="pagination"><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button className="secondary-button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
  </>;
}
