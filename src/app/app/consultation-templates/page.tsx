"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Template = { id:string; field:string; name:string; content:string; active:boolean; sortOrder:number };
const fields = [
  ["chiefComplaint","Chief complaint / patient's concern"],
  ["examinationFindings","Examination / clinical findings"],
  ["diagnosis","Diagnosis / assessment"],
  ["treatmentAdvised","Treatment advised"],
  ["procedurePerformed","Procedure performed"],
  ["prescription","Prescription / medicines"],
  ["doctorNotes","Doctor's notes"]
] as const;

export default function ConsultationTemplatesPage() {
  const [templates,setTemplates]=useState<Template[]>([]);
  const [field,setField]=useState(fields[0][0]);
  const [name,setName]=useState("");
  const [content,setContent]=useState("");
  const [editing,setEditing]=useState<Template|null>(null);
  const [error,setError]=useState("");
  const [page,setPage]=useState(1);
  const pageSize=10;

  async function load(){ const r=await fetch("/api/consultation-templates",{cache:"no-store"}); const d=await r.json(); if(r.ok)setTemplates(d.templates); else setError(d.error??"Unable to load templates."); }
  useEffect(()=>{void load()},[]);

  function reset(){setEditing(null);setName("");setContent("");setField(fields[0][0]);}
  async function save(e:FormEvent){e.preventDefault();setError("");const body={id:editing?.id,field,name,content,active:true,sortOrder:templates.filter(t=>t.field===field).length};const r=await fetch("/api/consultation-templates",{method:editing?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){setError(d.error??"Unable to save.");return;}reset();await load();}
  async function remove(id:string){if(!confirm("Delete this consultation template?"))return;const r=await fetch("/api/consultation-templates",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});if(!r.ok){const d=await r.json();setError(d.error??"Unable to delete.");return;}await load();}
  const grouped=useMemo(()=>fields.map(([value,label])=>({value,label,items:templates.filter(t=>t.field===value)})),[templates]);
  const pageCount=Math.max(1,Math.ceil(templates.length/pageSize));
  const visibleTemplates=templates.slice((page-1)*pageSize,page*pageSize);
  const visibleGrouped=fields.map(([value,label])=>({value,label,items:visibleTemplates.filter(t=>t.field===value)})).filter(group=>group.items.length>0);
  function changePage(next:number){setPage(Math.min(pageCount,Math.max(1,next)));}

  return <>
    <p className="eyebrow">Clinical setup</p>
    <div className="page-header"><div><h1>Consultation Templates</h1><p className="lead">Create reusable text for the consultation fields. Doctors can select and edit templates during consultation.</p></div></div>
    {error&&<p className="error">{error}</p>}
    <div className="card form-card">
      <div className="form-header"><div><h2>{editing?"Edit template":"Add template"}</h2></div>{editing&&<button className="text-button" type="button" onClick={reset}>Cancel edit</button>}</div>
      <form className="lead-form" onSubmit={save}>
        <label>Consultation field<select value={field} onChange={e=>setField(e.target.value)}>{fields.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>Template name<input value={name} onChange={e=>setName(e.target.value)} required placeholder="e.g. General consultation" /></label>
        <label className="full">Template text<textarea value={content} onChange={e=>setContent(e.target.value)} rows={5} required placeholder="Enter the reusable clinical wording..." /></label>
        <div className="form-actions full"><button className="button">{editing?"Save changes":"Add template"}</button><button className="secondary-button" type="button" onClick={reset}>Clear</button></div>
      </form>
    </div>
    <div className="card table-card">
      {templates.length===0 ? <div className="empty-state"><strong>No templates yet</strong><span>Add your first reusable consultation template above.</span></div> : visibleGrouped.map(group =>
        <section key={group.value} style={{marginBottom:"1.5rem"}}>
          <h2>{group.label}</h2>
          <div>
            {group.items.map(t =>
              <div className="template-row" key={t.id}>
                <div><strong>{t.name}</strong><p>{t.content}</p></div>
                <div>
                  <button type="button" className="text-button" onClick={()=>{setEditing(t);setField(t.field);setName(t.name);setContent(t.content)}}>Edit</button>
                  <button type="button" className="danger-button" onClick={()=>void remove(t.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      {templates.length>0 && pageCount>1 && <div className="form-actions">
        <button type="button" className="secondary-button" disabled={page===1} onClick={()=>changePage(page-1)}>Previous</button>
        <span className="muted">Page {page} of {pageCount}</span>
        <button type="button" className="secondary-button" disabled={page===pageCount} onClick={()=>changePage(page+1)}>Next</button>
      </div>}
    </div>
  </>;
}