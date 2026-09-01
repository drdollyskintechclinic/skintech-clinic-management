"use client";

import { FormEvent, useEffect, useState } from "react";

type Lead = { id: string; createdAt: string; name?: string; mobile?: string; email?: string; source?: string; interestedTreatment?: string; followUpAt?: string | null; notes?: string; status?: string };

const sources = ["Instagram", "Facebook", "WhatsApp", "Google", "Walk-in", "Referral", "Other"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load(search = query) {
    const response = await fetch(`/api/leads?q=${encodeURIComponent(search)}`, { cache: "no-store" });
    if (response.ok) setLeads((await response.json()).leads);
  }

  useEffect(() => { void load(""); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true); setError("");
    const form = new FormData(formElement);
    const followUp = String(form.get("followUpAt") || "");
    const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      name: form.get("name"), mobile: form.get("mobile"), email: form.get("email"), source: form.get("source"),
      interestedTreatment: form.get("interestedTreatment"), followUpAt: followUp ? new Date(followUp).toISOString() : "", notes: form.get("notes")
    }) });
    setSaving(false);
    if (!response.ok) { setError((await response.json()).error ?? "Unable to save enquiry."); return; }
    formElement.reset(); setOpen(false); await load("");
  }

  return <>
    <p className="eyebrow">Front office</p>
    <div className="page-header"><div><h1>Leads & Enquiries</h1><p className="lead">Capture enquiries, assign ownership, and keep every follow-up visible.</p></div><span className="status-pill">{leads.length} enquiries</span></div>
    <div className="toolbar"><button className="button" onClick={() => { setOpen(true); setError(""); }}>+ New enquiry</button><input aria-label="Search leads" value={query} onChange={(e) => { setQuery(e.target.value); void load(e.target.value); }} placeholder="Search name or mobile" /></div>

    {open && <div className="card form-card"><div className="form-header"><div><h2>New enquiry</h2><p className="muted">Record the lead while the enquiry is fresh.</p></div><button className="text-button" type="button" onClick={() => setOpen(false)}>Close</button></div>
      <form className="lead-form" onSubmit={submit}>
        <label>Name<input name="name" required placeholder="Patient / enquiry name" /></label>
        <label>Mobile<input name="mobile" required placeholder="10-digit mobile number" inputMode="tel" /></label>
        <label>Email <span className="optional">optional</span><input name="email" type="email" placeholder="name@example.com" /></label>
        <label>Source<select name="source" defaultValue="Instagram">{sources.map((source) => <option key={source}>{source}</option>)}</select></label>
        <label>Interested treatment<input name="interestedTreatment" required placeholder="e.g. Hydrafacial, PRP, Laser Hair Reduction" /></label>
        <label>Next follow-up <span className="optional">optional</span><input name="followUpAt" type="datetime-local" /></label>
        <label className="full">Notes <span className="optional">optional</span><textarea name="notes" rows={3} placeholder="Enquiry details, concerns, preferred timing..." /></label>
        {error && <p className="error full">{error}</p>}
        <div className="form-actions full"><button className="button" disabled={saving}>{saving ? "Saving..." : "Save enquiry"}</button><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </div>}

    <div className="card table-card lead-list">{leads.length === 0 ? <div className="empty-state"><strong>No enquiries yet</strong><span>Click “New enquiry” to capture your first lead.</span></div> : <div className="lead-table"><div className="lead-row lead-head"><span>Name</span><span>Mobile</span><span>Source</span><span>Treatment</span><span>Status</span><span>Follow-up</span></div>{leads.map((lead) => <div className="lead-row" key={lead.id}><strong>{lead.name}</strong><span>{lead.mobile}</span><span>{lead.source}</span><span>{lead.interestedTreatment}</span><span><b className="badge">{lead.status ?? "NEW"}</b></span><span>{lead.followUpAt ? new Date(lead.followUpAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</span></div>)}</div>}</div>
  </>;
}
